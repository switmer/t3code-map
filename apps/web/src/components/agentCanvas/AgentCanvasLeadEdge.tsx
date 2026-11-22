import { BaseEdge, getSmoothStepPath, Position, type Edge, type EdgeProps } from "@xyflow/react";

import { canvasEdgeClassName } from "./design-system/CanvasEdgeStyles";

export type AgentCanvasLeadFlowEdge = Edge<
  {
    readonly kind: "lead" | "link" | "broadcast" | "dependency";
    readonly fanIndex?: number;
  },
  "agentLead"
>;

/**
 * Lead→worker smooth step. Horizontal exit/entry so fans stay parallel and
 * never loop behind cards.
 */
export function AgentCanvasLeadEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  animated,
  data,
}: EdgeProps<AgentCanvasLeadFlowEdge>) {
  const fanIndex = data?.fanIndex ?? 0;
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    borderRadius: 12,
    offset: 12 + fanIndex * 6,
  });
  const kind =
    data?.kind === "broadcast"
      ? "broadcast"
      : data?.kind === "dependency"
        ? "dependency"
        : animated
          ? "active"
          : "idle";

  return (
    <BaseEdge
      id={id}
      path={path}
      className={canvasEdgeClassName(kind)}
      {...(markerEnd !== undefined ? { markerEnd } : {})}
      style={{
        ...style,
        stroke: animated
          ? "var(--ac-edge-active, color-mix(in oklab, var(--color-primary) 72%, var(--color-muted-foreground)))"
          : "var(--ac-edge-idle, color-mix(in oklab, var(--color-muted-foreground) 48%, transparent))",
        strokeWidth: animated ? 1.35 : 1.15,
        fill: "none",
        ...(animated ? { strokeDasharray: "4 5" } : { strokeDasharray: "none" }),
      }}
    />
  );
}
