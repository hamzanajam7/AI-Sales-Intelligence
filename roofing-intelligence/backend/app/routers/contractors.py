from __future__ import annotations
import json
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc
from app.database import get_db
from app.models import Contractor
from app.schemas import ContractorListItem, ContractorListResponse, ContractorDetail, SemanticSearchResult

router = APIRouter(prefix="/api/contractors", tags=["contractors"])


def _parse_json_field(value: Optional[str]) -> list[str]:
    if not value:
        return []
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return []


def _contractor_to_list_item(c: Contractor) -> ContractorListItem:
    return ContractorListItem(
        id=c.id,
        gaf_id=c.gaf_id,
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


def _contractor_to_detail(c: Contractor) -> ContractorDetail:
    return ContractorDetail(
        id=c.id,
        gaf_id=c.gaf_id,
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
        enrichment_summary=c.enrichment_summary,
        estimated_revenue=c.estimated_revenue,
        employee_count=c.employee_count,
        years_in_business=c.years_in_business,
        specialties=_parse_json_field(c.specialties),
        online_presence_score=c.online_presence_score,
        recent_news=c.recent_news,
        bbb_rating=c.bbb_rating,
        enriched_at=c.enriched_at,
        lead_score=c.lead_score,
        lead_grade=c.lead_grade,
        score_rationale=c.score_rationale,
        score_strengths=_parse_json_field(c.score_strengths),
        score_weaknesses=_parse_json_field(c.score_weaknesses),
        recommended_action=c.recommended_action,
        buying_signals=_parse_json_field(c.buying_signals),
        scored_at=c.scored_at,
        created_at=c.created_at,
    )


@router.get("", response_model=ContractorListResponse)
async def list_contractors(
    sort_by: str = Query("lead_score", description="Field to sort by"),
    sort_order: str = Query("desc", description="asc or desc"),
    certification: str = Query(None, description="Filter by certification level"),
    min_score: int = Query(None, description="Minimum lead score"),
    search: str = Query(None, description="Search by company name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(Contractor)

    # Filters
    if certification:
        query = query.where(Contractor.certification_level == certification)
    if min_score is not None:
        query = query.where(Contractor.lead_score >= min_score)
    if search:
        query = query.where(Contractor.company_name.ilike(f"%{search}%"))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Sort
    sort_column = getattr(Contractor, sort_by, Contractor.lead_score)
    if sort_order == "desc":
        query = query.order_by(desc(sort_column).nulls_last())
    else:
        query = query.order_by(asc(sort_column).nulls_last())

    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    contractors = result.scalars().all()

    return ContractorListResponse(
        contractors=[_contractor_to_list_item(c) for c in contractors],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/search", response_model=list[SemanticSearchResult])
async def semantic_search_contractors(
    q: str = Query(..., description="Natural language search query"),
    top_k: int = Query(10, ge=1, le=50),
):
    from app.vectordb.search import semantic_search
    try:
        return semantic_search(q, top_k=top_k)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Semantic search unavailable: {str(e)}")


@router.get("/{contractor_id}", response_model=ContractorDetail)
async def get_contractor(contractor_id: int, db: AsyncSession = Depends(get_db)):
    contractor = await db.get(Contractor, contractor_id)
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    return _contractor_to_detail(contractor)


@router.get("/{contractor_id}/similar", response_model=list[SemanticSearchResult])
async def get_similar(contractor_id: int, top_k: int = Query(5, ge=1, le=20)):
    from app.vectordb.search import get_similar_contractors
    try:
        return get_similar_contractors(contractor_id, top_k=top_k)
    except Exception:
        return []


@router.post("/{contractor_id}/enrich")
async def enrich_single(contractor_id: int, db: AsyncSession = Depends(get_db)):
    from app.ai.enrichment import enrich_contractor
    from datetime import datetime

    contractor = await db.get(Contractor, contractor_id)
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")

    data = await enrich_contractor(contractor.company_name, contractor.city, contractor.state)
    contractor.enrichment_summary = data.summary
    contractor.estimated_revenue = data.estimated_revenue
    contractor.employee_count = data.employee_count
    contractor.years_in_business = data.years_in_business
    contractor.specialties = json.dumps(data.specialties) if data.specialties else None
    contractor.online_presence_score = data.online_presence_score
    contractor.recent_news = data.recent_news
    contractor.bbb_rating = data.bbb_rating
    contractor.enriched_at = datetime.utcnow()
    await db.commit()

    return {"status": "enriched", "contractor_id": contractor_id}


@router.post("/{contractor_id}/score")
async def score_single(contractor_id: int, db: AsyncSession = Depends(get_db)):
    from app.ai.scoring import score_contractor
    from datetime import datetime

    contractor = await db.get(Contractor, contractor_id)
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")

    specialties = _parse_json_field(contractor.specialties)
    score_data = await score_contractor(
        company_name=contractor.company_name,
        certification_level=contractor.certification_level,
        star_rating=contractor.star_rating,
        review_count=contractor.review_count,
        distance_miles=contractor.distance_miles,
        enrichment_summary=contractor.enrichment_summary,
        estimated_revenue=contractor.estimated_revenue,
        employee_count=contractor.employee_count,
        years_in_business=contractor.years_in_business,
        online_presence_score=contractor.online_presence_score,
        bbb_rating=contractor.bbb_rating,
        specialties=specialties,
    )

    contractor.lead_score = score_data.lead_score
    contractor.lead_grade = score_data.lead_grade
    contractor.score_rationale = score_data.rationale
    contractor.score_strengths = json.dumps(score_data.strengths)
    contractor.score_weaknesses = json.dumps(score_data.weaknesses)
    contractor.recommended_action = score_data.recommended_action
    contractor.buying_signals = json.dumps(score_data.buying_signals)
    contractor.scored_at = datetime.utcnow()
    await db.commit()

    return {"status": "scored", "contractor_id": contractor_id, "score": score_data.lead_score}
