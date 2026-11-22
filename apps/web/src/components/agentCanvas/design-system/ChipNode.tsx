import type { CSSProperties, ReactNode } from "react";

import { cn } from "~/lib/utils";

import type { AcRole, AcStatusTone } from "./acTypes";
import { AttentionBadge } from "./AttentionBadge";
import { StatusDot } from "./StatusDot";

/**
 * Screen-space chip size (counter-scaled so it stays readable at 20–40% zoom).
 * Wide enough for a truncated agent name + status + compact attention icon.
 */
export const AGENT_CANVAS_CHIP_SCREEN = { width: 220, height: 36 } as const;

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
  const attentionVariant =
    statusTone === "failed" ? "failed" : statusTone === "done" ? "done" : "needs-you";
  const attentionLabel =
    statusTone === "failed" ? "Failed" : statusTone === "done" ? "Done" : "Needs you";

  return (
    <button
      type="button"
      data-agent-canvas-lod="chip"
      data-agent-canvas-status={statusTone}
      aria-label={statusLabel ? `${title} · ${statusLabel}` : title}
      title={title}
      onClick={onClick}
      className={cn(
        "agent-canvas-ds relative block h-full w-full overflow-visible border-0 bg-transparent p-0 text-left outline-none",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        className,
      )}
    >
      <div
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-card px-2 shadow-composer",
          statusTone === "failed" && "border-destructive/45",
          statusTone === "waiting" && "border-warning/45",
          statusTone === "running" && "border-success/40",
        )}
        style={innerStyle}
      >
        <StatusDot tone={statusTone} />
        <span className="min-w-0 flex-1 truncate text-[length:var(--ac-font-sm)] font-medium tracking-tight text-foreground">
          {title}
        </span>
        {statusLabel && !showAttention ? (
          <span className="max-w-16 shrink-0 truncate text-[length:var(--ac-font-xs)] font-medium text-muted-foreground">
            {statusLabel}
          </span>
        ) : null}
        {showAttention ? (
          <AttentionBadge compact variant={attentionVariant} label={attentionLabel} />
        ) : null}
        {trailing}
      </div>
    </button>
  );
}
