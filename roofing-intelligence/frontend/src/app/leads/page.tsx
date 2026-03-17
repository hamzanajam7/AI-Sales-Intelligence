"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LeadsTable } from "@/components/leads-table";
import { Button } from "@/components/ui/button";
import { X, GitCompareArrows } from "lucide-react";

export default function LeadsPage() {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const router = useRouter();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Lead List</h1>
      <LeadsTable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {selectedIds.length >= 2 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedIds.length} leads selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds([])}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  router.push(`/compare?ids=${selectedIds.join(",")}`)
                }
              >
                <GitCompareArrows className="h-4 w-4 mr-1" />
                Compare Selected
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
