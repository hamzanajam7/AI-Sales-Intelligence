from __future__ import annotations
import time
import voyageai
from app.config import get_settings

_client = None


def get_voyage_client() -> voyageai.Client:
    global _client
    if _client is None:
        settings = get_settings()
        _client = voyageai.Client(api_key=settings.voyage_api_key)
    return _client


def embed_text(text: str) -> list[float]:
    """Embed a single text string using Voyage AI voyage-3."""
    client = get_voyage_client()
    result = client.embed([text], model="voyage-3", input_type="document")
    return result.embeddings[0]


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts using Voyage AI voyage-3."""
    client = get_voyage_client()
    all_embeddings = []
    batch_size = 50
    for i in range(0, len(texts), batch_size):
        if i > 0:
            time.sleep(1)
        batch = texts[i:i + batch_size]
        result = client.embed(batch, model="voyage-3", input_type="document")
        all_embeddings.extend(result.embeddings)
        print(f"Embedded {min(i + batch_size, len(texts))}/{len(texts)}")
    return all_embeddings


def embed_query(text: str) -> list[float]:
    """Embed a query string (uses input_type='query' for better retrieval)."""
    client = get_voyage_client()
    result = client.embed([text], model="voyage-3", input_type="query")
    return result.embeddings[0]
