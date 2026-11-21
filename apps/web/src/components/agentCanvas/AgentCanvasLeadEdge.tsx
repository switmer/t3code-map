import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";

export type AgentCanvasLeadFlowEdge = Edge<
  {
    readonly kind: "lead" | "link";
    readonly fanIndex?: number;
  },
  "agentLead"
>;

/**
 * When lead edges share a source handle, shift each bezier’s origin so the three
 * workers get a clear FigJam-style fan instead of a single piled exit.
 */
const FAN_OFFSETS_Y = [-120, 0, 120] as const;

/** Bezier that fans from distinct points on the lead’s right edge into each worker. */
export function AgentCanvasLeadEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
  animated,
}: EdgeProps<AgentCanvasLeadFlowEdge>) {
  const rawIndex = data?.fanIndex;
  const fanIndex =
    typeof rawIndex === "number" && Number.isFinite(rawIndex)
      ? Math.min(Math.max(Math.round(rawIndex), 0), FAN_OFFSETS_Y.length - 1)
      : 1;
  const sourceOffsetY = FAN_OFFSETS_Y[fanIndex] ?? 0;

  const [path] = getBezierPath({
    sourceX,
    sourceY: sourceY + sourceOffsetY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={path}
      {...(markerEnd !== undefined ? { markerEnd } : {})}
      style={{
        ...style,
        stroke: animated
          ? "color-mix(in oklab, var(--color-primary) 72%, var(--color-muted-foreground))"
          : "color-mix(in oklab, var(--color-muted-foreground) 48%, transparent)",
        strokeWidth: animated ? 1.35 : 1.15,
        ...(animated ? { strokeDasharray: "4 5" } : { strokeDasharray: "none" }),
      }}
    />
  );
}
