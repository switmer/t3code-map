import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

import type { AcEdgeKind } from "./acTypes";

const canvasEdgeStrokeVariants = cva("", {
  defaultVariants: {
    kind: "idle",
  },
  variants: {
    kind: {
      active: "[stroke:var(--ac-edge-active)]",
      broadcast: "[stroke:var(--ac-edge-broadcast)]",
      dependency: "[stroke:var(--ac-edge-dependency)]",
      idle: "[stroke:var(--ac-edge-idle)]",
    } satisfies Record<AcEdgeKind, string>,
  },
});

export function canvasEdgeClassName(
  kind: AcEdgeKind,
  options?: { animated?: boolean; selected?: boolean; className?: string },
) {
  return cn(
    canvasEdgeStrokeVariants({ kind }),
    options?.animated && "agent-canvas-edge-animated",
    options?.selected && "[stroke-width:1.75]",
    !options?.selected && "[stroke-width:1.25]",
    options?.className,
  );
}

export function canvasEdgeStyle(kind: AcEdgeKind): { stroke: string; strokeWidth: number } {
  const strokeVar = {
    active: "var(--ac-edge-active)",
    broadcast: "var(--ac-edge-broadcast)",
    dependency: "var(--ac-edge-dependency)",
    idle: "var(--ac-edge-idle)",
  }[kind];
  return { stroke: strokeVar, strokeWidth: 1.25 };
}

export type CanvasEdgeStrokeProps = VariantProps<typeof canvasEdgeStrokeVariants>;
