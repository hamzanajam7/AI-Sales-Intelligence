from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.database import get_db
from app.models import Contractor
from app.schemas import DashboardStats, ContractorListItem

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_stats(db: AsyncSession = Depends(get_db)):
    # Total contractors
    total = (await db.execute(select(func.count(Contractor.id)))).scalar() or 0

    # Average score
    avg_score = (await db.execute(
        select(func.avg(Contractor.lead_score)).where(Contractor.lead_score.isnot(None))
    )).scalar()

    # Hot leads (A grade)
    hot = (await db.execute(
        select(func.count(Contractor.id)).where(Contractor.lead_grade == "A")
    )).scalar() or 0

    # Enriched percentage
    enriched = (await db.execute(
        select(func.count(Contractor.id)).where(Contractor.enriched_at.isnot(None))
    )).scalar() or 0
    enriched_pct = (enriched / total * 100) if total > 0 else 0

    # Grade distribution
    grade_rows = (await db.execute(
        select(Contractor.lead_grade, func.count(Contractor.id))
        .where(Contractor.lead_grade.isnot(None))
        .group_by(Contractor.lead_grade)
    )).all()
    grade_dist = {row[0]: row[1] for row in grade_rows}

    # Certification breakdown
    cert_rows = (await db.execute(
        select(Contractor.certification_level, func.count(Contractor.id))
        .where(Contractor.certification_level.isnot(None))
        .group_by(Contractor.certification_level)
    )).all()
    cert_breakdown = {row[0]: row[1] for row in cert_rows}

    # Top 5 leads
    top_result = await db.execute(
        select(Contractor)
        .where(Contractor.lead_score.isnot(None))
        .order_by(desc(Contractor.lead_score))
        .limit(5)
    )
    top_leads = [
        ContractorListItem(
            id=c.id,
            company_name=c.company_name,
            certification_level=c.certification_level,
            address_full=c.address_full,
            city=c.city,
            state=c.state,
            zip_code=c.zip_code,
            phone=c.phone,
            website=c.website,
            gaf_profile_url=c.gaf_profile_url,
            star_rating=c.star_rating,
            review_count=c.review_count,
            distance_miles=c.distance_miles,
            lead_score=c.lead_score,
            lead_grade=c.lead_grade,
            enrichment_summary=c.enrichment_summary,
        )
        for c in top_result.scalars().all()
    ]

    return DashboardStats(
        total_contractors=total,
        avg_score=round(avg_score, 1) if avg_score else None,
        hot_leads=hot,
        enriched_pct=round(enriched_pct, 1),
        grade_distribution=grade_dist,
        certification_breakdown=cert_breakdown,
        top_leads=top_leads,
    )
