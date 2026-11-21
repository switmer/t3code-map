import type { AgentCanvasNodeLayout, AgentCanvasView } from "../../agentCanvasStore";
import { DEFAULT_AGENT_NODE_SIZE } from "../../agentCanvasStore";

export type AgentCanvasLod = "interactive" | "preview" | "chip";

const NODE_GAP = 48;
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;

/** Grid placement for threads that have never been moved on the canvas. */
export function defaultAgentNodeLayout(index: number): AgentCanvasNodeLayout {
  const columns = Math.max(1, Math.ceil(Math.sqrt(index + 1)));
  const col = index % columns;
  const row = Math.floor(index / columns);
  return {
    x: col * (DEFAULT_AGENT_NODE_SIZE.width + NODE_GAP),
    y: row * (DEFAULT_AGENT_NODE_SIZE.height + NODE_GAP),
    width: DEFAULT_AGENT_NODE_SIZE.width,
    height: DEFAULT_AGENT_NODE_SIZE.height,
  };
}

export function resolveAgentNodeLayout(
  index: number,
  saved: AgentCanvasNodeLayout | undefined,
): AgentCanvasNodeLayout {
  return saved ?? defaultAgentNodeLayout(index);
}

/** Zoom keeping the canvas point under `anchor` fixed on screen. */
export function zoomAgentCanvasView(
  view: AgentCanvasView,
  factor: number,
  anchor: { readonly x: number; readonly y: number },
): AgentCanvasView {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
  const ratio = scale / view.scale;
  return {
    scale,
    x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio,
  };
}

export function panAgentCanvasView(view: AgentCanvasView, dx: number, dy: number): AgentCanvasView {
  return { ...view, x: view.x + dx, y: view.y + dy };
}

export function nodeScreenRect(
  layout: AgentCanvasNodeLayout,
  view: AgentCanvasView,
): {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
} {
  return {
    left: layout.x * view.scale + view.x,
    top: layout.y * view.scale + view.y,
    right: (layout.x + layout.width) * view.scale + view.x,
    bottom: (layout.y + layout.height) * view.scale + view.y,
  };
}

export function isNodeOnScreen(
  layout: AgentCanvasNodeLayout,
  view: AgentCanvasView,
  viewport: { readonly width: number; readonly height: number },
  margin = 80,
): boolean {
  const rect = nodeScreenRect(layout, view);
  return (
    rect.right >= -margin &&
    rect.bottom >= -margin &&
    rect.left <= viewport.width + margin &&
    rect.top <= viewport.height + margin
  );
}

/**
 * Detail level for a node. Only the focused on-screen node is interactive; others are
 * previews or chips so many agents stay cheap to draw.
 */
export function agentCanvasLod(input: {
  readonly focused: boolean;
  readonly onScreen: boolean;
  readonly scale: number;
}): AgentCanvasLod {
  if (!input.onScreen) return "chip";
  if (input.scale < 0.45) return "chip";
  if (input.focused && input.scale >= 0.55) return "interactive";
  return "preview";
}

export function clampAgentNodeLayout(layout: AgentCanvasNodeLayout): AgentCanvasNodeLayout {
  return {
    x: Math.max(0, layout.x),
    y: Math.max(0, layout.y),
    width: Math.min(1200, Math.max(240, layout.width)),
    height: Math.min(1200, Math.max(180, layout.height)),
  };
}
