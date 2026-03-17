from __future__ import annotations
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    openai_api_key: str = ""
    perplexity_api_key: str = ""
    pinecone_api_key: str = ""
    voyage_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./roofing_leads.db"
    pinecone_index_name: str = "roofing-leads"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
