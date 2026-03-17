from __future__ import annotations
import asyncio
import json
from datetime import datetime
from sqlalchemy import select
from app.database import async_session
from app.models import Contractor
from app.scraper.gaf_scraper import scrape_gaf_contractors, save_contractors_to_db, clear_contractors_db
from app.vectordb.embeddings import embed_text, embed_batch
from app.vectordb.pinecone_client import upsert_vectors, get_index
from app.ai.enrichment import enrich_contractor
from app.ai.scoring import score_contractor
from app.schemas import PipelineStatus

# Global pipeline state
pipeline_status = PipelineStatus(status="idle")


def get_pipeline_status() -> PipelineStatus:
    return pipeline_status


def _contractor_to_text(c: Contractor) -> str:
    """Create a text representation for embedding."""
    parts = [f"Company: {c.company_name}"]
    if c.certification_level:
        parts.append(f"Certification: {c.certification_level}")
    if c.city and c.state:
        parts.append(f"Location: {c.city}, {c.state}")
    if c.star_rating:
        parts.append(f"Rating: {c.star_rating} stars ({c.review_count} reviews)")
    if c.enrichment_summary:
        parts.append(f"Summary: {c.enrichment_summary}")
    if c.specialties:
        try:
            specs = json.loads(c.specialties)
            parts.append(f"Specialties: {', '.join(specs)}")
        except (json.JSONDecodeError, TypeError):
            parts.append(f"Specialties: {c.specialties}")
    if c.estimated_revenue:
        parts.append(f"Revenue: {c.estimated_revenue}")
    if c.employee_count:
        parts.append(f"Employees: {c.employee_count}")
    return " | ".join(parts)


async def reset_data():
    """Clear SQLite contractors table and Pinecone index for clean re-runs."""
    # Clear database
    deleted = await clear_contractors_db()
    print(f"Reset: deleted {deleted} contractors from DB")

    # Clear Pinecone
    try:
        index = get_index()
        index.delete(delete_all=True)
        print("Reset: cleared Pinecone index")
    except Exception as e:
        print(f"Reset: Pinecone clear failed (non-fatal): {e}")


async def _retry_async(func, *args, max_attempts=2, delay=3, label="operation"):
    """Retry an async function up to max_attempts times."""
    for attempt in range(max_attempts):
        try:
            return await func(*args)
        except Exception as e:
            if attempt < max_attempts - 1:
                print(f"Retry {attempt + 1}/{max_attempts} for {label}: {e}")
                await asyncio.sleep(delay)
            else:
                raise


