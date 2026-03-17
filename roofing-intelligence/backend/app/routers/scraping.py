from __future__ import annotations
from fastapi import APIRouter, BackgroundTasks
from app.ai.pipeline import run_full_pipeline, get_pipeline_status, reset_data
from app.schemas import PipelineStatus

router = APIRouter(prefix="/api/scraping", tags=["scraping"])


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
