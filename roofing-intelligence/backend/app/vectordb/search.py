from __future__ import annotations
from app.vectordb.embeddings import embed_query
from app.vectordb.pinecone_client import query_vectors
from app.schemas import SemanticSearchResult


def semantic_search(query: str, top_k: int = 10) -> list[SemanticSearchResult]:
    """Search contractors semantically using natural language query."""
    query_vector = embed_query(query)
    results = query_vectors(query_vector, top_k=top_k)

    search_results = []
    for match in results.matches:
        meta = match.metadata or {}
        search_results.append(SemanticSearchResult(
            contractor_id=int(meta.get("contractor_id", 0)),
            company_name=meta.get("company_name", "Unknown"),
            score=match.score,
            certification_level=meta.get("certification_level"),
            city=meta.get("city"),
            state=meta.get("state"),
            lead_score=int(meta.get("lead_score")) if meta.get("lead_score") else None,
            lead_grade=meta.get("lead_grade"),
            enrichment_summary=meta.get("enrichment_summary"),
        ))
    return search_results


def get_similar_contractors(contractor_id: int, top_k: int = 5) -> list[SemanticSearchResult]:
    """Find contractors similar to the given one using vector similarity."""
    from app.vectordb.pinecone_client import get_index
    index = get_index()

    # Fetch the contractor's vector
    fetch_result = index.fetch(ids=[str(contractor_id)])
    vectors = fetch_result.vectors
    if str(contractor_id) not in vectors:
        return []

    vector = vectors[str(contractor_id)].values
    results = query_vectors(
        vector,
        top_k=top_k + 1,  # +1 because it will match itself
    )

    search_results = []
    for match in results.matches:
        if match.id == str(contractor_id):
            continue
        meta = match.metadata or {}
        search_results.append(SemanticSearchResult(
            contractor_id=int(meta.get("contractor_id", 0)),
            company_name=meta.get("company_name", "Unknown"),
            score=match.score,
            certification_level=meta.get("certification_level"),
            city=meta.get("city"),
            state=meta.get("state"),
            lead_score=int(meta.get("lead_score")) if meta.get("lead_score") else None,
            lead_grade=meta.get("lead_grade"),
            enrichment_summary=meta.get("enrichment_summary"),
        ))
    return search_results[:top_k]


def get_rag_context(query: str, top_k: int = 3) -> str:
    """Retrieve RAG context from Pinecone for AI scoring."""
    results = semantic_search(query, top_k=top_k)
    if not results:
        return ""

    context_parts = []
    for r in results:
        parts = [f"Company: {r.company_name}"]
        if r.certification_level:
            parts.append(f"Certification: {r.certification_level}")
        if r.lead_score:
            parts.append(f"Score: {r.lead_score} ({r.lead_grade})")
        if r.enrichment_summary:
            parts.append(f"Summary: {r.enrichment_summary}")
        context_parts.append(" | ".join(parts))

    return "\n".join(context_parts)