async def run_full_pipeline(zip_code: str = "10013"):
    """Full pipeline: reset → scrape → embed → enrich → score."""
    global pipeline_status

    try:
        # Step 0: Reset DB + Pinecone for clean run
        pipeline_status = PipelineStatus(status="resetting", progress="Clearing old data...")
        await reset_data()

        # Step 1: Scrape
        pipeline_status = PipelineStatus(status="scraping", progress="Scraping GAF contractors...")
        contractors_data = await scrape_gaf_contractors(zip_code)
        saved_count = await save_contractors_to_db(contractors_data)
        pipeline_status.total_scraped = len(contractors_data)
        pipeline_status.progress = f"Scraped {len(contractors_data)} contractors, saved {saved_count} new"

        # Step 2: Load all contractors from DB
        async with async_session() as session:
            result = await session.execute(select(Contractor))
            all_contractors = result.scalars().all()

        if not all_contractors:
            pipeline_status = PipelineStatus(status="error", error="No contractors found after scraping")
            return

        total_failed = 0

        # Step 3: Initial embedding + Pinecone upsert (pre-enrichment)
        pipeline_status.status = "embedding"
        pipeline_status.progress = "Generating embeddings..."
        try:
            texts = [_contractor_to_text(c) for c in all_contractors]
            embeddings = embed_batch(texts)

            vectors = []
            for c, emb in zip(all_contractors, embeddings):
                metadata = {
                    "contractor_id": c.id,
                    "company_name": c.company_name,
                    "certification_level": c.certification_level or "",
                    "city": c.city or "",
                    "state": c.state or "",
                    "lead_score": c.lead_score or 0,
                    "lead_grade": c.lead_grade or "",
                }
                vectors.append({"id": str(c.id), "values": emb, "metadata": metadata})

            upsert_vectors(vectors)
        except Exception as e:
            print(f"Initial embedding failed (non-fatal, continuing): {e}")

        # Step 4: Enrich (with retry)
        pipeline_status.status = "enriching"
        enriched = 0
        for c in all_contractors:
            pipeline_status.progress = f"Enriching {enriched + 1}/{len(all_contractors)}: {c.company_name}"
            try:
                data = await _retry_async(
                    enrich_contractor, c.company_name, c.city, c.state,
                    label=f"enrich {c.company_name}"
                )
                async with async_session() as session:
                    db_contractor = await session.get(Contractor, c.id)
                    if db_contractor:
                        db_contractor.enrichment_summary = data.summary
                        db_contractor.estimated_revenue = data.estimated_revenue
                        db_contractor.employee_count = data.employee_count
                        db_contractor.years_in_business = data.years_in_business
                        db_contractor.specialties = json.dumps(data.specialties) if data.specialties else None
                        db_contractor.online_presence_score = data.online_presence_score
                        db_contractor.recent_news = data.recent_news
                        db_contractor.bbb_rating = data.bbb_rating
                        db_contractor.enriched_at = datetime.utcnow()
                        await session.commit()
                enriched += 1
                pipeline_status.total_enriched = enriched
            except Exception as e:
                total_failed += 1
                pipeline_status.total_failed = total_failed
                print(f"Enrichment failed for {c.company_name} after retries: {e}")
            await asyncio.sleep(1)  # Rate limiting

        # Step 5: Score (RAG-enhanced, with retry)
        pipeline_status.status = "scoring"
        scored = 0
        for c in all_contractors:
            pipeline_status.progress = f"Scoring {scored + 1}/{len(all_contractors)}: {c.company_name}"
            try:
                # Reload from DB to get enrichment data
                async with async_session() as session:
                    db_c = await session.get(Contractor, c.id)
                    if not db_c:
                        continue
                    specialties = []
                    if db_c.specialties:
                        try:
                            specialties = json.loads(db_c.specialties)
                        except (json.JSONDecodeError, TypeError):
                            pass

                    score_data = None
                    for _attempt in range(2):
                        try:
                            score_data = await score_contractor(
                                company_name=db_c.company_name,
                                certification_level=db_c.certification_level,
                                star_rating=db_c.star_rating,
                                review_count=db_c.review_count,
                                distance_miles=db_c.distance_miles,
                                enrichment_summary=db_c.enrichment_summary,
                                estimated_revenue=db_c.estimated_revenue,
                                employee_count=db_c.employee_count,
                                years_in_business=db_c.years_in_business,
                                online_presence_score=db_c.online_presence_score,
                                bbb_rating=db_c.bbb_rating,
                                specialties=specialties,
                            )
                            break
                        except Exception as retry_err:
                            if _attempt == 0:
                                print(f"Scoring retry for {c.company_name}: {retry_err}")
                                await asyncio.sleep(3)
                            else:
                                raise

                    if score_data is None:
                        continue

                    db_c.lead_score = score_data.lead_score
                    db_c.lead_grade = score_data.lead_grade
                    db_c.score_rationale = score_data.rationale
                    db_c.score_strengths = json.dumps(score_data.strengths)
                    db_c.score_weaknesses = json.dumps(score_data.weaknesses)
                    db_c.recommended_action = score_data.recommended_action
                    db_c.buying_signals = json.dumps(score_data.buying_signals)
                    db_c.scored_at = datetime.utcnow()
                    await session.commit()

                scored += 1
                pipeline_status.total_scored = scored
            except Exception as e:
                total_failed += 1
                pipeline_status.total_failed = total_failed
                print(f"Scoring failed for {c.company_name} after retries: {e}")

        # Step 6: Re-embed with enrichment data and update Pinecone
        pipeline_status.status = "finalizing"
        pipeline_status.progress = "Updating embeddings with enrichment data..."
        try:
            async with async_session() as session:
                result = await session.execute(select(Contractor))
                all_contractors = result.scalars().all()

            texts = [_contractor_to_text(c) for c in all_contractors]
            embeddings = embed_batch(texts)

            vectors = []
            for c, emb in zip(all_contractors, embeddings):
                metadata = {
                    "contractor_id": c.id,
                    "company_name": c.company_name,
                    "certification_level": c.certification_level or "",
                    "city": c.city or "",
                    "state": c.state or "",
                    "lead_score": c.lead_score or 0,
                    "lead_grade": c.lead_grade or "",
                    "enrichment_summary": (c.enrichment_summary or "")[:500],
                }
                vectors.append({"id": str(c.id), "values": emb, "metadata": metadata})

            upsert_vectors(vectors)
        except Exception as e:
            print(f"Embedding/Pinecone upsert failed (non-fatal): {e}")

        pipeline_status = PipelineStatus(
            status="complete",
            progress="Pipeline complete!",
            total_scraped=len(contractors_data),
            total_enriched=enriched,
            total_scored=scored,
            total_failed=total_failed,
        )

    except Exception as e:
        pipeline_status = PipelineStatus(status="error", error=str(e))
        raise
