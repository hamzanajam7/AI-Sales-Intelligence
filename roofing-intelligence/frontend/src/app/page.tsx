"use client";

import { DashboardView } from "@/components/dashboard-stats";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <DashboardView />
    </div>
  );
}
