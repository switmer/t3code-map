import type { CSSProperties, ReactNode } from "react";

import { cn } from "~/lib/utils";

import type { AcRole, AcStatusTone } from "./acTypes";
import { AttentionBadge } from "./AttentionBadge";
import { StatusDot } from "./StatusDot";

/**
 * Preferred on-screen chip size (counter-scaled so text stays readable at 20–40% zoom).
 * Clamped to the node's layout footprint so chips never overlap neighbors.
 */
export const AGENT_CANVAS_CHIP_SCREEN = { width: 200, height: 36 } as const;

/** Flow-space size + on-screen size for a chip that must stay inside `layout`. */
export function chipSizeForLayout(
  zoom: number,
  layout: { readonly width: number; readonly height: number },
): {
  readonly flowWidth: number;
  readonly flowHeight: number;
  readonly screenWidth: number;
  readonly screenHeight: number;
} {
  const z = Math.max(0.15, Math.min(zoom, 1));
  // Cap chip to ~72% of the layout footprint so lead→worker connectors have a
  // clear horizontal run inside the node box (not only the inter-card gap).
  const screenWidth = Math.min(AGENT_CANVAS_CHIP_SCREEN.width, layout.width * z * 0.72);
  const screenHeight = Math.min(AGENT_CANVAS_CHIP_SCREEN.height, layout.height * z * 0.72);
  return {
    flowWidth: screenWidth / z,
    flowHeight: screenHeight / z,
    screenWidth,
    screenHeight,
  };
}

type ChipNodeProps = {
  readonly className?: string;
  readonly statusTone?: AcStatusTone;
  readonly statusLabel?: string;
  readonly title: string;
  /** Current canvas zoom — used to inverse-scale chrome for legibility. */
  readonly zoom?: number;
  /** On-screen chrome size after clamping to the node footprint. */
  readonly screenWidth?: number;
  readonly screenHeight?: number;
  readonly role?: AcRole;
  readonly showAttention?: boolean;
  readonly onClick?: () => void;
  readonly trailing?: ReactNode;
};

/**
 * LOD chip: flow node should be sized to `screen / zoom` so after React Flow
 * scales the node, the chip stays ~screenWidth×screenHeight on screen with
 * unscaled type (inverse scale on the inner chrome).
 */
export function ChipNode({
  className,
  statusTone = "idle",
  statusLabel,
  title,
  zoom = 1,
  screenWidth = AGENT_CANVAS_CHIP_SCREEN.width,
  screenHeight = AGENT_CANVAS_CHIP_SCREEN.height,
  showAttention = false,
  onClick,
  trailing,
}: ChipNodeProps) {
  const safeZoom = Math.max(0.15, Math.min(zoom, 1));
  const inv = 1 / safeZoom;
  const innerStyle: CSSProperties = {
    width: screenWidth,
    height: screenHeight,
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

/**
 * Gallery specimen: simulates React Flow zoom so counter-scale reads at true
 * on-screen size, each specimen in its own labeled cell (never overlapping).
 */
export function ChipNodeSpecimen({
  caption,
  zoom,
  ...props
}: ChipNodeProps & { readonly caption: string; readonly zoom: number }) {
  const z = Math.max(0.15, Math.min(zoom, 1));
  const screenW = props.screenWidth ?? AGENT_CANVAS_CHIP_SCREEN.width;
  const screenH = props.screenHeight ?? AGENT_CANVAS_CHIP_SCREEN.height;
  const flowW = screenW / z;
  const flowH = screenH / z;
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-1.5">
      <span className="text-[length:var(--ac-font-xs)] font-medium text-muted-foreground">
        {caption}
      </span>
      <div
        className="relative max-w-full overflow-hidden rounded-md border border-border/60 bg-muted/20 p-2"
        style={{ width: screenW + 16, maxWidth: "100%" }}
      >
        <div className="overflow-hidden" style={{ width: screenW, height: screenH }}>
          <div
            style={{
              width: flowW,
              height: flowH,
              transform: `scale(${z})`,
              transformOrigin: "top left",
            }}
          >
            <ChipNode {...props} zoom={z} screenWidth={screenW} screenHeight={screenH} />
          </div>
        </div>
      </div>
    </div>
  );
}
