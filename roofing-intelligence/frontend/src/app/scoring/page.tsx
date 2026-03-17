"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { rescoreWithWeights, getPipelineStatus } from "@/lib/api";
import { Loader2, RotateCcw, Play } from "lucide-react";
import type { PipelineStatus } from "@/lib/types";

interface CriterionConfig {
  key: string;
  name: string;
  description: string;
  tiers: string[];
}

const criteriaConfig: CriterionConfig[] = [
  {
    key: "certification",
    name: "GAF Certification Level",
    description:
      "Higher GAF certifications indicate stronger partnerships, more training, and greater commitment to quality roofing.",
    tiers: [
      "Master Elite (top 2%)",
      "President's Club",
      "Triple Excellence",
      "GAF Certified (baseline)",
    ],
  },
  {
    key: "company_size",
    name: "Company Size & Revenue",
    description:
      "Larger companies with higher revenue purchase more roofing materials. Estimated through AI enrichment.",
    tiers: [
      "$10M+ revenue, 50+ employees",
      "$5M-$10M, 20-50 employees",
      "$1M-$5M, 10-20 employees",
      "Under $1M or unknown",
    ],
  },
  {
    key: "online_presence",
    name: "Online Presence & Reviews",
    description:
      "Strong online presence signals an established, reputable business with consistent project volume.",
    tiers: [
      "4.8+ stars, 200+ reviews",
      "4.5-4.8 stars, 100+ reviews",
      "4.0-4.5 stars, 50+ reviews",
      "Under 4.0 stars or few reviews",
    ],
  },
  {
    key: "years_in_business",
    name: "Years in Business",
    description:
      "More established contractors are more reliable partners with predictable purchasing patterns.",
    tiers: [
      "20+ years",
      "10-20 years",
      "5-10 years",
      "Under 5 years or unknown",
    ],
  },
  {
    key: "residential_focus",
    name: "Residential Roofing Focus",
    description:
      "Contractors focused on residential roofing are the best fit for GAF's product line.",
    tiers: [
      "Primarily residential roofing",
      "Mixed residential/commercial",
      "Primarily commercial",
      "General contractor",
    ],
  },
  {
    key: "geographic_proximity",
    name: "Geographic Proximity",
    description:
      "Contractors closer to distribution centers have lower logistics costs.",
    tiers: [
      "Within 15 miles",
      "15-30 miles",
      "30-50 miles",
      "50+ miles",
    ],
  },
];

const defaultWeights: Record<string, number> = {
  certification: 25,
  company_size: 20,
  online_presence: 15,
  years_in_business: 15,
  residential_focus: 15,
  geographic_proximity: 10,
};

const gradeScale = [
  {
    grade: "A",
    range: "80-100",
    color: "bg-green-500",
    label: "Hot Lead",
    description:
      "High-value prospect. Prioritize for immediate outreach.",
  },
  {
    grade: "B",
    range: "60-79",
    color: "bg-blue-500",
    label: "Warm Lead",
    description:
      "Good potential. Schedule for outreach within the quarter.",
  },
  {
    grade: "C",
    range: "40-59",
    color: "bg-yellow-500",
    label: "Neutral",
    description:
      "Average prospect. Monitor and nurture over time.",
  },
  {
    grade: "D",
    range: "20-39",
    color: "bg-orange-500",
    label: "Low Priority",
    description:
      "Below-average. Low conversion probability.",
  },
  {
    grade: "F",
    range: "0-19",
    color: "bg-red-500",
    label: "Not Qualified",
    description:
      "Poor fit. Deprioritize entirely.",
  },
];

