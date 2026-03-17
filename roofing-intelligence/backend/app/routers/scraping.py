from __future__ import annotations
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from app.ai.pipeline import run_full_pipeline, get_pipeline_status, reset_data, rescore_all_contractors
from app.schemas import PipelineStatus

router = APIRouter(prefix="/api/scraping", tags=["scraping"])


class RescoreRequest(BaseModel):
    certification: int = 25
    company_size: int = 20
    online_presence: int = 15
    geographic_proximity: int = 10
    years_in_business: int = 15
    residential_focus: int = 15


@router.post("/run-pipeline")
async def trigger_pipeline(background_tasks: BackgroundTasks, zip_code: str = "10013"):
    status = get_pipeline_status()
    if status.status not in ("idle", "complete", "error"):
        return {"message": "Pipeline already running", "status": status.status}

    background_tasks.add_task(run_full_pipeline, zip_code)
    return {"message": "Pipeline started", "zip_code": zip_code}


@router.get("/status", response_model=PipelineStatus)
async def pipeline_status():
    return get_pipeline_status()


@router.post("/reset")
async def reset_pipeline_data():
    """Clear SQLite + Pinecone for clean re-runs."""
    try:
        await reset_data()
        return {"message": "Database and Pinecone index cleared"}
    except Exception as e:
        return {"message": f"Reset partially failed: {str(e)}"}


@router.post("/rescore")
async def rescore_with_weights(body: RescoreRequest, background_tasks: BackgroundTasks):
    """Re-score all contractors with custom weights."""
    status = get_pipeline_status()
    if status.status not in ("idle", "complete", "error"):
        return {"message": "Pipeline already running", "status": status.status}

    weights = body.model_dump()
    background_tasks.add_task(rescore_all_contractors, weights)
    return {"message": "Re-scoring started", "weights": weights}
