from __future__ import annotations
import asyncio
import re
from playwright.async_api import async_playwright, Page
from sqlalchemy import select, delete, func
from app.models import Contractor
from app.database import async_session


# ZIP to state/city URL mapping for GAF (bypasses Akamai WAF on query params)
ZIP_TO_URL = {
    "10013": "https://www.gaf.com/en-us/roofing-contractors/residential/usa/ny/new-york",
    "10001": "https://www.gaf.com/en-us/roofing-contractors/residential/usa/ny/new-york",
    "07102": "https://www.gaf.com/en-us/roofing-contractors/residential/usa/nj/newark",
    "11201": "https://www.gaf.com/en-us/roofing-contractors/residential/usa/ny/brooklyn",
}
DEFAULT_URL = "https://www.gaf.com/en-us/roofing-contractors/residential/usa/ny/new-york"

async def scrape_gaf_contractors(zip_code: str = "10013", max_results: int = 50) -> list[dict]:
    """Scrape GAF roofing contractor directory using Playwright with stealth settings."""
    url = ZIP_TO_URL.get(zip_code, DEFAULT_URL)
    contractors = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
            timezone_id="America/New_York",
        )

        # Remove webdriver detection flag
        await context.add_init_script(
            'Object.defineProperty(navigator,"webdriver",{get:()=>undefined})'
        )

        page = await context.new_page()

        try:
            print(f"Navigating to: {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)

            try:
                await page.wait_for_load_state("networkidle", timeout=15000)
            except Exception:
                pass

            await asyncio.sleep(4)

            title = await page.title()
            print(f"Page title: {title}")

            if "Access Denied" in title:
                print("Blocked by WAF. Trying alternative approach...")
                await browser.close()
                return []

            # Dismiss cookie banners
            for selector in [
                "button:has-text('Accept')",
                "button:has-text('Accept All')",
                "#onetrust-accept-btn-handler",
            ]:
                try:
                    btn = page.locator(selector).first
                    if await btn.is_visible(timeout=1000):
                        await btn.click()
                        await asyncio.sleep(0.5)
                except Exception:
                    pass

            # Scrape from article elements
            contractors = await _scrape_articles(page, max_results)

        except Exception as e:
            print(f"Scraping error: {e}")

        await browser.close()

    print(f"Scraped {len(contractors)} contractors")
    return contractors


async def _scrape_articles(page: Page, max_results: int) -> list[dict]:
    """Scrape contractor data from article elements on the GAF page."""
    contractors = []

    # Debug: dump raw text of first 2 articles before pagination
    debug_articles = await page.query_selector_all("article")
    for i, art in enumerate(debug_articles[:2]):
        try:
            raw = await art.inner_text()
            print(f"[DEBUG] Article {i} raw text:\n---\n{raw}\n---")
        except Exception:
            pass

    # Load more results: scroll + click strategy with article count monitoring
    prev_count = len(debug_articles)
    stable_rounds = 0

    for attempt in range(30):
        # Scroll to bottom to trigger lazy loading
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(2)

        # Try clicking pagination / load more buttons
        clicked = False
        for selector in [
            "button:has-text('Show More')",
            "button:has-text('Load More')",
            "a:has-text('Show More')",
            "a:has-text('Load More')",
            "button:has-text('Next')",
            "a:has-text('Next')",
            "[class*='pagination'] button",
            "[class*='load-more']",
            "[data-testid*='load-more']",
            "button[class*='more']",
        ]:
            try:
                btn = page.locator(selector).first
                if await btn.is_visible(timeout=1000):
                    await btn.click()
                    await asyncio.sleep(3)
                    clicked = True
                    print(f"Clicked pagination: {selector} (attempt {attempt + 1})")
                    break
            except Exception:
                continue

        # Check article count
        current_articles = await page.query_selector_all("article")
        current_count = len(current_articles)
        print(f"Pagination attempt {attempt + 1}: {current_count} articles (prev: {prev_count})")

        if current_count == prev_count:
            stable_rounds += 1
            if stable_rounds >= 3:
                print(f"Article count stable for 3 rounds, stopping pagination")
                break
        else:
            stable_rounds = 0
            prev_count = current_count

        if current_count >= max_results:
            print(f"Reached max_results ({max_results}), stopping pagination")
            break

        if not clicked:
            # If we couldn't click anything and count didn't change, scroll more aggressively
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(2)

    # GAF uses <article> elements for each contractor card
    articles = await page.query_selector_all("article")
    print(f"Found {len(articles)} article elements")

    for article in articles[:max_results]:
        try:
            text = await article.inner_text()
            if not text or len(text.strip()) < 10:
                continue

            contractor = _parse_article_text(text)

            # Get profile link from the article
            try:
                link_el = await article.query_selector("a[href*='/roofing-contractors/']")
                if link_el:
                    href = await link_el.get_attribute("href")
                    if href:
                        contractor["gaf_profile_url"] = href
            except Exception:
                pass

            if contractor.get("company_name") and _is_valid_contractor(contractor):
                contractors.append(contractor)
        except Exception as e:
            print(f"Error parsing article: {e}")
            continue

    return contractors


def _is_valid_contractor(contractor: dict) -> bool:
    """Validate that a scraped record is a real contractor, not junk."""
    name = contractor.get("company_name", "").lower()

    # Reject known junk patterns
    skip_patterns = [
        "gaf master", "gaf certified", "gaf weather", "show more", "load more",
        "request a quote", "sort by", "refine results", "view all",
        "president's club", "triple excellence", "certified plus",
        "certified(tm)", "certified plus(tm)", "master elite(r)",
    ]
    if any(sp in name for sp in skip_patterns):
        return False

    # A real contractor must have at least a city or phone
    if not contractor.get("city") and not contractor.get("phone"):
        return False

    return True


def _parse_article_text(text: str) -> dict:
    """Parse contractor data from article inner text.

    Typical format:
        Preferred Exterior Corp
        5.0 (49)
        New Hyde Park, NY - 16.5 mi
        Request a Quote
        Phone Number:
        (516) 968-2994
        Certifications and Awards
        View All
        President's Club Award
        GAF Master Elite\u00ae
    """
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if not lines:
        return {}

    # First line is company name
    company_name = lines[0]

    # Skip non-company lines
    skip_words = [
        "request", "phone", "certification", "view all", "award",
        "sort", "refine", "gaf master", "gaf certified", "show more", "load more",
    ]
    if any(sw in company_name.lower() for sw in skip_words):
        return {}

    # Extract star rating and review count using multi-strategy approach
    star_rating = None
    review_count = 0

    # Strategy 1: Single-line format "5.0 (49)"
    for line in lines[1:5]:
        rating_match = re.match(r'^(\d+\.?\d*)\s*\((\d+)\)', line)
        if rating_match:
            star_rating = float(rating_match.group(1))
            review_count = int(rating_match.group(2))
            break

    # Strategy 2: Multi-line — "5.0" on one line, "(49)" on the next
    if star_rating is None:
        for i, line in enumerate(lines[1:6]):
            idx = i + 1
            if re.match(r'^\d+\.?\d*$', line):
                candidate_rating = float(line)
                if 0 <= candidate_rating <= 5 and idx + 1 < len(lines):
                    next_line = lines[idx + 1]
                    count_match = re.match(r'^\((\d+)\)$', next_line)
                    if count_match:
                        star_rating = candidate_rating
                        review_count = int(count_match.group(1))
                        break

    # Strategy 3: Search joined text flexibly for "N.N (NNN)" anywhere
    if star_rating is None:
        full_text_early = " ".join(lines[:8])
        flex_match = re.search(r'(\d+\.?\d*)\s*\((\d+)\)', full_text_early)
        if flex_match:
            candidate = float(flex_match.group(1))
            if 0 <= candidate <= 5:
                star_rating = candidate
                review_count = int(flex_match.group(2))

    # Extract city, state, distance: "New Hyde Park, NY - 16.5 mi"
    city = None
    state = None
    distance_miles = None
    for line in lines[1:6]:
        loc_match = re.match(r'^(.+),\s*([A-Z]{2})\s*-\s*([\d.]+)\s*mi', line)
        if loc_match:
            city = loc_match.group(1).strip()
            state = loc_match.group(2)
            distance_miles = float(loc_match.group(3))
            break

    # Extract phone
    phone = None
    for line in lines:
        phone_match = re.search(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', line)
        if phone_match:
            phone = phone_match.group(0)
            break

    # Extract certification level
    certification = None
    cert_patterns = [
        (r"Master Elite", "GAF Master Elite"),
        (r"President.s Club", "President's Club"),
        (r"Triple Excellence", "Triple Excellence"),
        (r"Weather Stopper", "Weather Stopper"),
        (r"Certified", "GAF Certified"),
    ]
    full_text = " ".join(lines)
    for pattern, label in cert_patterns:
        if re.search(pattern, full_text, re.IGNORECASE):
            certification = label
            break

    address_full = None
    if city and state:
        address_full = f"{city}, {state}"

    return {
        "company_name": company_name,
        "certification_level": certification,
        "address_full": address_full,
        "city": city,
        "state": state,
        "phone": phone,
        "star_rating": star_rating,
        "review_count": review_count,
        "distance_miles": distance_miles,
    }


async def save_contractors_to_db(contractors: list[dict]) -> int:
    """Save scraped contractors to SQLite. Returns count of new records."""
    saved = 0
    async with async_session() as session:
        for data in contractors:
            existing = await session.execute(
                select(Contractor).where(Contractor.company_name == data["company_name"])
            )
            if existing.scalar_one_or_none():
                continue

            contractor = Contractor(**data)
            session.add(contractor)
            saved += 1

        await session.commit()
    return saved


async def clear_contractors_db() -> int:
    """Delete all contractors from the database for clean re-runs. Returns deleted count."""
    async with async_session() as session:
        result = await session.execute(select(func.count()).select_from(Contractor))
        count = result.scalar() or 0
        await session.execute(delete(Contractor))
        await session.commit()
    print(f"Cleared {count} contractors from database")
    return count
