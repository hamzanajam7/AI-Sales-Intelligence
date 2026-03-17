from __future__ import annotations
import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.schemas import ScoringData
from app.vectordb.search import get_rag_context


def get_openai_client() -> AsyncOpenAI:
    settings = get_settings()
    return AsyncOpenAI(api_key=settings.openai_api_key)


async def score_contractor(
    company_name: str,
    certification_level: str = None,
    star_rating: float = None,
    review_count: int = 0,
    distance_miles: float = None,
    enrichment_summary: str = None,
    estimated_revenue: str = None,
    employee_count: str = None,
    years_in_business: int = None,
    online_presence_score: int = None,
    bbb_rating: str = None,
    specialties: list[str] = None,
) -> ScoringData:
    """Score a contractor lead using GPT-4o with RAG context from Pinecone."""
    client = get_openai_client()

    # Get RAG context from similar contractors in Pinecone
    rag_context = ""
    try:
        rag_context = get_rag_context(f"{company_name} roofing contractor", top_k=3)
    except Exception:
        pass

    contractor_profile = f"""
Company: {company_name}
GAF Certification: {certification_level or 'Unknown'}
Star Rating: {star_rating or 'N/A'} ({review_count} reviews)
Distance: {distance_miles or 'N/A'} miles from target area
Enrichment Summary: {enrichment_summary or 'Not enriched'}
Estimated Revenue: {estimated_revenue or 'Unknown'}
Employee Count: {employee_count or 'Unknown'}
Years in Business: {years_in_business or 'Unknown'}
Online Presence Score: {online_presence_score or 'N/A'}/10
BBB Rating: {bbb_rating or 'N/A'}
Specialties: {', '.join(specialties) if specialties else 'Unknown'}
"""

    rag_section = ""
    if rag_context:
        rag_section = f"""

SIMILAR CONTRACTORS FOR REFERENCE:
{rag_context}
"""

    prompt = f"""You are a B2B sales intelligence analyst for a roofing materials distributor (GAF).
Score this roofing contractor as a potential sales lead on a scale of 0-100.

CONTRACTOR PROFILE:
{contractor_profile}
{rag_section}

SCORING CRITERIA (weight in parentheses):
- GAF Certification Level (25%): Master Elite > President's Club > Triple Excellence > Certified > None
- Company Size & Revenue (20%): Larger companies = more materials purchased
- Online Presence & Reviews (15%): Strong presence = established business, good reputation
- Geographic Proximity (10%): Closer to distribution center = lower logistics cost
- Years in Business (15%): More established = more reliable partner
- Residential Roofing Focus (15%): Alignment with GAF's residential products

Return your analysis as JSON:
{{
    "lead_score": <0-100>,
    "lead_grade": "<A/B/C/D/F>",
    "rationale": "<2-3 sentence explanation of why this score>",
    "strengths": ["strength 1", "strength 2", ...],
    "weaknesses": ["weakness 1", "weakness 2", ...],
    "recommended_action": "<specific next step for sales team>",
    "buying_signals": ["signal 1", "signal 2", ...]
}}

Grade thresholds: A=80-100, B=60-79, C=40-59, D=20-39, F=0-19
Only return valid JSON."""

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a B2B sales scoring AI. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content.strip()
        data = json.loads(content)

        return ScoringData(
            lead_score=max(0, min(100, int(data.get("lead_score", 50)))),
            lead_grade=data.get("lead_grade", "C"),
            rationale=data.get("rationale", ""),
            strengths=data.get("strengths", []),
            weaknesses=data.get("weaknesses", []),
            recommended_action=data.get("recommended_action", ""),
            buying_signals=data.get("buying_signals", []),
        )

    except Exception as e:
        print(f"Scoring failed for {company_name}: {e}")
        return ScoringData(
            lead_score=50,
            lead_grade="C",
            rationale=f"Auto-scored: scoring failed ({str(e)})",
            strengths=[],
            weaknesses=["Scoring error"],
            recommended_action="Manual review required",
        )
