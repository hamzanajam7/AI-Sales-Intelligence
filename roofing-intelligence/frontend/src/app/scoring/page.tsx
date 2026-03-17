import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const scoringCriteria = [
  {
    name: "GAF Certification Level",
    weight: 25,
    description:
      "Higher GAF certifications indicate stronger partnerships, more training, and greater commitment to quality roofing. These contractors purchase more materials and are better long-term partners.",
    tiers: [
      "Master Elite (top 2% of contractors nationwide)",
      "President's Club (exceptional performance + customer satisfaction)",
      "Triple Excellence (3 consecutive years of excellence)",
      "GAF Certified (baseline certification)",
      "No certification (lowest priority)",
    ],
  },
  {
    name: "Company Size & Revenue",
    weight: 20,
    description:
      "Larger companies with higher revenue purchase more roofing materials. We estimate revenue and employee count through AI enrichment research.",
    tiers: [
      "$10M+ revenue, 50+ employees",
      "$5M-$10M revenue, 20-50 employees",
      "$1M-$5M revenue, 10-20 employees",
      "Under $1M revenue or unknown",
    ],
  },
  {
    name: "Online Presence & Reviews",
    weight: 15,
    description:
      "Strong online presence signals an established, reputable business. Higher star ratings and review counts indicate customer trust and consistent project volume.",
    tiers: [
      "4.8+ stars with 200+ reviews",
      "4.5-4.8 stars with 100+ reviews",
      "4.0-4.5 stars with 50+ reviews",
      "Under 4.0 stars or few reviews",
    ],
  },
  {
    name: "Years in Business",
    weight: 15,
    description:
      "More established contractors are more reliable partners with predictable purchasing patterns and lower churn risk.",
    tiers: [
      "20+ years in business",
      "10-20 years in business",
      "5-10 years in business",
      "Under 5 years or unknown",
    ],
  },
  {
    name: "Residential Roofing Focus",
    weight: 15,
    description:
      "Contractors focused on residential roofing are the best fit for GAF's product line. Specialties in shingle installation, roof replacement, and residential services score higher.",
    tiers: [
      "Primary focus on residential roofing",
      "Mixed residential and commercial",
      "Primarily commercial or industrial",
      "General contractor, roofing is secondary",
    ],
  },
  {
    name: "Geographic Proximity",
    weight: 10,
    description:
      "Contractors closer to distribution centers have lower logistics costs, making them more profitable to serve.",
    tiers: [
      "Within 15 miles",
      "15-30 miles",
      "30-50 miles",
      "50+ miles",
    ],
  },
];

const gradeScale = [
  {
    grade: "A",
    range: "80-100",
    color: "bg-green-500",
    label: "Hot Lead",
    description:
      "High-value prospect. Strong certification, established business, excellent reviews. Prioritize for immediate outreach.",
  },
  {
    grade: "B",
    range: "60-79",
    color: "bg-blue-500",
    label: "Warm Lead",
    description:
      "Good potential partner. Solid fundamentals with room for growth. Schedule for outreach within the quarter.",
  },
  {
    grade: "C",
    range: "40-59",
    color: "bg-yellow-500",
    label: "Neutral",
    description:
      "Average prospect. May lack certification, reviews, or online presence. Monitor and nurture over time.",
  },
  {
    grade: "D",
    range: "20-39",
    color: "bg-orange-500",
    label: "Low Priority",
    description:
      "Below-average prospect. Limited information, poor reviews, or misaligned specialties. Low conversion probability.",
  },
  {
    grade: "F",
    range: "0-19",
    color: "bg-red-500",
    label: "Not Qualified",
    description:
      "Poor fit. Missing critical data, no certification, or significant red flags. Deprioritize entirely.",
  },
];

export default function ScoringPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Scoring Criteria</h1>
        <p className="text-muted-foreground mt-1">
          How we classify roofing contractors from hot leads to low priority
          using AI-powered analysis.
        </p>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How Lead Scoring Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Each contractor is scored on a <strong>0-100 scale</strong> by GPT-4o, using a
            combination of scraped data from the GAF directory and AI-enriched
            company intelligence. The model uses{" "}
            <strong>RAG (Retrieval-Augmented Generation)</strong> — pulling similar
            contractors from our Pinecone vector database as reference points to
            ensure consistent, calibrated scoring.
          </p>
          <p>
            The scoring prompt instructs the AI to weight six criteria (below),
            then return a numeric score, letter grade, rationale, strengths,
            weaknesses, recommended sales action, and buying signals — all
            structured as JSON for consistent parsing.
          </p>
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

      {/* Scoring Criteria Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Scoring Criteria Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {scoringCriteria.map((criterion) => (
              <div key={criterion.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{criterion.name}</h3>
                  <Badge>{criterion.weight}% weight</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {criterion.description}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${criterion.weight * 4}%` }}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-2">
                  {criterion.tiers.map((tier, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
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
