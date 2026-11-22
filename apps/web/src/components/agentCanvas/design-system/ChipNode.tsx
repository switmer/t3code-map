import type { CSSProperties, ReactNode } from "react";

import { cn } from "~/lib/utils";

import type { AcRole, AcStatusTone } from "./acTypes";
import { AttentionBadge } from "./AttentionBadge";
import { StatusDot } from "./StatusDot";

/**
 * Preferred on-screen chip size (counter-scaled so text stays readable at 20–40% zoom).
 * ~320px fits ~18–22 chars of `ac-font-sm` plus status/attention chrome.
 */
export const AGENT_CANVAS_CHIP_SCREEN = { width: 320, height: 44 } as const;

/** Flow-space size + on-screen size for a chip at the current zoom. */
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
  // Prefer the readable ~18–22 char chip. Only shrink for truly tiny footprints (notes).
  const tiny = layout.width < 220 || layout.height < 100;
  const screenWidth = tiny
    ? Math.min(AGENT_CANVAS_CHIP_SCREEN.width, Math.max(layout.width * z, 96))
    : AGENT_CANVAS_CHIP_SCREEN.width;
  const screenHeight = tiny
    ? Math.min(AGENT_CANVAS_CHIP_SCREEN.height, Math.max(layout.height * z, 28))
    : AGENT_CANVAS_CHIP_SCREEN.height;
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

function ChipChrome({
  statusTone,
  statusLabel,
  title,
  showAttention,
  trailing,
  style,
}: {
  readonly statusTone: AcStatusTone;
  readonly statusLabel?: string;
  readonly title: string;
  readonly showAttention: boolean;
  readonly trailing?: ReactNode;
  readonly style?: CSSProperties;
}) {
  const attentionVariant =
    statusTone === "failed" ? "failed" : statusTone === "done" ? "done" : "needs-you";
  const attentionLabel =
    statusTone === "failed" ? "Failed" : statusTone === "done" ? "Done" : "Needs you";
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-card px-2.5 shadow-composer",
        statusTone === "failed" && "border-destructive/45",
        statusTone === "waiting" && "border-warning/45",
        statusTone === "running" && "border-success/40",
      )}
      style={style}
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
  );
}

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
      <ChipChrome
        statusTone={statusTone}
        {...(statusLabel !== undefined ? { statusLabel } : {})}
        title={title}
        showAttention={showAttention}
        {...(trailing !== undefined ? { trailing } : {})}
        style={innerStyle}
      />
    </button>
  );
}

/**
 * Gallery specimen: on-screen chip at 1:1 inside a padded cell (no nested RF
 * counter-scale — that clipped the chrome in the cell).
 */
export function ChipNodeSpecimen({
  caption,
  zoom,
  ...props
}: ChipNodeProps & { readonly caption: string; readonly zoom: number }) {
  void zoom;
  const screenW = props.screenWidth ?? AGENT_CANVAS_CHIP_SCREEN.width;
  const screenH = props.screenHeight ?? AGENT_CANVAS_CHIP_SCREEN.height;
  const pad = 16;
  const statusTone = props.statusTone ?? "idle";
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-1.5 overflow-visible">
      <span className="text-[length:var(--ac-font-xs)] font-medium text-muted-foreground">
        {caption}
      </span>
      <div
        className="box-border flex items-center overflow-visible rounded-md border border-border/60 bg-muted/20"
        style={{
          width: Math.min(screenW + pad * 2, 360),
          height: screenH + pad * 2,
          padding: pad,
        }}
      >
        <ChipChrome
          statusTone={statusTone}
          {...(props.statusLabel !== undefined ? { statusLabel: props.statusLabel } : {})}
          title={props.title}
          showAttention={Boolean(props.showAttention)}
          {...(props.trailing !== undefined ? { trailing: props.trailing } : {})}
          style={{ width: "100%", height: screenH, maxWidth: screenW }}
        />
      </div>
    </div>
  );
}
