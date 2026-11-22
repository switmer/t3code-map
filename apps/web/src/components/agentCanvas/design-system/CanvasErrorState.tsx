import { AlertTriangleIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

type CanvasErrorStateProps = {
  action?: ReactNode;
  className?: string;
  message?: string;
  title?: string;
};

export function CanvasErrorState({
  action,
  className,
  message = "Something prevented the canvas from loading. Retry or check diagnostics.",
  title = "Canvas unavailable",
}: CanvasErrorStateProps) {
  return (
    <div
      className={cn(
        "agent-canvas-ds flex max-w-sm flex-col items-center gap-[var(--ac-space-3)] rounded-[var(--ac-radius-lg)] border border-[color-mix(in_oklab,var(--ac-status-failed)_40%,var(--ac-border-default))] bg-[var(--ac-status-failed-surface)] px-[var(--ac-space-5)] py-[var(--ac-space-5)] text-center",
        className,
      )}
      role="alert"
    >
      <AlertTriangleIcon aria-hidden className="size-8 text-[var(--ac-status-failed)]" />
      <div>
        <h3 className="text-[length:var(--ac-font-base)] font-semibold text-[var(--ac-text-primary)]">
          {title}
        </h3>
        <p className="mt-[var(--ac-space-1)] text-[length:var(--ac-font-sm)] text-[var(--ac-text-secondary)]">
          {message}
        </p>
      </div>
      {action}
    </div>
  );
}
