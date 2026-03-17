# Roofing Lead Intelligence Platform

An AI-powered lead intelligence platform that scrapes, enriches, scores, and ranks roofing contractors to identify high-value sales prospects. Built as an onsite assignment for Instalily.

## Features

- **Automated Scraping** — Extracts contractor listings from the GAF directory using Playwright browser automation with stealth mode
- **AI Enrichment** — Researches each contractor via Perplexity Sonar to surface revenue estimates, employee count, years in business, BBB rating, specialties, and more
- **RAG-Powered Scoring** — Scores leads 0–100 using GPT-4o with retrieval-augmented generation, pulling similar contractors from Pinecone as calibration context
- **Semantic Search** — Natural language search across all contractors powered by Voyage AI embeddings and Pinecone vector similarity
- **Interactive Dashboard** — Real-time KPIs, grade distribution charts, certification breakdowns, and pipeline controls
- **Adjustable Scoring Weights** — Tune the 6 scoring criteria via sliders and re-score all leads instantly

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI, SQLAlchemy (async), SQLite |
| **Frontend** | Next.js 16, React 19, TailwindCSS 4, shadcn/ui, Recharts |
| **Scraping** | Playwright (headless Chromium) |
| **Enrichment** | Perplexity Sonar API |
| **Scoring** | GPT-4o with structured JSON output |
| **Embeddings** | Voyage AI (`voyage-3`, 1024-dim) |
| **Vector DB** | Pinecone (serverless, cosine similarity) |

## Architecture

```
Scraping (Playwright → GAF Directory)
    ↓
Initial Embedding (Voyage AI → Pinecone)
    ↓
Enrichment (Perplexity Sonar → revenue, employees, BBB, specialties)
    ↓
Scoring (GPT-4o + RAG context from Pinecone → 0-100 score, A-F grade)
    ↓
Re-Embedding (updated vectors with enrichment metadata → Pinecone)
    ↓
Frontend (Next.js dashboard, lead table, detail views, scoring config)
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — KPIs, charts, pipeline trigger, top leads |
| `/leads` | Lead table — sortable, filterable, paginated, with semantic search |
| `/leads/[id]` | Lead detail — profile, enrichment data, score breakdown, similar contractors |
| `/scoring` | Scoring criteria — weight sliders, grade scale, data source reference |

## API Endpoints

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |

### Contractors (`/api/contractors`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List contractors (sort, filter, search, paginate) |
| GET | `/search?q=...` | Semantic search via natural language |
| GET | `/{id}` | Get contractor detail |
| GET | `/{id}/similar` | Find similar contractors (vector similarity) |
| POST | `/{id}/enrich` | Enrich a single contractor |
| POST | `/{id}/score` | Score a single contractor |

### Pipeline (`/api/scraping`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/run-pipeline` | Run full pipeline (scrape → enrich → score → embed) |
| GET | `/status` | Get pipeline status and progress |
| POST | `/rescore` | Re-score all contractors with custom weights |
| POST | `/reset` | Clear all data |

### Dashboard (`/api/dashboard`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | Dashboard statistics (KPIs, distributions, top leads) |

## Database Schema

The `Contractor` model stores everything in a single SQLite table:

| Category | Fields |
|----------|--------|
| **Identity** | `id`, `gaf_id`, `company_name` |
| **GAF Data** | `certification_level`, `star_rating`, `review_count`, `distance_miles`, `gaf_profile_url` |
| **Location** | `address_full`, `city`, `state`, `zip_code` |
| **Contact** | `phone`, `website` |
| **Enrichment** | `enrichment_summary`, `estimated_revenue`, `employee_count`, `years_in_business`, `specialties`, `online_presence_score`, `recent_news`, `bbb_rating`, `enriched_at` |
| **Scoring** | `lead_score`, `lead_grade`, `score_rationale`, `score_strengths`, `score_weaknesses`, `recommended_action`, `buying_signals`, `scored_at` |

## Scoring Criteria (Default Weights)

| Criterion | Weight | What It Measures |
|-----------|--------|-----------------|
| Certification Level | 25% | GAF Master Elite > President's Club > Triple Excellence > Certified |
| Company Size | 20% | Revenue and employee count |
| Online Presence | 15% | Website quality, social media, reviews |
| Years in Business | 15% | How long the company has been operating |
| Residential Focus | 15% | Alignment with residential roofing products |
| Geographic Proximity | 10% | Distance to target distribution area |

## Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- API keys for: OpenAI, Perplexity, Pinecone, Voyage AI

### Backend

```bash
cd roofing-intelligence/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

Create a `.env` file:

```
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
PINECONE_API_KEY=pcsk_...
VOYAGE_API_KEY=pa-...
DATABASE_URL=sqlite+aiosqlite:///./roofing_leads.db
PINECONE_INDEX_NAME=roofing-leads
```

Run the server:

```bash
uvicorn app.main:app --reload
```

### Frontend

```bash
cd roofing-intelligence/frontend
npm install
```

Create a `.env.local` file:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and trigger the pipeline from the dashboard with a ZIP code (default: 10013 for NYC).
