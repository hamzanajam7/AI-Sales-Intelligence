"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadScoreBadge } from "@/components/lead-score-badge";
import { getDashboardStats, runPipeline, getPipelineStatus } from "@/lib/api";
import type { DashboardStats, PipelineStatus } from "@/lib/types";
import { Input } from "@/components/ui/input";
import {
  Users,
  TrendingUp,
  Flame,
  CheckCircle,
  Play,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Link from "next/link";

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#3b82f6",
  C: "#eab308",
  D: "#f97316",
  F: "#ef4444",
};

const CERT_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

export function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [zipCode, setZipCode] = useState("10013");

  const fetchStats = useCallback(async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch {
      // API not reachable yet
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPipelineStatus = useCallback(async () => {
    try {
      const status = await getPipelineStatus();
      setPipelineStatus(status);
      if (status.status !== "idle" && status.status !== "complete" && status.status !== "error") {
        setPipelineRunning(true);
      } else {
        setPipelineRunning(false);
        if (status.status === "complete") {
          fetchStats();
        }
      }
    } catch {
      // ignore
    }
  }, [fetchStats]);

  useEffect(() => {
    fetchStats();
    fetchPipelineStatus();
  }, [fetchStats, fetchPipelineStatus]);

  useEffect(() => {
    if (!pipelineRunning) return;
    const interval = setInterval(fetchPipelineStatus, 2000);
    return () => clearInterval(interval);
  }, [pipelineRunning, fetchPipelineStatus]);

  const handleRunPipeline = async () => {
    try {
      await runPipeline(zipCode);
      setPipelineRunning(true);
      fetchPipelineStatus();
    } catch {
      // handle error
    }
  };

  const gradeData = stats
    ? Object.entries(stats.grade_distribution)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([grade, count]) => ({ grade, count, fill: GRADE_COLORS[grade] || "#94a3b8" }))
    : [];

  const certData = stats
    ? Object.entries(stats.certification_breakdown).map(([name, value], i) => ({
        name: name.length > 20 ? name.substring(0, 20) + "..." : name,
        value,
        fill: CERT_COLORS[i % CERT_COLORS.length],
      }))
    : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pipeline Control */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <h3 className="font-semibold">Data Pipeline</h3>
            {pipelineStatus && (
              <p className="text-sm text-muted-foreground">
                Status: <span className="font-medium">{pipelineStatus.status}</span>
                {pipelineStatus.progress && ` — ${pipelineStatus.progress}`}
              </p>
            )}
            {pipelineStatus?.error && (
              <p className="text-sm text-red-600">Error: {pipelineStatus.error}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Zip code"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              className="w-28"
              disabled={pipelineRunning}
            />
            <Button onClick={handleRunPipeline} disabled={pipelineRunning}>
              {pipelineRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Pipeline
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Leads
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total_contractors ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Score
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats?.avg_score !== null ? stats?.avg_score : "--"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Hot Leads (A)
            </CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats?.hot_leads ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Enriched
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.enriched_pct ?? 0}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grade Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {gradeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={gradeData}>
                  <XAxis dataKey="grade" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {gradeData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-12">
                No scored leads yet. Run the pipeline to get started.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Certification Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {certData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={certData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {certData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-12">
                No data yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Leads */}
      {stats && stats.top_leads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.top_leads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{lead.company_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {lead.certification_level ?? "No certification"} •{" "}
                      {[lead.city, lead.state].filter(Boolean).join(", ") || "Unknown location"}
                    </p>
                  </div>
                  <LeadScoreBadge score={lead.lead_score} grade={lead.lead_grade} />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
