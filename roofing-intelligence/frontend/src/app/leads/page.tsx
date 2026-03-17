"use client";

import { LeadsTable } from "@/components/leads-table";

export default function LeadsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Lead List</h1>
      <LeadsTable />
    </div>
  );
}
