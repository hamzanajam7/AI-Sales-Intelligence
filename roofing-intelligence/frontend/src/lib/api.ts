import type {
  ContractorListResponse,
  ContractorDetail,
  DashboardStats,
  PipelineStatus,
  SemanticSearchResult,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getContractors(params: {
  sort_by?: string;
  sort_order?: string;
  certification?: string;
  min_score?: number;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<ContractorListResponse> {
  const searchParams = new URLSearchParams();
  if (params.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params.sort_order) searchParams.set("sort_order", params.sort_order);
  if (params.certification) searchParams.set("certification", params.certification);
  if (params.min_score !== undefined) searchParams.set("min_score", String(params.min_score));
  if (params.search) searchParams.set("search", params.search);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.page_size) searchParams.set("page_size", String(params.page_size));
  return fetchAPI<ContractorListResponse>(`/api/contractors?${searchParams}`);
}

export async function getContractor(id: number): Promise<ContractorDetail> {
  return fetchAPI<ContractorDetail>(`/api/contractors/${id}`);
}

export async function getSimilarContractors(id: number): Promise<SemanticSearchResult[]> {
  return fetchAPI<SemanticSearchResult[]>(`/api/contractors/${id}/similar`);
}

export async function semanticSearch(query: string): Promise<SemanticSearchResult[]> {
  return fetchAPI<SemanticSearchResult[]>(`/api/contractors/search?q=${encodeURIComponent(query)}`);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return fetchAPI<DashboardStats>("/api/dashboard/stats");
}

export async function runPipeline(zipCode: string = "10013"): Promise<{ message: string }> {
  return fetchAPI<{ message: string }>(`/api/scraping/run-pipeline?zip_code=${zipCode}`, {
    method: "POST",
  });
}

export async function getPipelineStatus(): Promise<PipelineStatus> {
  return fetchAPI<PipelineStatus>("/api/scraping/status");
}

export async function enrichContractor(id: number): Promise<{ status: string }> {
  return fetchAPI<{ status: string }>(`/api/contractors/${id}/enrich`, { method: "POST" });
}

export async function scoreContractor(id: number): Promise<{ status: string; score: number }> {
  return fetchAPI<{ status: string; score: number }>(`/api/contractors/${id}/score`, { method: "POST" });
}

export async function rescoreWithWeights(weights: Record<string, number>): Promise<{ message: string }> {
  return fetchAPI<{ message: string }>("/api/scraping/rescore", {
    method: "POST",
    body: JSON.stringify(weights),
  });
}
