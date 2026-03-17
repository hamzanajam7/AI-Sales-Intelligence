from __future__ import annotations
from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ContractorBase(BaseModel):
    gaf_id: Optional[str] = None
    company_name: str
    certification_level: Optional[str] = None
    address_full: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    gaf_profile_url: Optional[str] = None
    star_rating: Optional[float] = None
    review_count: int = 0
    distance_miles: Optional[float] = None


class ContractorListItem(ContractorBase):
    id: int
    lead_score: Optional[int] = None
    lead_grade: Optional[str] = None
    enrichment_summary: Optional[str] = None

    class Config:
        from_attributes = True


class ContractorDetail(ContractorBase):
    id: int
    enrichment_summary: Optional[str] = None
    estimated_revenue: Optional[str] = None
    employee_count: Optional[str] = None
    years_in_business: Optional[int] = None
    specialties: Optional[list[str]] = None
    online_presence_score: Optional[int] = None
    recent_news: Optional[str] = None
    bbb_rating: Optional[str] = None
    enriched_at: Optional[datetime] = None
    lead_score: Optional[int] = None
    lead_grade: Optional[str] = None
    score_rationale: Optional[str] = None
    score_strengths: Optional[list[str]] = None
    score_weaknesses: Optional[list[str]] = None
    recommended_action: Optional[str] = None
    buying_signals: Optional[list[str]] = None
    scored_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContractorListResponse(BaseModel):
    contractors: list[ContractorListItem]
    total: int
    page: int
    page_size: int


class DashboardStats(BaseModel):
    total_contractors: int
    avg_score: Optional[float] = None
    hot_leads: int  # A grade
    enriched_pct: float
    grade_distribution: dict[str, int]
    certification_breakdown: dict[str, int]
    top_leads: list[ContractorListItem]


class PipelineStatus(BaseModel):
    status: str  # idle, resetting, scraping, enriching, scoring, complete, error
    progress: Optional[str] = None
    total_scraped: int = 0
    total_enriched: int = 0
    total_scored: int = 0
    total_failed: int = 0
    error: Optional[str] = None


class SemanticSearchResult(BaseModel):
    contractor_id: int
    company_name: str
    score: float
    certification_level: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    lead_score: Optional[int] = None
    lead_grade: Optional[str] = None
    enrichment_summary: Optional[str] = None


class EnrichmentData(BaseModel):
    estimated_revenue: Optional[str] = None
    employee_count: Optional[str] = None
    years_in_business: Optional[int] = None
    specialties: list[str] = []
    online_presence_score: Optional[int] = None
    recent_news: Optional[str] = None
    bbb_rating: Optional[str] = None
    summary: str = ""


class ScoringData(BaseModel):
    lead_score: int
    lead_grade: str
    rationale: str
    strengths: list[str]
    weaknesses: list[str]
    recommended_action: str
    buying_signals: list[str] = []
