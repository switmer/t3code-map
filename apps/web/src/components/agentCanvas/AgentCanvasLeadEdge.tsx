import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";

export type AgentCanvasLeadFlowEdge = Edge<
  {
    readonly kind: "lead" | "link";
    readonly fanIndex?: number;
  },
  "agentLead"
>;

/**
 * Lead→worker cubic. Exits horizontally from the lead handle first so paths
 * fan cleanly instead of running as parallel vertical lines along the card.
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
  // Exit horizontally well clear of the lead card before curving to the worker.
  const span = Math.max(96, Math.abs(targetX - sourceX) * 0.62);
  const fanNudge = (fanIndex - 1) * 10;
  const c1x = sourceX + span;
  const c1y = sourceY;
  const c2x = targetX - span * 0.85;
  const c2y = targetY;
  const path = `M ${sourceX},${sourceY} C ${c1x},${c1y + fanNudge * 0.15} ${c2x},${c2y - fanNudge * 0.1} ${targetX},${targetY}`;

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
