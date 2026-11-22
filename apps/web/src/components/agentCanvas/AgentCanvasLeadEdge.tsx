import {
  BaseEdge,
  getBezierPath,
  getSmoothStepPath,
  Position,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";

import { canvasEdgeClassName } from "./design-system/CanvasEdgeStyles";

export type AgentCanvasLeadFlowEdge = Edge<
  {
    readonly kind: "lead" | "link" | "broadcast" | "dependency";
    readonly fanIndex?: number;
    readonly chipLod?: boolean;
  },
  "agentLead"
>;

/**
 * Lead→worker edges: smooth-step fans at interactive/preview; one cubic bezier
 * per worker at chip LOD (right-center → left-center, no orthogonal loops).
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
  const chipLod = Boolean(data?.chipLod);
  const dx = Math.abs(targetX - sourceX);
  const dy = Math.abs(targetY - sourceY);
  const [path] = chipLod
    ? getBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        curvature: 0.25,
      })
    : getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        borderRadius: dy < 24 ? 4 : 10,
        offset: Math.max(14, Math.min(28, dx * 0.2)) + fanIndex * 10,
      });
  const kind =
    data?.kind === "broadcast"
      ? "broadcast"
      : data?.kind === "dependency"
        ? "dependency"
        : animated
          ? "active"
          : "idle";

  // Chip LOD: dark screen-pixel stroke (CSS `.chip-lod` wins over Tailwind stroke utilities).
  // Interactive: inherit design-system stroke via class + light inline width.
  const strokeWidth = chipLod ? 4.5 : animated ? 2.25 : 1.75;

  return (
    <BaseEdge
      id={id}
      path={path}
      className={canvasEdgeClassName(kind, chipLod ? { className: "chip-lod-path" } : undefined)}
      {...(markerEnd !== undefined ? { markerEnd } : {})}
      style={{
        ...style,
        ...(chipLod
          ? {
              stroke:
                "color-mix(in oklab, var(--color-foreground) 72%, var(--color-muted-foreground))",
              strokeWidth,
              vectorEffect: "non-scaling-stroke",
              fill: "none",
              opacity: 1,
              strokeDasharray: animated ? "5 6" : "none",
            }
          : {
              strokeWidth,
              vectorEffect: "non-scaling-stroke",
              fill: "none",
              ...(animated ? { strokeDasharray: "4 5" } : { strokeDasharray: "none" }),
            }),
      }}
    />
  );
}
