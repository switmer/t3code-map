import type { CSSProperties, ReactNode } from "react";

import { cn } from "~/lib/utils";

import type { AcRole, AcStatusTone } from "./acTypes";
import { AttentionBadge } from "./AttentionBadge";
import { RolePill } from "./RolePill";
import { StatusDot } from "./StatusDot";

/** Screen-space chip size (counter-scaled so it stays readable at 20–40% zoom). */
export const AGENT_CANVAS_CHIP_SCREEN = { width: 176, height: 40 } as const;

type ChipNodeProps = {
  readonly className?: string;
  readonly statusTone?: AcStatusTone;
  readonly statusLabel?: string;
  readonly title: string;
  /** Current canvas zoom — used to inverse-scale chrome for legibility. */
  readonly zoom?: number;
  readonly role?: AcRole;
  readonly showAttention?: boolean;
  readonly onClick?: () => void;
  readonly trailing?: ReactNode;
};

/**
 * LOD chip: flow node should be sized to `screen / zoom` so after React Flow
 * scales the node, the chip stays ~AGENT_CANVAS_CHIP_SCREEN on screen with
 * unscaled type (inverse scale on the inner chrome).
 */
export function ChipNode({
  className,
  statusTone = "idle",
  statusLabel,
  title,
  zoom = 1,
  role = "none",
  showAttention = false,
  onClick,
  trailing,
}: ChipNodeProps) {
  const safeZoom = Math.max(0.15, Math.min(zoom, 1));
  const inv = 1 / safeZoom;
  const innerStyle: CSSProperties = {
    width: AGENT_CANVAS_CHIP_SCREEN.width,
    height: AGENT_CANVAS_CHIP_SCREEN.height,
    transform: `scale(${inv})`,
    transformOrigin: "top left",
  };

  return (
    <button
      type="button"
      data-agent-canvas-lod="chip"
      data-agent-canvas-status={statusTone}
      aria-label={statusLabel ? `${title} · ${statusLabel}` : title}
      onClick={onClick}
      className={cn(
        "agent-canvas-ds relative block h-full w-full overflow-visible border-0 bg-transparent p-0 text-left outline-none",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ac-border-focus)]",
        className,
      )}
    >
      <div
        className={cn(
          "inline-flex items-center gap-[var(--ac-space-2)] rounded-[var(--ac-radius-md)] border border-[var(--ac-border-default)] bg-[var(--ac-surface-1)] px-[var(--ac-space-2)] shadow-[var(--ac-shadow-1)]",
          statusTone === "failed" &&
            "border-[color-mix(in_oklab,var(--ac-status-failed)_55%,var(--ac-border-default))]",
          statusTone === "waiting" &&
            "border-[color-mix(in_oklab,var(--ac-status-waiting)_55%,var(--ac-border-default))]",
          statusTone === "running" &&
            "border-[color-mix(in_oklab,var(--ac-status-running)_45%,var(--ac-border-default))]",
        )}
        style={innerStyle}
      >
        <StatusDot tone={statusTone} />
        <span className="min-w-0 flex-1 truncate text-[length:var(--ac-font-sm)] font-medium tracking-tight text-[var(--ac-text-primary)]">
          {title}
        </span>
        {statusLabel ? (
          <span className="shrink-0 text-[length:var(--ac-font-xs)] font-medium text-[var(--ac-text-secondary)]">
            {statusLabel}
          </span>
        ) : null}
        {showAttention ? (
          <AttentionBadge
            variant={
              statusTone === "failed" ? "failed" : statusTone === "done" ? "done" : "needs-you"
            }
            label={
              statusTone === "failed" ? "Failed" : statusTone === "done" ? "Done" : "Needs you"
            }
          />
        ) : null}
        {role !== "none" ? <RolePill role={role} /> : null}
        {trailing}
      </div>
    </button>
  );
}