export default function ScoringPage() {
  const [weights, setWeights] = useState<Record<string, number>>({ ...defaultWeights });
  const [rescoring, setRescoring] = useState(false);
  const [status, setStatus] = useState<PipelineStatus | null>(null);

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const hasChanges = JSON.stringify(weights) !== JSON.stringify(defaultWeights);

  const pollStatus = useCallback(async () => {
    try {
      const s = await getPipelineStatus();
      setStatus(s);
      if (s.status === "complete" || s.status === "error" || s.status === "idle") {
        setRescoring(false);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!rescoring) return;
    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [rescoring, pollStatus]);

  const handleRescore = async () => {
    try {
      setRescoring(true);
      await rescoreWithWeights(weights);
      pollStatus();
    } catch {
      setRescoring(false);
    }
  };

  const handleReset = () => {
    setWeights({ ...defaultWeights });
  };

  const updateWeight = (key: string, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Scoring Criteria</h1>
        <p className="text-muted-foreground mt-1">
          Adjust the weights to change how contractors are scored, then re-analyze all leads.
        </p>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How Lead Scoring Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Each contractor is scored on a <strong>0-100 scale</strong> by GPT-4o, using
            scraped data from the GAF directory and AI-enriched company intelligence.
            The model uses <strong>RAG (Retrieval-Augmented Generation)</strong> — pulling
            similar contractors from our Pinecone vector database as reference points for
            consistent, calibrated scoring.
          </p>
          <p>
            Use the sliders below to adjust how much each factor matters. Click{" "}
            <strong>Re-Score All Leads</strong> to re-analyze every contractor with your
            custom weights.
          </p>
        </CardContent>
      </Card>

      {/* Weight Adjustment + Rescore */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Scoring Weights</CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant={totalWeight === 100 ? "default" : "destructive"}
                className="text-sm"
              >
                Total: {totalWeight}%
              </Badge>
              {hasChanges && (
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {criteriaConfig.map((criterion) => (
            <div key={criterion.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">{criterion.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {criterion.description}
                  </p>
                </div>
                <span className="text-lg font-bold w-14 text-right">
                  {weights[criterion.key]}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                value={weights[criterion.key]}
                onChange={(e) => updateWeight(criterion.key, Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                {criterion.tiers.map((tier, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        i === 0
                          ? "bg-green-500"
                          : i === 1
                            ? "bg-blue-500"
                            : i === 2
                              ? "bg-yellow-500"
                              : "bg-red-400"
                      }`}
                    />
                    {tier}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Rescore button */}
          <div className="pt-4 border-t">
            {totalWeight !== 100 && (
              <p className="text-sm text-red-600 mb-3">
                Weights must add up to 100% (currently {totalWeight}%). Adjust before re-scoring.
              </p>
            )}
            {rescoring && status && (
              <p className="text-sm text-muted-foreground mb-3">
                {status.progress} ({status.total_scored} scored)
              </p>
            )}
            <Button
              onClick={handleRescore}
              disabled={rescoring || totalWeight !== 100}
              className="w-full"
            >
              {rescoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Re-Scoring... ({status?.total_scored || 0} done)
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Re-Score All Leads with These Weights
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grade Scale */}
      <Card>
        <CardHeader>
          <CardTitle>Grade Scale</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {gradeScale.map((g) => (
              <div
                key={g.grade}
                className="flex items-start gap-4 p-3 rounded-lg border"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0 ${g.color}`}
                >
                  {g.grade}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{g.label}</span>
                    <Badge variant="outline">{g.range} points</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {g.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Data Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 rounded-lg border space-y-1">
              <h4 className="font-semibold">GAF Directory (Scraped)</h4>
              <p className="text-muted-foreground">
                Company name, certification level, star rating, review count,
                location, distance, phone number, GAF profile URL.
              </p>
            </div>
            <div className="p-3 rounded-lg border space-y-1">
              <h4 className="font-semibold">AI Enrichment (Perplexity)</h4>
              <p className="text-muted-foreground">
                Revenue estimate, employee count, years in business,
                specialties, online presence score, BBB rating, recent news.
              </p>
            </div>
            <div className="p-3 rounded-lg border space-y-1">
              <h4 className="font-semibold">AI Scoring (GPT-4o + RAG)</h4>
              <p className="text-muted-foreground">
                Lead score, grade, rationale, strengths, weaknesses,
                recommended action, buying signals.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
