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

const NODE_GAP_X = 112;
const NODE_GAP_Y = 96;
const COLUMNS = 2;
const LEAD_TO_WORKER_GAP_X = 120;
const WORKER_STACK_GAP_Y = 64;
const DEFAULT_WORKER_NODE_SIZE = { width: 360, height: 300 } as const;

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
    y: 80 + row * (DEFAULT_AGENT_NODE_SIZE.height + NODE_GAP_Y),
    width: DEFAULT_AGENT_NODE_SIZE.width,
    height: DEFAULT_AGENT_NODE_SIZE.height,
    role: "none",
  };
}

/**
 * Place a worker in a clean column to the right of its lead, with even vertical spacing.
 * Index 0 is the top worker.
 */
export function defaultWorkerLayoutForLead(
  lead: Pick<AgentCanvasNodeLayout, "x" | "y" | "width" | "height">,
  workerIndex: number,
): Pick<AgentCanvasNodeLayout, "x" | "y" | "width" | "height"> {
  return {
    x: lead.x + lead.width + LEAD_TO_WORKER_GAP_X,
    y: lead.y + workerIndex * (DEFAULT_WORKER_NODE_SIZE.height + WORKER_STACK_GAP_Y),
    width: DEFAULT_WORKER_NODE_SIZE.width,
    height: DEFAULT_WORKER_NODE_SIZE.height,
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

/** Notes live on a lane above the agent grid so they never cover headers by default. */
export function defaultNotePlacement(
  existingCount: number,
): Pick<AgentCanvasNote, "x" | "y" | "width" | "height"> {
  return {
    x: 32 + (existingCount % 3) * (DEFAULT_NOTE_SIZE.width + 48),
    y:
      -DEFAULT_NOTE_SIZE.height -
      56 -
      Math.floor(existingCount / 3) * (DEFAULT_NOTE_SIZE.height + 32),
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

export type AgentCanvasPreviewKind = "goal" | "completed" | "running" | "titled" | "empty";

/** Chooses which preview copy a canvas card should show. */
export function agentCanvasPreviewKind(input: {
  readonly goalObjective: string | null | undefined;
  readonly title: string;
  readonly visibleItemCount: number;
  readonly latestRunStatus: string | null | undefined;
}): AgentCanvasPreviewKind {
  if (input.goalObjective?.trim()) return "goal";
  if (input.latestRunStatus === "completed") return "completed";
  if (input.latestRunStatus === "running") return "running";
  if (input.visibleItemCount > 0 || input.title.trim().length > 0) return "titled";
  return "empty";
}

/** Screenshot / demo harness: sessionStorage key holding per-thread preview overrides. */
const AGENT_CANVAS_SHOT_DEMO_KEY = "t3code:agent-canvas:shot-demo";

export type AgentCanvasShotDemoState = {
  readonly tone?: "running" | "attention" | "failed" | "idle" | "ready";
  readonly statusLabel?: string;
  readonly lines?: ReadonlyArray<string>;
  readonly modelLabel?: string;
  readonly stepsLabel?: string;
};

export function readShotDemo(threadKey: string): AgentCanvasShotDemoState | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AGENT_CANVAS_SHOT_DEMO_KEY);
    if (raw === null || raw.length === 0) return null;
    const parsed = JSON.parse(raw) as Record<string, AgentCanvasShotDemoState>;
    return parsed[threadKey] ?? parsed["*"] ?? null;
  } catch {
    return null;
  }
}
