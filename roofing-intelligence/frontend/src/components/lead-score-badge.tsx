import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const gradeColors: Record<string, string> = {
  A: "bg-green-100 text-green-800 border-green-200",
  B: "bg-blue-100 text-blue-800 border-blue-200",
  C: "bg-yellow-100 text-yellow-800 border-yellow-200",
  D: "bg-orange-100 text-orange-800 border-orange-200",
  F: "bg-red-100 text-red-800 border-red-200",
};

export function LeadScoreBadge({
  score,
  grade,
}: {
  score: number | null;
  grade: string | null;
}) {
  if (score === null || grade === null) {
    return (
      <Badge variant="outline" className="text-gray-400">
        --
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge className={cn("font-bold", gradeColors[grade] || gradeColors.C)}>
        {grade}
      </Badge>
      <span className="text-sm font-semibold tabular-nums">{score}</span>
    </div>
  );
}
