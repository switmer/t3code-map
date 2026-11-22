import { AlertTriangleIcon, CheckIcon, CircleAlertIcon } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

const attentionTone = {
  done: "success",
  failed: "error",
  "needs-you": "warning",
} as const;

const VARIANT_ICONS = {
  done: CheckIcon,
  failed: CircleAlertIcon,
  "needs-you": AlertTriangleIcon,
} as const;

type AttentionBadgeProps = {
  className?: string;
  /** Icon-only (with tooltip). Use on chip LOD so the title keeps horizontal room. */
  compact?: boolean;
  label: string;
  variant?: "needs-you" | "failed" | "done";
};

export function AttentionBadge({
  className,
  compact = false,
  label,
  variant = "needs-you",
}: AttentionBadgeProps) {
  const Icon = VARIANT_ICONS[variant];
  const badge = (
    <Badge
      variant={attentionTone[variant]}
      size="sm"
      className={cn(
        // Override Badge sm's 10px desktop size — canvas floor is text-2xs (11px).
        "gap-0.5 whitespace-nowrap text-[length:var(--ac-font-xs)] leading-none",
        compact && "min-w-4 px-0.5",
        !compact && "px-1",
        className,
      )}
      aria-label={label}
    >
      <Icon aria-hidden className="size-2.5 shrink-0 opacity-90" />
      {compact ? null : <span className="leading-none">{label}</span>}
    </Badge>
  );

  if (!compact) return badge;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex shrink-0" />}>{badge}</TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}
