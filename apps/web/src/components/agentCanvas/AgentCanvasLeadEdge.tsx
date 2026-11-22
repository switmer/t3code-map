import { BaseEdge, getSmoothStepPath, Position, type Edge, type EdgeProps } from "@xyflow/react";

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
 * Lead→worker smooth step. Horizontal exit/entry so fans stay parallel and
 * never loop behind cards. Same routing at chip LOD (mid handles).
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
  // Spread parallel fans vertically; keep a clear horizontal run even when chips are close.
  const offset = Math.max(chipLod ? 20 : 14, Math.min(chipLod ? 36 : 28, dx * 0.2)) + fanIndex * 10;
  const borderRadius = dy < 24 ? 4 : 10;
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    borderRadius,
    offset,
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
