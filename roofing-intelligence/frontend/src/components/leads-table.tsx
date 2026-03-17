"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadScoreBadge } from "@/components/lead-score-badge";
import { getContractors, semanticSearch, getExportUrl } from "@/lib/api";
import type { Contractor, SemanticSearchResult } from "@/lib/types";
import { MAX_COMPARE_LEADS } from "@/lib/constants";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Star,
  Sparkles,
  Download,
} from "lucide-react";
import Link from "next/link";

interface LeadsTableProps {
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
}

export function LeadsTable({ selectedIds, onSelectionChange }: LeadsTableProps) {
  const [data, setData] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "lead_score", desc: true },
  ]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [certFilter, setCertFilter] = useState("");
  const [minScore, setMinScore] = useState<number | undefined>();
  const [semanticMode, setSemanticMode] = useState(false);
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[]>([]);

  const pageSize = 20;

  const columns: ColumnDef<Contractor>[] = useMemo(() => [
    {
      id: "select",
      header: "",
      cell: ({ row }) => {
        const id = row.original.id;
        const isSelected = selectedIds.includes(id);
        return (
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 accent-blue-600"
            checked={isSelected}
            disabled={!isSelected && selectedIds.length >= MAX_COMPARE_LEADS}
            onChange={() => {
              if (isSelected) {
                onSelectionChange(selectedIds.filter((sid) => sid !== id));
              } else {
                onSelectionChange([...selectedIds, id]);
              }
            }}
          />
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "lead_score",
      header: "Score",
      cell: ({ row }) => (
        <LeadScoreBadge
          score={row.original.lead_score}
          grade={row.original.lead_grade}
        />
      ),
      enableSorting: true,
    },
    {
      accessorKey: "company_name",
      header: "Company",
      cell: ({ row }) => (
        <Link
          href={`/leads/${row.original.id}`}
          className="font-medium text-blue-600 hover:underline"
        >
          {row.original.company_name}
        </Link>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "certification_level",
      header: "Certification",
      cell: ({ row }) => {
        const cert = row.original.certification_level;
        if (!cert) return <span className="text-gray-400">--</span>;
        const isMaster = cert.toLowerCase().includes("master");
        return (
          <Badge variant={isMaster ? "default" : "secondary"}>
            {cert}
          </Badge>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: "city",
      header: "Location",
      cell: ({ row }) => {
        const { city, state } = row.original;
        if (!city && !state) return <span className="text-gray-400">--</span>;
        return <span>{[city, state].filter(Boolean).join(", ")}</span>;
      },
      enableSorting: true,
    },
    {
      accessorKey: "star_rating",
      header: "Stars",
      cell: ({ row }) => {
        const rating = row.original.star_rating;
        if (!rating) return <span className="text-gray-400">--</span>;
        return (
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-sm">{rating.toFixed(1)}</span>
          </div>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: "review_count",
      header: "Reviews",
      enableSorting: true,
    },
    {
      accessorKey: "distance_miles",
      header: "Distance",
      cell: ({ row }) => {
        const d = row.original.distance_miles;
        if (!d) return <span className="text-gray-400">--</span>;
        return <span>{d.toFixed(1)} mi</span>;
      },
      enableSorting: true,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Link href={`/leads/${row.original.id}`}>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </Link>
      ),
    },
  ], [selectedIds, onSelectionChange]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const sortBy = sorting[0]?.id || "lead_score";
      const sortOrder = sorting[0]?.desc ? "desc" : "asc";
      const result = await getContractors({
        sort_by: sortBy,
        sort_order: sortOrder,
        certification: certFilter || undefined,
        min_score: minScore,
        search: search || undefined,
        page,
        page_size: pageSize,
      });
      setData(result.contractors);
      setTotal(result.total);
    } catch {
      // API not reachable
    } finally {
      setLoading(false);
    }
  }, [sorting, certFilter, minScore, search, page]);

  useEffect(() => {
    if (!semanticMode) {
      fetchData();
    }
  }, [fetchData, semanticMode]);

  const handleSearch = async () => {
    if (semanticMode && searchInput.trim()) {
      setLoading(true);
      try {
        const results = await semanticSearch(searchInput);
        setSemanticResults(results);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    } else {
      setSearch(searchInput);
      setPage(1);
    }
  };

  const handleExport = () => {
    const sortBy = sorting[0]?.id || "lead_score";
    const sortOrder = sorting[0]?.desc ? "desc" : "asc";
    const url = getExportUrl({
      sort_by: sortBy,
      sort_order: sortOrder,
      certification: certFilter || undefined,
      min_score: minScore,
      search: search || undefined,
    });
    window.open(url, "_blank");
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    state: { sorting },
    onSortingChange: (updater) => {
      setSorting(updater);
      setPage(1);
    },
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={
                semanticMode
                  ? "Semantic search (e.g., 'large commercial roofers')"
                  : "Search by company name..."
              }
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} variant="secondary">
            Search
          </Button>
          <Button
            onClick={() => {
              setSemanticMode(!semanticMode);
              setSemanticResults([]);
            }}
            variant={semanticMode ? "default" : "outline"}
            size="sm"
            className="whitespace-nowrap"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            AI Search
          </Button>
        </div>
        <div className="flex gap-2">
          <select
            className="border rounded-md px-3 py-2 text-sm bg-white"
            value={certFilter}
            onChange={(e) => {
              setCertFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Certifications</option>
            <option value="GAF Master Elite">GAF Master Elite</option>
            <option value="President's Club">{"President's Club"}</option>
            <option value="Triple Excellence">Triple Excellence</option>
            <option value="GAF Certified">GAF Certified</option>
          </select>
          <Input
            type="number"
            placeholder="Min score"
            className="w-28"
            value={minScore ?? ""}
            onChange={(e) => {
              setMinScore(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}
          />
          <Button variant="outline" size="sm" onClick={handleExport} className="whitespace-nowrap">
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Semantic Search Results */}
      {semanticMode && semanticResults.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Semantic Search Results ({semanticResults.length})
          </h3>
          {semanticResults.map((r) => (
            <Link
              key={r.contractor_id}
              href={`/leads/${r.contractor_id}`}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="font-medium">{r.company_name}</p>
                <p className="text-sm text-muted-foreground">
                  {r.certification_level ?? "No cert"} •{" "}
                  {[r.city, r.state].filter(Boolean).join(", ")} • Similarity:{" "}
                  {(r.score * 100).toFixed(1)}%
                </p>
              </div>
              <LeadScoreBadge score={r.lead_score} grade={r.lead_grade} />
            </Link>
          ))}
        </div>
      )}

      {/* Data Table */}
      {!semanticMode && (
        <>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className={
                            header.column.getCanSort()
                              ? "cursor-pointer select-none hover:bg-gray-50"
                              : ""
                          }
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <div className="flex items-center gap-1">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {header.column.getCanSort() && (
                              <>
                                {header.column.getIsSorted() === "desc" ? (
                                  <ArrowDown className="h-3.5 w-3.5" />
                                ) : header.column.getIsSorted() === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                                )}
                              </>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No leads found. Run the pipeline to scrape contractor
                        data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className={
                          selectedIds.includes(row.original.id)
                            ? "bg-blue-50 hover:bg-blue-100"
                            : "hover:bg-gray-50"
                        }
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1}-
              {Math.min(page * pageSize, total)} of {total} leads
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {(() => {
                const pages: (number | string)[] = [];
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (page > 3) pages.push("...");
                  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
                    pages.push(i);
                  }
                  if (page < totalPages - 2) pages.push("...");
                  pages.push(totalPages);
                }
                return pages.map((p, idx) =>
                  typeof p === "string" ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-sm text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      className="w-9"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  )
                );
              })()}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
