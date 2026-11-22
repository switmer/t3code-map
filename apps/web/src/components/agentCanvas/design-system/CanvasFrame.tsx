import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

type CanvasFrameProps = {
  children?: ReactNode;
  className?: string;
  label?: string;
};

export function CanvasFrame({ children, className, label }: CanvasFrameProps) {
  return (
    <section
      className={cn(
        "agent-canvas-ds rounded-[var(--ac-radius-xl)] border border-dashed border-[var(--ac-border-strong)] bg-[color-mix(in_oklab,var(--ac-surface-2)_40%,transparent)] p-[var(--ac-space-4)]",
        className,
      )}
    >
      {label ? (
        <header className="mb-[var(--ac-space-3)] text-[length:var(--ac-font-xs)] font-medium uppercase tracking-wide text-[var(--ac-text-tertiary)]">
          {label}
        </header>
      ) : null}
      {children}
    </section>
  );
}
