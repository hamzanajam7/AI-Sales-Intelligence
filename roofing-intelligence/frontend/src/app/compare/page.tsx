"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getContractor } from "@/lib/api";
import type { ContractorDetail } from "@/lib/types";
import { GRADE_CIRCLE_COLORS, CERT_RANK } from "@/lib/constants";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

function getWinnerIndex(
  values: (number | null | undefined)[],
  mode: "highest" | "lowest"
): number | null {
  const valid = values.map((v) => (v != null ? v : null));
  const nums = valid.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  const target = mode === "highest" ? Math.max(...nums) : Math.min(...nums);
  const winners = valid.reduce<number[]>((acc, v, i) => {
    if (v === target) acc.push(i);
    return acc;
  }, []);
  return winners.length === 1 ? winners[0] : null;
}

const GRADE_RANK: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };

export default function ComparePage() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") || "";
  const ids = idsParam
    .split(",")
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);

  const [leads, setLeads] = useState<(ContractorDetail | null)[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ids.length < 2) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const results = await Promise.all(
          ids.map((id) => getContractor(id).catch(() => null))
        );
        setLeads(results);
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const validLeads = leads.filter((l): l is ContractorDetail => l !== null);
  if (validLeads.length < 2) {
    return (
      <div className="space-y-4">
        <Link href="/leads">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Leads
          </Button>
        </Link>
        <p className="text-muted-foreground">
          Need at least 2 valid leads to compare. Select leads from the leads table.
        </p>
      </div>
    );
  }

  const colCount = validLeads.length;

  type ComparisonRow = {
    label: string;
    values: (string | number | null)[];
    winnerIdx: number | null;
    type: "value" | "badges" | "bullets";
    listValues?: (string[] | null)[];
  };

  const rows: ComparisonRow[] = [
    {
      label: "Lead Score",
      values: validLeads.map((l) => l.lead_score),
      winnerIdx: getWinnerIndex(validLeads.map((l) => l.lead_score), "highest"),
      type: "value",
    },
    {
      label: "Lead Grade",
      values: validLeads.map((l) => l.lead_grade),
      winnerIdx: getWinnerIndex(
        validLeads.map((l) => GRADE_RANK[l.lead_grade || ""] ?? null),
        "highest"
      ),
      type: "value",
    },
    {
      label: "Certification",
      values: validLeads.map((l) => l.certification_level),
      winnerIdx: getWinnerIndex(
        validLeads.map((l) => CERT_RANK[l.certification_level || ""] ?? null),
        "highest"
      ),
      type: "value",
    },
    {
      label: "Star Rating",
      values: validLeads.map((l) => l.star_rating != null ? l.star_rating.toFixed(1) : null),
      winnerIdx: getWinnerIndex(validLeads.map((l) => l.star_rating), "highest"),
      type: "value",
    },
    {
      label: "Reviews",
      values: validLeads.map((l) => l.review_count),
      winnerIdx: getWinnerIndex(validLeads.map((l) => l.review_count), "highest"),
      type: "value",
    },
    {
      label: "Distance",
      values: validLeads.map((l) => l.distance_miles != null ? `${l.distance_miles.toFixed(1)} mi` : null),
      winnerIdx: getWinnerIndex(validLeads.map((l) => l.distance_miles), "lowest"),
      type: "value",
    },
    {
      label: "Years in Business",
      values: validLeads.map((l) => l.years_in_business),
      winnerIdx: getWinnerIndex(validLeads.map((l) => l.years_in_business), "highest"),
      type: "value",
    },
    {
      label: "Online Presence",
      values: validLeads.map((l) => l.online_presence_score != null ? `${l.online_presence_score}/10` : null),
      winnerIdx: getWinnerIndex(validLeads.map((l) => l.online_presence_score), "highest"),
      type: "value",
    },
    {
      label: "Est. Revenue",
      values: validLeads.map((l) => l.estimated_revenue),
      winnerIdx: null,
      type: "value",
    },
    {
      label: "Employees",
      values: validLeads.map((l) => l.employee_count),
      winnerIdx: null,
      type: "value",
    },
    {
      label: "BBB Rating",
      values: validLeads.map((l) => l.bbb_rating),
      winnerIdx: null,
      type: "value",
    },
    {
      label: "Specialties",
      values: [],
      winnerIdx: null,
      type: "badges",
      listValues: validLeads.map((l) => l.specialties),
    },
    {
      label: "Strengths",
      values: [],
      winnerIdx: null,
      type: "bullets",
      listValues: validLeads.map((l) => l.score_strengths),
    },
    {
      label: "Weaknesses",
      values: [],
      winnerIdx: null,
      type: "bullets",
      listValues: validLeads.map((l) => l.score_weaknesses),
    },
    {
      label: "Buying Signals",
      values: [],
      winnerIdx: null,
      type: "badges",
      listValues: validLeads.map((l) => l.buying_signals),
    },
    {
      label: "Recommended Action",
      values: validLeads.map((l) => l.recommended_action),
      winnerIdx: null,
      type: "value",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/leads">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Leads
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Comparing {validLeads.length} Leads</h1>
      </div>

      {/* Summary Cards */}
      <div className={`grid gap-4 grid-cols-${colCount}`} style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
        {validLeads.map((lead) => (
          <Card key={lead.id}>
            <CardContent className="pt-6 text-center space-y-3">
              <Link
                href={`/leads/${lead.id}`}
                className="text-lg font-semibold hover:underline text-blue-600"
              >
                {lead.company_name}
              </Link>
              {lead.certification_level && (
                <div>
                  <Badge>{lead.certification_level}</Badge>
                </div>
              )}
              {lead.lead_score != null && lead.lead_grade && (
                <div className="flex items-center justify-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold ${
                      GRADE_CIRCLE_COLORS[lead.lead_grade] || "bg-gray-400"
                    }`}
                  >
                    {lead.lead_grade}
                  </div>
                  <span className="text-2xl font-bold">{lead.lead_score}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-3 font-medium text-muted-foreground w-44">
                Category
              </th>
              {validLeads.map((lead) => (
                <th key={lead.id} className="text-left p-3 font-medium">
                  {lead.company_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b">
                <td className="p-3 font-medium text-muted-foreground">
                  {row.label}
                </td>
                {row.type === "value" &&
                  row.values.map((val, i) => {
                    const isWinner = row.winnerIdx === i;
                    return (
                      <td
                        key={i}
                        className={`p-3 ${
                          isWinner
                            ? "bg-green-50 ring-1 ring-inset ring-green-200"
                            : ""
                        }`}
                      >
                        <span className={isWinner ? "font-semibold text-green-800" : ""}>
                          {val != null ? String(val) : "--"}
                        </span>
                      </td>
                    );
                  })}
                {row.type === "badges" &&
                  row.listValues?.map((items, i) => (
                    <td key={i} className="p-3">
                      {items && items.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {items.map((item, j) => (
                            <Badge key={j} variant="secondary" className="text-xs">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                  ))}
                {row.type === "bullets" &&
                  row.listValues?.map((items, i) => (
                    <td key={i} className="p-3">
                      {items && items.length > 0 ? (
                        <ul className="list-disc list-inside space-y-0.5">
                          {items.map((item, j) => (
                            <li key={j} className="text-xs">{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
