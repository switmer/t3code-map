import { cn } from "~/lib/utils";

type ZoomBadgeProps = {
  className?: string;
  zoom: number;
};

export function ZoomBadge({ className, zoom }: ZoomBadgeProps) {
  const percent = Math.round(zoom * 100);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--ac-radius-sm)] border border-[var(--ac-border-subtle)] bg-[var(--ac-surface-elevated)] px-[var(--ac-space-2)] py-[calc(var(--ac-space-1)/2)] font-mono text-[length:var(--ac-font-xs)] text-[var(--ac-text-secondary)] tabular-nums shadow-[var(--ac-shadow-1)]",
        className,
      )}
    >
      {percent}%
    </span>
  );
}
