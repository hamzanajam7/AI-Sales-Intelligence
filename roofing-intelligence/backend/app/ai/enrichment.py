from __future__ import annotations
import asyncio
import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.schemas import EnrichmentData


def get_perplexity_client() -> AsyncOpenAI:
    settings = get_settings()
    return AsyncOpenAI(
        api_key=settings.perplexity_api_key,
        base_url="https://api.perplexity.ai",
    )


async def enrich_contractor(company_name: str, city: str = None, state: str = None) -> EnrichmentData:
    """Use Perplexity Sonar to research a roofing contractor."""
    client = get_perplexity_client()
    location = f" in {city}, {state}" if city and state else ""

    prompt = f"""Research the roofing contractor "{company_name}"{location}. Provide the following information in JSON format:

{{
    "estimated_revenue": "Annual revenue estimate (e.g., '$2M-5M')",
    "employee_count": "Number of employees (e.g., '10-25')",
    "years_in_business": <number of years as integer>,
    "specialties": ["list", "of", "specialties"],
    "online_presence_score": <1-10 score based on website quality, social media, reviews>,
    "recent_news": "Any recent news, awards, or notable projects",
    "bbb_rating": "BBB rating if available (e.g., 'A+', 'B')",
    "summary": "2-3 sentence summary of the company, its reputation, and market position"
}}

Only return valid JSON. If information is not available, use null for that field."""

    try:
        response = await client.chat.completions.create(
            model="sonar",
            messages=[
                {"role": "system", "content": "You are a business research analyst. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
        )

        content = response.choices[0].message.content.strip()
        # Extract JSON from response (may have markdown code fences)
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        data = json.loads(content)

        return EnrichmentData(
            estimated_revenue=data.get("estimated_revenue"),
            employee_count=data.get("employee_count"),
            years_in_business=int(data["years_in_business"]) if data.get("years_in_business") else None,
            specialties=data.get("specialties", []) or [],
            online_presence_score=int(data["online_presence_score"]) if data.get("online_presence_score") else None,
            recent_news=data.get("recent_news"),
            bbb_rating=data.get("bbb_rating"),
            summary=data.get("summary", ""),
        )

    except Exception as e:
        print(f"Enrichment failed for {company_name}: {e}")
        return EnrichmentData(summary=f"Enrichment failed: {str(e)}")


async def enrich_batch(contractors: list[dict], batch_size: int = 3, delay: float = 1.0) -> list[EnrichmentData]:
    """Enrich a batch of contractors with rate limiting."""
    results = []
    for i in range(0, len(contractors), batch_size):
        batch = contractors[i:i + batch_size]
        tasks = [
            enrich_contractor(c["company_name"], c.get("city"), c.get("state"))
            for c in batch
        ]
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in batch_results:
            if isinstance(r, Exception):
                results.append(EnrichmentData(summary=f"Error: {str(r)}"))
            else:
                results.append(r)
        if i + batch_size < len(contractors):
            await asyncio.sleep(delay)
    return results
