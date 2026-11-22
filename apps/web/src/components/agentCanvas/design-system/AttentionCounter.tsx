import { cn } from "~/lib/utils";

type AttentionCounterProps = {
  className?: string;
  count: number;
  label?: string;
};

export function AttentionCounter({ className, count, label = "Need you" }: AttentionCounterProps) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-[calc(var(--ac-space-4)+var(--ac-space-1))] items-center justify-center gap-[var(--ac-space-1)] rounded-full border border-[color-mix(in_oklab,var(--ac-status-waiting)_45%,transparent)] bg-[var(--ac-status-waiting-surface)] px-[var(--ac-space-2)] py-[calc(var(--ac-space-1)/2)] text-[length:var(--ac-font-xs)] font-semibold text-[var(--ac-status-waiting)] tabular-nums",
        className,
      )}
      data-agent-canvas-attention-count
    >
      <span className="sr-only">{label}</span>
      {count}
    </span>
  );
}
