export interface Contractor {
  id: number;
  gaf_id: string | null;
  company_name: string;
  certification_level: string | null;
  address_full: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  website: string | null;
  gaf_profile_url: string | null;
  star_rating: number | null;
  review_count: number;
  distance_miles: number | null;
  lead_score: number | null;
  lead_grade: string | null;
  enrichment_summary: string | null;
}

export interface ContractorDetail extends Contractor {
  estimated_revenue: string | null;
  employee_count: string | null;
  years_in_business: number | null;
  specialties: string[] | null;
  online_presence_score: number | null;
  recent_news: string | null;
  bbb_rating: string | null;
  enriched_at: string | null;
  score_rationale: string | null;
  score_strengths: string[] | null;
  score_weaknesses: string[] | null;
  recommended_action: string | null;
  buying_signals: string[] | null;
  scored_at: string | null;
  created_at: string | null;
}

export interface ContractorListResponse {
  contractors: Contractor[];
  total: number;
  page: number;
  page_size: number;
}

export interface DashboardStats {
  total_contractors: number;
  avg_score: number | null;
  hot_leads: number;
  enriched_pct: number;
  grade_distribution: Record<string, number>;
  certification_breakdown: Record<string, number>;
  top_leads: Contractor[];
}

export interface PipelineStatus {
  status: string;
  progress: string | null;
  total_scraped: number;
  total_enriched: number;
  total_scored: number;
  total_failed: number;
  error: string | null;
}

export interface SemanticSearchResult {
  contractor_id: number;
  company_name: string;
  score: number;
  certification_level: string | null;
  city: string | null;
  state: string | null;
  lead_score: number | null;
  lead_grade: string | null;
  enrichment_summary: string | null;
}
