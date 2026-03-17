from __future__ import annotations
from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Contractor(Base):
    __tablename__ = "contractors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    gaf_id = Column(String, unique=True, nullable=True)
    company_name = Column(String, nullable=False)
    certification_level = Column(String, nullable=True)
    address_full = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    website = Column(String, nullable=True)
    gaf_profile_url = Column(String, nullable=True)
    star_rating = Column(Float, nullable=True)
    review_count = Column(Integer, default=0)
    distance_miles = Column(Float, nullable=True)

    # Enrichment fields
    enrichment_summary = Column(Text, nullable=True)
    estimated_revenue = Column(String, nullable=True)
    employee_count = Column(String, nullable=True)
    years_in_business = Column(Integer, nullable=True)
    specialties = Column(Text, nullable=True)  # JSON array stored as text
    online_presence_score = Column(Integer, nullable=True)  # 1-10
    recent_news = Column(Text, nullable=True)
    bbb_rating = Column(String, nullable=True)
    enriched_at = Column(DateTime, nullable=True)

    # Scoring fields
    lead_score = Column(Integer, nullable=True)  # 0-100
    lead_grade = Column(String(1), nullable=True)  # A-F
    score_rationale = Column(Text, nullable=True)
    score_strengths = Column(Text, nullable=True)  # JSON array
    score_weaknesses = Column(Text, nullable=True)  # JSON array
    recommended_action = Column(String, nullable=True)
    buying_signals = Column(Text, nullable=True)  # JSON array
    scored_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
