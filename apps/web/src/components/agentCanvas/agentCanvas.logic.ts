import type {
  AgentCanvasEdge,
  AgentCanvasEdgeKind,
  AgentCanvasNodeLayout,
  AgentCanvasNote,
  AgentCanvasRole,
  AgentCanvasView,
} from "../../agentCanvasStore";
import {
  DEFAULT_AGENT_NODE_SIZE,
  DEFAULT_NOTE_SIZE,
  MAX_AGENT_NODE_SIZE,
  MIN_AGENT_NODE_SIZE,
} from "../../agentCanvasStore";

export type AgentCanvasLod = "interactive" | "preview" | "chip";

const NODE_GAP_X = 72;
const NODE_GAP_Y = 72;
const COLUMNS = 3;

export function agentFlowId(threadKey: string): string {
  return `agent:${threadKey}`;
}

export function noteFlowId(noteId: string): string {
  return `note:${noteId}`;
}

export function parseAgentFlowId(id: string): string | null {
  return id.startsWith("agent:") ? id.slice("agent:".length) : null;
}

export function parseNoteFlowId(id: string): string | null {
  return id.startsWith("note:") ? id.slice("note:".length) : null;
}

/** Grid placement for threads that have never been moved on the canvas. */
export function defaultAgentNodeLayout(index: number): AgentCanvasNodeLayout {
  const col = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  return {
    x: col * (DEFAULT_AGENT_NODE_SIZE.width + NODE_GAP_X),
    y: row * (DEFAULT_AGENT_NODE_SIZE.height + NODE_GAP_Y),
    width: DEFAULT_AGENT_NODE_SIZE.width,
    height: DEFAULT_AGENT_NODE_SIZE.height,
    role: "none",
  };
}

export function resolveAgentNodeLayout(
  index: number,
  saved: AgentCanvasNodeLayout | undefined,
): AgentCanvasNodeLayout {
  if (saved === undefined) return defaultAgentNodeLayout(index);
  return {
    ...saved,
    width: Math.min(MAX_AGENT_NODE_SIZE.width, Math.max(MIN_AGENT_NODE_SIZE.width, saved.width)),
    height: Math.min(
      MAX_AGENT_NODE_SIZE.height,
      Math.max(MIN_AGENT_NODE_SIZE.height, saved.height),
    ),
  };
}

export function defaultNotePlacement(
  existingCount: number,
): Pick<AgentCanvasNote, "x" | "y" | "width" | "height"> {
  return {
    x: 48 + (existingCount % 4) * (DEFAULT_NOTE_SIZE.width + 32),
    y: 48 + Math.floor(existingCount / 4) * (DEFAULT_NOTE_SIZE.height + 32),
    width: DEFAULT_NOTE_SIZE.width,
    height: DEFAULT_NOTE_SIZE.height,
  };
}

export function clampAgentNodeLayout(layout: AgentCanvasNodeLayout): AgentCanvasNodeLayout {
  return {
    ...layout,
    width: Math.min(MAX_AGENT_NODE_SIZE.width, Math.max(MIN_AGENT_NODE_SIZE.width, layout.width)),
    height: Math.min(
      MAX_AGENT_NODE_SIZE.height,
      Math.max(MIN_AGENT_NODE_SIZE.height, layout.height),
    ),
  };
}

/**
 * Detail level for a node. Only the focused on-screen node is interactive; others are
 * previews or chips so many agents stay cheap to draw.
 */
export function agentCanvasLod(input: {
  readonly focused: boolean;
  readonly onScreen: boolean;
  readonly zoom: number;
}): AgentCanvasLod {
  if (!input.onScreen) return "chip";
  if (input.zoom < 0.4) return "chip";
  if (input.focused && input.zoom >= 0.55) return "interactive";
  return "preview";
}

export function isNodeOnScreen(
  layout: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
  view: AgentCanvasView,
  viewport: { readonly width: number; readonly height: number },
  margin = 120,
): boolean {
  const left = layout.x * view.zoom + view.x;
  const top = layout.y * view.zoom + view.y;
  const right = (layout.x + layout.width) * view.zoom + view.x;
  const bottom = (layout.y + layout.height) * view.zoom + view.y;
  return (
    right >= -margin &&
    bottom >= -margin &&
    left <= viewport.width + margin &&
    top <= viewport.height + margin
  );
}

export function newCanvasEdgeId(source: string, target: string): string {
  return `e:${source}->${target}`;
}

export function resolveEdgeKind(input: {
  readonly sourceRole: AgentCanvasRole;
  readonly explicitKind?: AgentCanvasEdgeKind;
}): AgentCanvasEdgeKind {
  if (input.explicitKind !== undefined) return input.explicitKind;
  if (input.sourceRole === "lead" || input.sourceRole === "coordinator") return "lead";
  return "link";
}

/** Worker thread keys connected from a lead/coordinator (outgoing lead edges). */
export function workerKeysForLead(
  leadThreadKey: string,
  edges: ReadonlyArray<AgentCanvasEdge>,
): string[] {
  const leadId = agentFlowId(leadThreadKey);
  const workers: string[] = [];
  for (const edge of edges) {
    if (edge.kind !== "lead" || edge.source !== leadId) continue;
    const target = parseAgentFlowId(edge.target);
    if (target !== null) workers.push(target);
  }
  return workers;
}

export function createNoteId(): string {
  return `n_${Math.random().toString(36).slice(2, 10)}`;
}
