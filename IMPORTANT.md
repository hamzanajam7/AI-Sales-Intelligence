# Instalily Onsite Interview — Complete Preparation Guide

**Created**: March 16, 2026
**Interview Date**: ~March 18, 2026
**Time Limit**: Until 4pm (~6-7 hours)
**Candidate**: Hamza Najam

---

## Table of Contents

1. [The Assignment](#1-the-assignment)
2. [What We Built (Practice Run)](#2-what-we-built-practice-run)
3. [Architecture Decisions & Why](#3-architecture-decisions--why)
4. [Step-by-Step Build Playbook](#4-step-by-step-build-playbook)
5. [Roadblocks We Hit & Fixes](#5-roadblocks-we-hit--fixes)
6. [Key Code Patterns to Reuse](#6-key-code-patterns-to-reuse)
7. [What Impressed vs What Needs Work](#7-what-impressed-vs-what-needs-work)
8. [Speed Run Strategy for Onsite](#8-speed-run-strategy-for-onsite)
9. [Technical Talking Points](#9-technical-talking-points)
10. [If the Task Changes](#10-if-the-task-changes)
11. [API Keys & Services Checklist](#11-api-keys--services-checklist)
12. [Common Pitfalls to Avoid](#12-common-pitfalls-to-avoid)

---

## 1. The Assignment

### What Instalily Asks

Build an **AI-powered B2B sales intelligence platform** for a roofing distributor. The platform should:

- **Scrape** public contractor data from GAF's website (https://www.gaf.com/en-us/roofing-contractors/residential?distance=25, ZIP: 10013)
- **Enrich** leads with AI-generated business intelligence
- **Score** leads so sales reps know who to call first
- **Present** everything in a polished, intuitive UI

### The Four Evaluation Criteria (from the email)

1. **Intuitive UI** — Reps must be able to view leads. Bonus for polished, clear, creative features.
2. **Robust data management** — Store, organize, retrieve data in a production-suitable way. OK to outline future improvements.
3. **Scalable pipeline** — Design for scale (hundreds/thousands of reps). Clean, well-structured code.
4. **Time management** — Until 4pm. Ship something complete, not something half-finished.

### What "Good" Looks Like

The interviewer wants to see:
- You can handle a JS-rendered SPA (not a simple HTML page)
- You understand LLM orchestration (not just "call GPT")
- You know embeddings, RAG, vector DBs — how they work under the hood
- You build production-quality UI, not a prototype
- Your code is clean, modular, well-organized
- You can explain WHY you made each decision

---

## 2. What We Built (Practice Run)

### The Full Stack

```
roofing-intelligence/
├── backend/                    # Python FastAPI
│   ├── app/
│   │   ├── main.py             # FastAPI app + CORS + lifespan
│   │   ├── config.py           # Pydantic settings from .env
│   │   ├── database.py         # Async SQLite + SQLAlchemy
│   │   ├── models.py           # Contractor ORM model
│   │   ├── schemas.py          # Pydantic request/response schemas
│   │   ├── scraper/
│   │   │   └── gaf_scraper.py  # Playwright browser automation
│   │   ├── ai/
│   │   │   ├── enrichment.py   # Perplexity Sonar API
│   │   │   ├── scoring.py      # OpenAI GPT-4o structured output
│   │   │   └── pipeline.py     # Full orchestration
│   │   ├── vectordb/
│   │   │   ├── pinecone_client.py  # Pinecone singleton
│   │   │   ├── embeddings.py       # Voyage AI voyage-3
│   │   │   └── search.py          # Semantic search + RAG
│   │   └── routers/
│   │       ├── contractors.py  # CRUD + sort/filter/paginate
│   │       ├── scraping.py     # Pipeline trigger
│   │       └── dashboard.py    # Aggregate stats
│   ├── requirements.txt
│   └── .env
├── frontend/                   # Next.js 14 + TypeScript
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx      # Root layout + navbar
│   │   │   ├── page.tsx        # Dashboard
│   │   │   └── leads/
│   │   │       ├── page.tsx    # Lead list (sortable table)
│   │   │       └── [id]/page.tsx # Lead detail
│   │   ├── components/
│   │   │   ├── navbar.tsx
│   │   │   ├── leads-table.tsx     # TanStack Table
│   │   │   ├── lead-score-badge.tsx
│   │   │   └── dashboard-stats.tsx # Stats + charts
│   │   └── lib/
│   │       ├── api.ts          # Backend fetch wrapper
│   │       └── types.ts        # TypeScript interfaces
│   └── .env.local
```

### What Each Piece Does

**Scraper** (`gaf_scraper.py`):
- Launches Chromium via Playwright with anti-detection (stealth user agent, webdriver flag removal)
- Uses state-based URL pattern (`/usa/ny/new-york`) instead of query params (which trigger Akamai WAF)
- Must run in HEADED mode (`headless=False`) — headless gets blocked
- Parses `<article>` elements from rendered DOM
- Extracts: company name, certification, city/state, phone, distance, star rating, review count, GAF profile URL

**Enrichment** (`enrichment.py`):
- Perplexity Sonar API (OpenAI-compatible SDK with `base_url="https://api.perplexity.ai"`)
- For each contractor: researches revenue, employees, years in business, specialties, BBB rating, online presence score, recent news
- Returns structured JSON parsed into Pydantic model
- Processes sequentially with 1-second delays (rate limiting)

**Scoring** (`scoring.py`):
- OpenAI GPT-4o with `response_format={"type": "json_object"}`
- RAG-enhanced: pulls similar contractors from Pinecone as scoring context
- Scores 0-100 based on weighted criteria (certification 25%, size 20%, reviews 15%, proximity 10%, years 15%, focus 15%)
- Returns: score, grade (A-F), rationale, strengths[], weaknesses[], recommended_action, buying_signals[]

**Vector DB** (`pinecone_client.py`, `embeddings.py`, `search.py`):
- Voyage AI `voyage-3` model, 1024 dimensions
- Pinecone serverless (AWS us-east-1, cosine metric)
- Each contractor embedded as concatenated text of all fields
- Enables: semantic search ("find large commercial roofers"), similar contractors, RAG context for scoring

**Pipeline** (`pipeline.py`):
- Orchestrates: scrape → save to SQLite → embed → upsert Pinecone → enrich (Perplexity) → score (OpenAI + RAG) → re-embed with enrichment data → update Pinecone
- Runs as FastAPI BackgroundTask
- Reports status via `/api/scraping/status` endpoint
- Frontend polls every 2 seconds for progress updates

**API Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/contractors` | List with sort, filter, pagination |
| GET | `/api/contractors/{id}` | Full detail |
| GET | `/api/contractors/{id}/similar` | Pinecone similarity |
| GET | `/api/contractors/search?q=...` | Semantic search |
| POST | `/api/scraping/run-pipeline` | Trigger pipeline |
| GET | `/api/scraping/status` | Pipeline progress |
| GET | `/api/dashboard/stats` | Aggregate stats |
| POST | `/api/contractors/{id}/enrich` | Re-enrich single |
| POST | `/api/contractors/{id}/score` | Re-score single |

**Frontend Pages**:
1. **Dashboard** (`/`) — 4 stat cards, grade distribution bar chart, certification pie chart, top 5 leads, "Run Pipeline" button with live status
2. **Lead List** (`/leads`) — TanStack Table with sortable columns (default: score DESC), keyword search, AI semantic search toggle, certification filter, min score filter, pagination
3. **Lead Detail** (`/leads/[id]`) — Score circle + grade, rationale, strengths (green checks), weaknesses (red x), recommended action, buying signals, company intelligence card, contact info, recent news, similar contractors section

### Results from Practice Run

- **13 contractors** scraped from GAF (first page of results for NYC area)
- **100% enriched** via Perplexity — rich summaries with revenue, employees, BBB ratings
- **All 13 scored** via GPT-4o — 7 A-grade, 3 B-grade, 3 D-grade leads
- **Average score**: 69.9/100
- **All embedded** in Pinecone — semantic search and similarity working
- **Full UI functional** — dashboard, sortable table, detail pages all rendering correctly

---

## 3. Architecture Decisions & Why

### Why Dual Database (SQLite + Pinecone)?

**SQLite** handles structured queries: sort by score, filter by certification, paginate, aggregate stats. It's what you'd use Postgres for in production — fast, zero config, perfect for a demo.

**Pinecone** handles semantic capabilities: "find contractors similar to X", natural language search over enrichment data, RAG context for AI scoring. This demonstrates understanding of when vector DBs add value vs when relational DBs are sufficient.

**Interview talking point**: "In production, SQLite becomes Postgres for concurrent writes, multi-user access, and ACID guarantees. Pinecone stays as-is since it's already serverless and horizontally scalable."

### Why Perplexity for Enrichment (not OpenAI)?

Perplexity Sonar searches the **live web** and returns grounded, cited information. OpenAI would hallucinate company details. Perplexity gives us real revenue estimates, actual BBB ratings, real news — not made-up data.

**Interview talking point**: "I chose Perplexity because enrichment requires real-time web data, not parametric knowledge. GPT would hallucinate that a 5-person company has $50M revenue."

### Why Voyage AI for Embeddings (not OpenAI)?

Voyage-3 produces 1024-dim vectors optimized for retrieval tasks. It's what we used in the previous InstaLily project (partselect-agent), so it's a proven stack. Also demonstrates breadth — not just "use OpenAI for everything."

**Fallback**: If Voyage has issues, swap to OpenAI `text-embedding-3-small` (1536 dims, update Pinecone index dimension).

### Why FastAPI (not Express/Flask)?

- Async by default — critical for AI pipeline orchestration (concurrent API calls)
- Pydantic integration — structured validation for AI outputs
- Auto-generated API docs at `/docs` — impressive in demo
- BackgroundTasks — pipeline runs without blocking API
- Type hints everywhere — clean, self-documenting code

### Why TanStack Table (not just HTML table)?

- Built-in sorting state management
- Server-side sorting (we control the SQL ORDER BY)
- Column header click handlers with sort direction indicators
- Professional — shows you know production React patterns

### Why Shadcn/ui?

- Pre-built, polished components (looks like a real product immediately)
- Customizable (not a black box like Material UI)
- Uses Tailwind underneath — easy to tweak
- Table, Card, Badge, Button, Skeleton — all needed for this project

---

## 4. Step-by-Step Build Playbook

This is the exact order to build if doing it again. Optimized for speed.

### Phase 0: Bootstrap (20-30 min)

```bash
# 1. Create project structure
mkdir -p roofing-intelligence/backend/app/{scraper,ai,vectordb,routers}

# 2. Backend setup
cd roofing-intelligence/backend
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn sqlalchemy aiosqlite playwright openai httpx pydantic-settings python-dotenv pinecone voyageai
playwright install chromium

# 3. Frontend setup (in parallel terminal)
cd roofing-intelligence
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack --no-react-compiler
cd frontend
npx shadcn@latest init -d
npx shadcn@latest add table card badge button input select skeleton tabs separator dialog -y
npm install @tanstack/react-table lucide-react recharts

# 4. Create .env files with API keys
```

**CRITICAL**: Have API keys ready BEFORE the interview starts. Create accounts and generate keys the night before.

### Phase 1: Backend Core (30 min)

Write these files in order (each builds on the previous):
1. `config.py` — Pydantic settings, `get_settings()` with `@lru_cache`
2. `database.py` — Async engine, session maker, `Base`, `init_db()`, `get_db()`
3. `models.py` — Contractor model with all columns (core, enrichment, scoring)
4. `schemas.py` — Pydantic models for API responses
5. `main.py` — FastAPI app, CORS, lifespan, router includes

**Test**: `python -c "from app.main import app; print('OK')"` — must pass before moving on.

### Phase 2: Scraper (30-45 min)

This is the trickiest part. Key learnings:
1. GAF blocks headless browsers (Akamai WAF)
2. Must use `headless=False` (headed mode)
3. Must use state-based URL: `/residential/usa/ny/new-york` (NOT query params `?zipcode=10013`)
4. Must remove webdriver flag: `navigator.webdriver = undefined`
5. Contractors are in `<article>` elements
6. Data format per article: company name (line 1), rating (line 2), city/state/distance (line 3), phone (after "Phone Number:")

**Test**: Run scraper standalone, verify it returns contractor dicts with company names.

### Phase 3: Vector DB + AI Pipeline (1-1.5 hrs)

Write in order:
1. `vectordb/pinecone_client.py` — Singleton, auto-create index
2. `vectordb/embeddings.py` — Voyage AI wrapper, `embed_batch()`, `embed_query()`
3. `vectordb/search.py` — `semantic_search()`, `get_similar_contractors()`, `get_rag_context()`
4. `ai/enrichment.py` — Perplexity Sonar wrapper
5. `ai/scoring.py` — GPT-4o scoring with RAG context
6. `ai/pipeline.py` — Full orchestration with status tracking

**Test**: Trigger pipeline via API, watch status endpoint, verify data in SQLite.

### Phase 4: API Routes (30 min)

1. `routers/contractors.py` — CRUD with sort/filter/paginate + semantic search + similar
2. `routers/scraping.py` — Pipeline trigger + status
3. `routers/dashboard.py` — Aggregate stats

**Test**: `curl http://localhost:8000/api/contractors` should return paginated list.

### Phase 5: Frontend (1.5-2 hrs)

Priority order (if running low on time, cut from bottom):
1. `lib/types.ts` + `lib/api.ts` — Types and API wrapper (15 min)
2. `components/navbar.tsx` + `app/layout.tsx` — Shell (10 min)
3. `components/lead-score-badge.tsx` — Reusable badge (5 min)
4. **`components/leads-table.tsx`** — THE MOST IMPORTANT PAGE (45 min)
5. `app/leads/page.tsx` — Lead list page (5 min)
6. `app/leads/[id]/page.tsx` — Lead detail page (30 min)
7. `components/dashboard-stats.tsx` — Dashboard with charts (20 min)
8. `app/page.tsx` — Dashboard page (5 min)

**The leads table with sorting is the single most critical UI element.** The interviewer explicitly mentioned "sorting highest to lowest rating." If you run out of time, skip the dashboard and detail page — the table MUST work.

### Phase 6: Integration Test (15-30 min)

1. Start backend: `uvicorn app.main:app --reload --port 8000`
2. Start frontend: `npm run dev`
3. Click "Run Pipeline" → watch it scrape → enrich → score
4. Verify leads table sorts by score (highest first)
5. Click into a lead → verify enrichment + score analysis
6. Try semantic search → verify results
7. Check "Similar Contractors" section

---

## 5. Roadblocks We Hit & Fixes

### Roadblock 1: GAF Returns "Access Denied" (403)

**Problem**: GAF uses Akamai WAF. Both headless Chromium and query-param URLs get blocked.

**Root Cause**: Akamai detects:
- `navigator.webdriver === true` (Playwright default)
- Headless browser fingerprint
- Query parameters in URL trigger stricter bot detection

**Fix (3 things needed)**:
```python
# 1. Headed mode
browser = await p.chromium.launch(headless=False)

# 2. Remove webdriver flag
await context.add_init_script(
    'Object.defineProperty(navigator,"webdriver",{get:()=>undefined})'
)

# 3. Use state-based URL (no query params)
url = "https://www.gaf.com/en-us/roofing-contractors/residential/usa/ny/new-york"
# NOT: "https://www.gaf.com/en-us/roofing-contractors/residential?zipcode=10013"
```

**Time cost**: ~30 minutes debugging. Next time: start with these settings immediately.

### Roadblock 2: Python 3.9 Type Hint Syntax

**Problem**: `list[str]`, `dict[str, int]`, `str | None` syntax requires Python 3.10+. Our system had Python 3.9.

**Fix**: Add `from __future__ import annotations` to every Python file. This makes all type hints strings (deferred evaluation), so modern syntax works.

**Time cost**: ~10 minutes. Next time: add it to every file from the start, or check Python version first.

### Roadblock 3: Voyage AI Rate Limiting (3 RPM)

**Problem**: Free tier Voyage AI limits to 3 requests per minute. Embedding 13 contractors requires multiple API calls.

**Fix**: Two options:
1. Add payment method ($5 credit) → rate limits lifted immediately
2. Process one at a time with 21-second delays (works but slow)

**What we did**: Added $5, rate limits lifted, embedding worked instantly.

**Time cost**: ~15 minutes. Next time: add payment method to Voyage AI before the interview.

### Roadblock 4: Pipeline Crash on Embedding Failure

**Problem**: If Voyage AI rate-limited during the pipeline, the entire pipeline crashed and reported "error" status, even though scraping, enrichment, and scoring had all succeeded.

**Fix**: Wrapped embedding steps in try/except so they're non-fatal:
```python
try:
    embeddings = embed_batch(texts)
    upsert_vectors(vectors)
except Exception as e:
    print(f"Embedding failed (non-fatal): {e}")
```

**Lesson**: AI pipelines should be resilient. Each step should fail gracefully without killing the whole pipeline.

### Roadblock 5: Star Ratings Not Parsing

**Problem**: Regex `r'^(\d\.?\d?)\s*\((\d+)\)'` was too restrictive. Missed ratings like "4.75" or "10.0".

**Fix**: Changed to `r'^(\d+\.?\d*)\s*\((\d+)\)'` — handles any number of digits before and after decimal.

**Lesson**: Always test regex with edge cases. The scraper's text parsing is brittle — spend time getting it right.

### Roadblock 6: Old Next.js Dev Server on Port 3000

**Problem**: Previous InstaLily project's dev server was still running on port 3000.

**Fix**: `lsof -i :3000` to find the PID, then `kill <PID>`.

**Lesson**: Always check if ports are in use before starting. `lsof -i :3000` and `lsof -i :8000`.

---

## 6. Key Code Patterns to Reuse

### Pattern 1: Pydantic Settings with .env

```python
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    openai_api_key: str = ""
    model_config = {"env_file": ".env"}

@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

### Pattern 2: Async SQLite with SQLAlchemy

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
engine = create_async_engine("sqlite+aiosqlite:///./app.db")
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

### Pattern 3: Pinecone Singleton

```python
_index = None
def get_index():
    global _index
    if _index is None:
        pc = Pinecone(api_key=settings.pinecone_api_key)
        existing = [idx.name for idx in pc.list_indexes()]
        if index_name not in existing:
            pc.create_index(name=index_name, dimension=1024, metric="cosine",
                          spec=ServerlessSpec(cloud="aws", region="us-east-1"))
        _index = pc.Index(index_name)
    return _index
```

### Pattern 4: Perplexity as OpenAI-compatible client

```python
from openai import AsyncOpenAI
client = AsyncOpenAI(api_key=perplexity_key, base_url="https://api.perplexity.ai")
response = await client.chat.completions.create(model="sonar", messages=[...])
```

### Pattern 5: GPT-4o Structured JSON Output

```python
response = await client.chat.completions.create(
    model="gpt-4o",
    messages=[...],
    response_format={"type": "json_object"},
    temperature=0.3,
)
data = json.loads(response.choices[0].message.content)
```

### Pattern 6: FastAPI Background Pipeline with Status

```python
pipeline_status = PipelineStatus(status="idle")

@router.post("/run-pipeline")
async def trigger(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_full_pipeline)
    return {"message": "started"}

@router.get("/status")
async def status():
    return pipeline_status
```

### Pattern 7: TanStack Table with Server-Side Sorting

```typescript
const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,  // We handle sorting on the server
    state: { sorting },
    onSortingChange: setSorting,
});
```

### Pattern 8: Playwright Stealth Scraping

```python
browser = await p.chromium.launch(headless=False, args=["--disable-blink-features=AutomationControlled"])
context = await browser.new_context(
    user_agent="Mozilla/5.0 ... Chrome/131.0.0.0 ...",
    viewport={"width": 1920, "height": 1080},
    locale="en-US",
)
await context.add_init_script('Object.defineProperty(navigator,"webdriver",{get:()=>undefined})')
```

---

## 7. What Impressed vs What Needs Work

### What Works Well (Demo-Ready)

1. **Full pipeline in one click** — "Run Pipeline" button scrapes, enriches, scores, embeds. Live status updates.
2. **Rich enrichment data** — Perplexity provides real revenue, BBB ratings, employee counts. Not hallucinated.
3. **AI score rationale** — Each lead has strengths, weaknesses, recommended actions, buying signals. The interviewer can see WHY a lead is good.
4. **Semantic search** — Natural language queries backed by Pinecone. "Find large commercial roofers" actually works.
5. **Similar contractors** — Demonstrates practical vector similarity. Shows embeddings knowledge.
6. **Sortable table** — Default sort by score (highest first). Column headers toggle sort direction with visual indicators.
7. **Professional UI** — Shadcn + Tailwind looks production-quality out of the box.
8. **Clean code structure** — Clear separation: scraper / vectordb / enrichment / scoring / API / frontend.

### What Could Be Better (Mention as "Production Improvements")

1. **More contractors** — Currently scrapes only first page (~10-14). Production would paginate through all 216.
2. **Website URLs** — Not scraped. Would need to visit each contractor's GAF profile page.
3. **Star ratings** — Sometimes null because the text format varies. More robust parsing needed.
4. **Error handling in UI** — No toast notifications for errors. Should add `react-hot-toast` or similar.
5. **Loading states** — Skeleton loaders exist but could be more polished.
6. **Caching** — No caching layer. Production would add Redis for API response caching.
7. **Authentication** — No auth. Production would add NextAuth or similar.
8. **Testing** — No unit tests. Production would add pytest + vitest.
9. **Logging** — Only print statements. Production would use structured logging.
10. **Docker** — No containerization. Production would have Dockerfile + docker-compose.

---

## 8. Speed Run Strategy for Onsite

### The Night Before

- [ ] Verify all API keys work (OpenAI, Perplexity, Pinecone, Voyage AI)
- [ ] Verify Voyage AI has payment method added (avoids 3 RPM limit)
- [ ] Verify Python 3.9+ and Node 18+ installed
- [ ] Have this IMPORTANT.md open for reference
- [ ] Have the practice project open for copy-paste of code patterns
- [ ] Pre-install Playwright Chromium: `playwright install chromium`

### Time Allocation (6-7 hours)

| Time | Phase | Duration |
|------|-------|----------|
| 9:00-9:30 | Read assignment, bootstrap project, install deps | 30 min |
| 9:30-10:15 | Backend core (config, DB, models, schemas, main) | 45 min |
| 10:15-11:00 | Scraper (adapt to whatever website they give) | 45 min |
| 11:00-12:00 | AI pipeline (enrichment + scoring + embeddings) | 60 min |
| 12:00-12:30 | API routes | 30 min |
| 12:30-1:00 | LUNCH / TEST BACKEND | 30 min |
| 1:00-2:30 | Frontend (leads table FIRST, then detail, then dashboard) | 90 min |
| 2:30-3:15 | Integration testing, fix bugs | 45 min |
| 3:15-4:00 | Polish, README, production notes | 45 min |

### If Running Behind Schedule

**Cut (in order)**:
1. Dashboard charts → just show stat numbers
2. Similar contractors feature → skip Pinecone similarity
3. Semantic search → just use keyword search
4. Dashboard page entirely → go straight to leads list

**Never cut**:
- Lead list with sorting (explicitly required)
- AI scoring with rationale (the core value prop)
- Enrichment (shows AI orchestration skills)

### First 30 Minutes Checklist

```bash
# 1. Read assignment carefully. Note the specific website URL.
# 2. Create project structure
mkdir -p project/backend/app/{scraper,ai,vectordb,routers}

# 3. Backend
cd project/backend
python3 -m venv venv && source venv/bin/activate
pip install fastapi uvicorn sqlalchemy aiosqlite playwright openai httpx pydantic-settings python-dotenv pinecone voyageai
playwright install chromium

# 4. Frontend (parallel terminal)
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack --no-react-compiler
cd frontend
npx shadcn@latest init -d
npx shadcn@latest add table card badge button input skeleton separator -y
npm install @tanstack/react-table lucide-react recharts

# 5. Create .env with API keys (HAVE THESE READY)
# 6. Create __init__.py files for all packages
# 7. Start coding config.py → database.py → models.py
```

---

## 9. Technical Talking Points

### When They Ask About Scraping

"GAF is a JavaScript SPA with Akamai WAF protection. Plain HTTP requests return 403. I used Playwright with Chromium in headed mode, removed the webdriver fingerprint, and used state-based URL patterns instead of query parameters which trigger stricter bot detection. I capture data from rendered `<article>` DOM elements with regex parsing for structured fields."

"In production, I'd add: proxy rotation, request throttling, retry logic with exponential backoff, and a monitoring dashboard for scrape health."

### When They Ask About Embeddings

"I use Voyage AI's voyage-3 model which produces 1024-dimensional vectors optimized for retrieval tasks. Each contractor is embedded as a concatenated text string of all their fields — name, certification, location, enrichment summary, specialties, revenue. These vectors are stored in Pinecone with metadata for hybrid filtering."

"At query time, the user's natural language query is embedded with `input_type='query'` (Voyage optimizes differently for queries vs documents), then we do cosine similarity search in Pinecone to find the most semantically relevant contractors."

"Under the hood, embeddings capture semantic meaning — so 'large commercial roofing company' will match contractors with high revenue and commercial specialties, even if those exact words don't appear in their profile."

### When They Ask About RAG

"Before scoring each contractor, I pull the top 3 most similar already-scored contractors from Pinecone as context. This gives GPT-4o reference points — 'contractors like X scored 85 because of Y.' This makes scoring more consistent and contextually aware."

"The RAG pipeline is: embed query → search Pinecone → retrieve relevant context → inject into LLM prompt → get grounded response."

### When They Ask About the Scoring Model

"I use GPT-4o with structured JSON output. The scoring prompt includes weighted criteria: GAF certification (25%), company size/revenue (20%), online presence/reviews (15%), geographic proximity (10%), years in business (15%), and residential roofing focus (15%). The model returns not just a number, but a rationale, strengths, weaknesses, recommended actions, and buying signals."

"The structured output ensures consistency — every contractor gets the same analysis format, making it easy to compare and sort."

### When They Ask About Database Design

"I use a dual-database architecture. SQLite (Postgres in production) for structured queries — sorting, filtering, pagination, aggregation. Pinecone for semantic capabilities — natural language search, similarity matching, RAG context retrieval."

"The Contractor model has three sections: core scraped data, enrichment fields (from Perplexity), and scoring fields (from GPT-4o). Each section has a timestamp so we know when data was last updated."

### When They Ask About Scalability

"For hundreds of sales reps: the API is stateless and horizontally scalable. SQLite becomes Postgres. The pipeline would use a task queue (Celery/Redis) instead of BackgroundTasks. Pinecone is already serverless and auto-scales."

"For thousands of contractors: batch processing with chunked API calls, rate limiting with token buckets, incremental updates (only re-enrich stale data), and caching with Redis."

---

## 10. If the Task Changes

### Different Website (Not GAF)

The scraper will need to be rewritten, but the approach is the same:
1. Open the site in a real browser first. Inspect the DOM.
2. Check if it's a SPA (JavaScript-rendered) or static HTML.
3. If SPA: use Playwright. If static: `httpx` with BeautifulSoup is faster.
4. Look for API calls in the Network tab — intercepting JSON APIs is cleaner than DOM parsing.
5. Check for anti-bot protection (Cloudflare, Akamai, reCAPTCHA).

**Key adaptation**: The `_parse_article_text()` function is GAF-specific. You'll need to inspect the new site's DOM and write a new parser. But the Playwright setup, anti-detection, and save-to-DB logic are reusable.

### Different Industry (Not Roofing)

Change:
- The scoring prompt (update criteria and weights)
- The enrichment prompt (ask for industry-relevant data)
- The SQLite schema (different fields for different industries)
- The frontend labels and terminology

Don't change:
- The pipeline architecture (scrape → embed → enrich → score)
- The dual database approach
- The API structure
- The frontend components (table, detail page, dashboard)

### If They Want Real-Time Chat / Q&A

Add a chat endpoint that uses RAG:
1. Embed the user's question with Voyage AI
2. Search Pinecone for relevant contractors
3. Pass the results as context to GPT-4o
4. Stream the response back

This is a natural extension of what we already built.

### If They Want Email/CRM Integration

- Add a "Generate Email" button on lead detail page
- Use GPT-4o to draft a personalized outreach email based on the lead's enrichment data
- Show email in a modal for the rep to review/edit before sending

---

## 11. API Keys & Services Checklist

| Service | Purpose | Free Tier? | Key Prefix |
|---------|---------|-----------|------------|
| OpenAI | Lead scoring (GPT-4o) | Pay-per-use | `sk-proj-` |
| Perplexity | Enrichment (Sonar) | Pay-per-use | `pplx-` |
| Pinecone | Vector DB | Yes (2M writes) | `pcsk_` |
| Voyage AI | Embeddings (voyage-3) | 200M free tokens | `pa-` |

**Pre-interview setup**:
1. OpenAI: Ensure you have credits. $5 minimum.
2. Perplexity: Create account at perplexity.ai/settings/api. Add payment method.
3. Pinecone: Free tier is plenty. Create account, grab API key.
4. Voyage AI: Add payment method to avoid 3 RPM rate limit. $5 minimum.

**Total cost for the interview**: ~$2-5 in API calls (13 contractors × 4 API calls each).

---

## 12. Common Pitfalls to Avoid

### Scraping Pitfalls

- **Don't use headless mode** on protected sites. Always start with `headless=False`.
- **Don't use query params** in URLs if the site has WAF. Use path-based URLs.
- **Don't forget `from __future__ import annotations`** if Python < 3.10.
- **Don't skip anti-detection**. Always set realistic user agent, remove webdriver flag, set viewport.
- **Test the scraper first** before building everything else. If scraping fails, everything fails.

### AI Pipeline Pitfalls

- **Don't let one failure kill the whole pipeline**. Wrap each step in try/except.
- **Don't forget rate limiting**. Add delays between API calls.
- **Don't skip structured output**. Use `response_format={"type": "json_object"}` with GPT-4o.
- **Don't send too much text to embeddings**. Truncate long summaries to ~500 chars in metadata.
- **Perplexity's first request with a new schema takes 10-30s** (warm-up). Don't panic.

### Frontend Pitfalls

- **Don't forget CORS** on the backend. Add `http://localhost:3000` to allowed origins.
- **Don't forget null checks**. Backend fields can be null — always use `??` or `.filter(Boolean)`.
- **Don't build the dashboard first**. Build the leads table first — it's the most important page.
- **Default sort must be score DESC** (highest to lowest). The interviewer specifically looks for this.

### General Pitfalls

- **Don't over-engineer**. Ship a working product, not a perfect architecture.
- **Don't forget to kill old dev servers**. `lsof -i :3000` before starting.
- **Don't put API keys in code**. Always use `.env` files.
- **Test end-to-end early**. Don't wait until hour 5 to run the pipeline for the first time.

---

## Quick Reference: Key Commands

```bash
# Start backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Start frontend
cd frontend && npm run dev

# Check what's on a port
lsof -i :3000
lsof -i :8000

# Kill a process on a port
kill $(lsof -t -i :3000)

# Trigger pipeline
curl -X POST http://localhost:8000/api/scraping/run-pipeline

# Check pipeline status
curl http://localhost:8000/api/scraping/status

# Check API docs
open http://localhost:8000/docs

# Frontend build check
cd frontend && npm run build
```

---

## Final Notes

This practice run proved the architecture works end-to-end. The biggest time risk is the **scraper** — every website is different and debugging selectors/anti-bot takes time. Everything else (AI pipeline, API, frontend) is fairly templated and can be built quickly from these patterns.

The key differentiators that make this solution impressive:
1. **Dual database** (structured + semantic) — shows architectural thinking
2. **RAG-enhanced scoring** — not just "call GPT", but grounded in similar data
3. **Score rationale with strengths/weaknesses** — actionable for sales reps
4. **Semantic search** — practical use of embeddings beyond just storage
5. **Live pipeline with status updates** — production-quality UX
6. **Clean separation of concerns** — scraper / vectordb / AI / API / frontend

Good luck on the onsite. You've already built this once — now do it faster.
