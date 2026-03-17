import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GRADE_BADGE_COLORS } from "@/lib/constants";

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
      <Badge className={cn("font-bold", GRADE_BADGE_COLORS[grade] || GRADE_BADGE_COLORS.C)}>
        {grade}
      </Badge>
      <span className="text-sm font-semibold tabular-nums">{score}</span>
    </div>
  );
}
