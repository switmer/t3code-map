import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { AttentionCounter } from "./AttentionCounter";

type CanvasToolbarProps = {
  attentionCount?: number;
  children?: ReactNode;
  className?: string;
  end?: ReactNode;
  label?: string;
};

export function CanvasToolbar({
  attentionCount = 0,
  children,
  className,
  end,
  label = "Canvas tools",
}: CanvasToolbarProps) {
  return (
    <div
      aria-label={label}
      className={cn(
        "agent-canvas-ds flex items-center gap-[var(--ac-space-1)] rounded-full border border-[var(--ac-border-default)] bg-[var(--ac-surface-elevated)] p-[var(--ac-space-1)] shadow-[var(--ac-shadow-2)]",
        className,
      )}
      role="toolbar"
      style={{ zIndex: "var(--ac-z-toolbar)" }}
    >
      {children}
      <AttentionCounter count={attentionCount} />
      {end}
    </div>
  );
}
