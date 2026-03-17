"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { LeadScoreBadge } from "@/components/lead-score-badge";
import {
  getContractor,
  getSimilarContractors,
  enrichContractor,
  scoreContractor,
} from "@/lib/api";
import type { ContractorDetail, SemanticSearchResult } from "@/lib/types";
import {
  ArrowLeft,
  Phone,
  Globe,
  MapPin,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Star,
  Building2,
  DollarSign,
  Users,
  Clock,
  Shield,
  TrendingUp,
  Loader2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { GRADE_CIRCLE_COLORS } from "@/lib/constants";

export default function LeadDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [contractor, setContractor] = useState<ContractorDetail | null>(null);
  const [similar, setSimilar] = useState<SemanticSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [data, sim] = await Promise.allSettled([
          getContractor(id),
          getSimilarContractors(id),
        ]);
        if (data.status === "fulfilled") setContractor(data.value);
        if (sim.status === "fulfilled") setSimilar(sim.value);
      } catch {
        //
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      await enrichContractor(id);
      const data = await getContractor(id);
      setContractor(data);
    } finally {
      setEnriching(false);
    }
  };

  const handleScore = async () => {
    setScoring(true);
    try {
      await scoreContractor(id);
      const data = await getContractor(id);
      setContractor(data);
    } finally {
      setScoring(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <Skeleton className="h-64" />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!contractor) {
    return <p className="text-muted-foreground">Contractor not found.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/leads">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{contractor.company_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {contractor.certification_level && (
                <Badge>{contractor.certification_level}</Badge>
              )}
              {contractor.star_rating && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  {contractor.star_rating.toFixed(1)} ({contractor.review_count}{" "}
                  reviews)
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleEnrich} disabled={enriching}>
            {enriching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Re-Enrich
          </Button>
          <Button variant="outline" size="sm" onClick={handleScore} disabled={scoring}>
            {scoring ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <TrendingUp className="h-4 w-4 mr-1" />}
            Re-Score
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - 60% */}
        <div className="lg:col-span-3 space-y-6">
          {/* AI Score Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                AI Score Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {contractor.lead_score !== null ? (
                <>
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold ${
                        GRADE_CIRCLE_COLORS[contractor.lead_grade || "C"]
                      }`}
                    >
                      {contractor.lead_grade}
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{contractor.lead_score}/100</p>
                      <p className="text-sm text-muted-foreground">Lead Score</p>
                    </div>
                  </div>

                  {contractor.score_rationale && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm font-medium mb-1">Rationale</p>
                      <p className="text-sm text-muted-foreground">
                        {contractor.score_rationale}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contractor.score_strengths && contractor.score_strengths.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Strengths</p>
                        <ul className="space-y-1">
                          {contractor.score_strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {contractor.score_weaknesses && contractor.score_weaknesses.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Weaknesses</p>
                        <ul className="space-y-1">
                          {contractor.score_weaknesses.map((w, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {contractor.recommended_action && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Lightbulb className="h-4 w-4 text-blue-600" />
                        <p className="text-sm font-medium text-blue-900">
                          Recommended Action
                        </p>
                      </div>
                      <p className="text-sm text-blue-800">
                        {contractor.recommended_action}
                      </p>
                    </div>
                  )}

                  {contractor.buying_signals && contractor.buying_signals.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Buying Signals</p>
                      <div className="flex flex-wrap gap-2">
                        {contractor.buying_signals.map((signal, i) => (
                          <Badge key={i} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {signal}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Not scored yet. Click &quot;Re-Score&quot; to generate an AI analysis.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - 40% */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Intelligence */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />
                Company Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contractor.enrichment_summary ? (
                <>
                  <p className="text-sm">{contractor.enrichment_summary}</p>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3">
                    {contractor.estimated_revenue && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Revenue</p>
                          <p className="text-sm font-medium">{contractor.estimated_revenue}</p>
                        </div>
                      </div>
                    )}
                    {contractor.employee_count && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Employees</p>
                          <p className="text-sm font-medium">{contractor.employee_count}</p>
                        </div>
                      </div>
                    )}
                    {contractor.years_in_business && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Years</p>
                          <p className="text-sm font-medium">{contractor.years_in_business} yrs</p>
                        </div>
                      </div>
                    )}
                    {contractor.bbb_rating && (
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">BBB</p>
                          <p className="text-sm font-medium">{contractor.bbb_rating}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {contractor.online_presence_score && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Online Presence ({contractor.online_presence_score}/10)
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${contractor.online_presence_score * 10}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {contractor.specialties && contractor.specialties.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Specialties</p>
                      <div className="flex flex-wrap gap-1">
                        {contractor.specialties.map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not enriched yet. Click &quot;Re-Enrich&quot; to research this company.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {contractor.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${contractor.phone}`} className="hover:underline">
                    {contractor.phone}
                  </a>
                </div>
              )}
              {contractor.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={contractor.website.startsWith("http") ? contractor.website : `https://${contractor.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline truncate"
                  >
                    {contractor.website}
                  </a>
                </div>
              )}
              {contractor.address_full && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {contractor.address_full}
                    {contractor.distance_miles != null &&
                      ` — ${contractor.distance_miles.toFixed(1)} mi`}
                  </span>
                </div>
              )}
              {contractor.gaf_profile_url && (
                <div className="flex items-center gap-2 text-sm">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={contractor.gaf_profile_url.startsWith("http") ? contractor.gaf_profile_url : `https://www.gaf.com${contractor.gaf_profile_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    GAF Profile
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent News */}
          {contractor.recent_news && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent News</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{contractor.recent_news}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Similar Contractors */}
      {similar.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Similar Contractors (Pinecone Vector Search)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {similar.map((s) => (
                <Link
                  key={s.contractor_id}
                  href={`/leads/${s.contractor_id}`}
                  className="p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <p className="font-medium text-sm">{s.company_name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {s.certification_level ?? "No cert"} •{" "}
                    {[s.city, s.state].filter(Boolean).join(", ")}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {(s.score * 100).toFixed(1)}% similar
                    </span>
                    <LeadScoreBadge score={s.lead_score} grade={s.lead_grade} />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
