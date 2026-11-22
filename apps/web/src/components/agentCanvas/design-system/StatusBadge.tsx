import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

import type { AcStatusTone } from "./acTypes";
import { StatusDot } from "./StatusDot";

const toneToBadgeVariant = {
  done: "success",
  failed: "error",
  idle: "outline",
  ready: "outline",
  running: "success",
  waiting: "warning",
} as const satisfies Record<AcStatusTone, "success" | "error" | "outline" | "warning">;

type StatusBadgeProps = {
  className?: string;
  label: string;
  showDot?: boolean;
  tone?: AcStatusTone;
};

/** Status label built on the shared `Badge` so canvas matches chat/sidebar pills. */
export function StatusBadge({ className, label, showDot = true, tone = "idle" }: StatusBadgeProps) {
  return (
    <Badge
      variant={toneToBadgeVariant[tone]}
      size="sm"
      className={cn(
        "gap-1 whitespace-nowrap text-[length:var(--ac-font-xs)] leading-none",
        className,
      )}
    >
      {showDot ? <StatusDot size="sm" tone={tone} /> : null}
      <span className="leading-none">{label}</span>
    </Badge>
  );
}
