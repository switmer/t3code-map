import { cn } from "~/lib/utils";
import { Spinner } from "~/components/ui/spinner";

type CanvasLoadingStateProps = {
  className?: string;
  label?: string;
};

export function CanvasLoadingState({
  className,
  label = "Loading canvas…",
}: CanvasLoadingStateProps) {
  return (
    <div
      aria-busy
      className={cn(
        "agent-canvas-ds flex items-center gap-[var(--ac-space-3)] rounded-[var(--ac-radius-md)] border border-[var(--ac-border-subtle)] bg-[var(--ac-surface-2)] px-[var(--ac-space-4)] py-[var(--ac-space-3)]",
        className,
      )}
    >
      <Spinner className="size-4 text-[var(--ac-text-secondary)]" />
      <span className="text-[length:var(--ac-font-sm)] text-[var(--ac-text-secondary)]">
        {label}
      </span>
    </div>
  );
}
