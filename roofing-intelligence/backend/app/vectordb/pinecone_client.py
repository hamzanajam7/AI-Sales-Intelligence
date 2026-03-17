from __future__ import annotations
from pinecone import Pinecone, ServerlessSpec
from app.config import get_settings

_client = None
_index = None


def get_pinecone_client() -> Pinecone:
    global _client
    if _client is None:
        settings = get_settings()
        _client = Pinecone(api_key=settings.pinecone_api_key)
    return _client


def get_index():
    global _index
    if _index is None:
        settings = get_settings()
        pc = get_pinecone_client()
        index_name = settings.pinecone_index_name

        existing = [idx.name for idx in pc.list_indexes()]
        if index_name not in existing:
            pc.create_index(
                name=index_name,
                dimension=1024,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )

        _index = pc.Index(index_name)
    return _index


def upsert_vectors(vectors: list[dict]):
    """Upsert vectors to Pinecone. Each dict: {id, values, metadata}."""
    index = get_index()
    # Batch upsert in chunks of 100
    for i in range(0, len(vectors), 100):
        batch = vectors[i:i + 100]
        index.upsert(vectors=[(v["id"], v["values"], v.get("metadata", {})) for v in batch])


def query_vectors(vector: list[float], top_k: int = 10, filter_dict: dict = None):
    """Query Pinecone for similar vectors."""
    index = get_index()
    return index.query(
        vector=vector,
        top_k=top_k,
        include_metadata=True,
        filter=filter_dict,
    )


def delete_vectors(ids: list[str]):
    """Delete vectors by ID."""
    index = get_index()
    index.delete(ids=ids)
