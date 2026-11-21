import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";

export type AgentCanvasLeadFlowEdge = Edge<
  {
    readonly kind: "lead" | "link";
    readonly fanIndex?: number;
  },
  "agentLead"
>;

/**
 * Lead→worker bezier. sourceX/sourceY come from the lead’s out-0/1/2 handles
 * (20% / 50% / 80% down the right edge). Do not offset Y — that detaches the path.
 */
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
  animated,
}: EdgeProps<AgentCanvasLeadFlowEdge>) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
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
