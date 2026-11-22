import { LayersIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

type CanvasEmptyStateProps = {
  action?: ReactNode;
  className?: string;
  description?: string;
  title?: string;
};

export function CanvasEmptyState({
  action,
  className,
  description = "Add agents from the sidebar or duplicate a thread to populate the board.",
  title = "Canvas is empty",
}: CanvasEmptyStateProps) {
  return (
    <div
      className={cn(
        "agent-canvas-ds flex max-w-sm flex-col items-center gap-[var(--ac-space-3)] rounded-[var(--ac-radius-lg)] border border-dashed border-[var(--ac-border-subtle)] bg-[var(--ac-surface-2)] px-[var(--ac-space-5)] py-[var(--ac-space-6)] text-center",
        className,
      )}
    >
      <LayersIcon aria-hidden className="size-8 text-[var(--ac-text-muted)]" />
      <div>
        <h3 className="text-[length:var(--ac-font-base)] font-semibold text-[var(--ac-text-primary)]">
          {title}
        </h3>
        <p className="mt-[var(--ac-space-1)] text-[length:var(--ac-font-sm)] text-[var(--ac-text-secondary)]">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
