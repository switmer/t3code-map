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

/** On-screen agents mount live ChatViews at this zoom and above. */
export const AGENT_CANVAS_INTERACTIVE_ZOOM = 0.55;

const NODE_GAP_X = 72;
const NODE_GAP_Y = 56;
const COLUMNS = 3;
const LEAD_TO_WORKER_GAP_X = 72;
const WORKER_STACK_GAP_Y = 24;
const WORKER_GRID_GAP_X = 40;
const WORKER_GRID_GAP_Y = 24;
/** Compact worker cards so 3–4 still frame clear of toolbar chrome. */
const DEFAULT_WORKER_NODE_SIZE = { width: 360, height: 300 } as const;
/** Nodes parked farther than this are ignored by fit-view / minimap framing. */
const AGENT_CANVAS_SCENE_BOUND = 2800;

/** Screen-space chrome that fit must clear (toolbar, minimap, zoom badge). */
export const AGENT_CANVAS_FIT_CHROME = {
  top: 56,
  right: 200,
  bottom: 120,
  left: 40,
} as const;

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
 * Place workers beside a lead. 1–2 workers stack vertically; 3+ use a 2-column
 * grid so the cluster still fits above the floating toolbar at interactive zoom.
 */
export function defaultWorkerLayoutForLead(
  lead: Pick<AgentCanvasNodeLayout, "x" | "y" | "width" | "height">,
  workerIndex: number,
  workerCount = 1,
): Pick<AgentCanvasNodeLayout, "x" | "y" | "width" | "height"> {
  const w = DEFAULT_WORKER_NODE_SIZE.width;
  const h = DEFAULT_WORKER_NODE_SIZE.height;
  const startX = lead.x + lead.width + LEAD_TO_WORKER_GAP_X;
  const count = Math.max(1, workerCount);

  if (count <= 2) {
    const stackH = count * h + Math.max(0, count - 1) * WORKER_STACK_GAP_Y;
    const top = lead.y + Math.max(0, (lead.height - stackH) / 2);
    return {
      x: startX,
      y: top + workerIndex * (h + WORKER_STACK_GAP_Y),
      width: w,
      height: h,
    };
  }

  const col = workerIndex % 2;
  const row = Math.floor(workerIndex / 2);
  const rows = Math.ceil(count / 2);
  const gridH = rows * h + Math.max(0, rows - 1) * WORKER_GRID_GAP_Y;
  const top = lead.y + Math.max(0, (lead.height - gridH) / 2);
  return {
    x: startX + col * (w + WORKER_GRID_GAP_X),
    y: top + row * (h + WORKER_GRID_GAP_Y),
    width: w,
    height: h,
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
 * Zoom-based detail for a node. Every on-screen agent is a live thread at normal zoom;
 * far-out zoom falls back to preview/chip so ~10–20 nodes stay smooth.
 */
export function agentCanvasLod(input: {
  readonly focused: boolean;
  readonly onScreen: boolean;
  readonly zoom: number;
}): AgentCanvasLod {
  if (!input.onScreen) return "chip";
  // Below ~40%: counter-scaled chips so status stays legible when zoomed out.
  if (input.zoom < 0.4) return "chip";
  if (input.zoom < AGENT_CANVAS_INTERACTIVE_ZOOM) return "preview";
  return "interactive";
}

/** True when the full card (not just a sliver) sits inside the viewport with padding. */
export function isNodeFullyFramed(
  layout: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
  view: AgentCanvasView,
  viewport: { readonly width: number; readonly height: number },
  pad = 20,
): boolean {
  const left = layout.x * view.zoom + view.x;
  const top = layout.y * view.zoom + view.y;
  const right = (layout.x + layout.width) * view.zoom + view.x;
  const bottom = (layout.y + layout.height) * view.zoom + view.y;
  return (
    left >= pad && top >= pad && right <= viewport.width - pad && bottom <= viewport.height - pad
  );
}

/** True when every node clears the fit chrome (toolbar / minimap / zoom). */
export function isSceneClearOfChrome(
  layouts: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }>,
  view: AgentCanvasView,
  viewport: { readonly width: number; readonly height: number },
  chrome: typeof AGENT_CANVAS_FIT_CHROME = AGENT_CANVAS_FIT_CHROME,
): boolean {
  return layouts.every((layout) => {
    const left = layout.x * view.zoom + view.x;
    const top = layout.y * view.zoom + view.y;
    const right = (layout.x + layout.width) * view.zoom + view.x;
    const bottom = (layout.y + layout.height) * view.zoom + view.y;
    return (
      left >= chrome.left &&
      top >= chrome.top &&
      right <= viewport.width - chrome.right &&
      bottom <= viewport.height - chrome.bottom
    );
  });
}

/**
 * Fit nodes into the viewport while reserving chrome insets so cards never sit
 * under the toolbar, minimap, or zoom badge.
 */
export function computeFitViewport(
  nodes: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }>,
  viewport: { readonly width: number; readonly height: number },
  options?: {
    readonly chrome?: typeof AGENT_CANVAS_FIT_CHROME;
    readonly minZoom?: number;
    readonly maxZoom?: number;
  },
): AgentCanvasView {
  const chrome = options?.chrome ?? AGENT_CANVAS_FIT_CHROME;
  const minZoom = options?.minZoom ?? 0.35;
  const maxZoom = options?.maxZoom ?? 1;
  if (nodes.length === 0 || viewport.width <= 0 || viewport.height <= 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  const contentW = Math.max(1, maxX - minX);
  const contentH = Math.max(1, maxY - minY);
  const availW = Math.max(1, viewport.width - chrome.left - chrome.right);
  const availH = Math.max(1, viewport.height - chrome.top - chrome.bottom);
  const zoom = Math.min(maxZoom, Math.max(minZoom, Math.min(availW / contentW, availH / contentH)));
  const usedW = contentW * zoom;
  const usedH = contentH * zoom;
  return {
    x: chrome.left + (availW - usedW) / 2 - minX * zoom,
    y: chrome.top + (availH - usedH) / 2 - minY * zoom,
    zoom,
  };
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

/** Lead fan-out source handle ids (spread evenly down the right edge). */
export const LEAD_SOURCE_HANDLES = ["out-0", "out-1", "out-2", "out-3", "out-4", "out-5"] as const;

/** Evenly spaced tops for lead fan handles (percent of node height). */
export function leadHandleTopPercent(index: number, total = LEAD_SOURCE_HANDLES.length): string {
  const count = Math.max(1, total);
  const slot = Math.min(Math.max(index, 0), count - 1);
  const t = ((slot + 1) / (count + 1)) * 100;
  return `${t}%`;
}

/**
 * Map a fan index among `total` workers onto the evenly spaced handle slots
 * so 1–N edges leave from distinct, well-spread outlets.
 */
export function leadSourceHandleForIndex(index: number, total = 1): string {
  const count = Math.max(1, total);
  if (count === 1) {
    return LEAD_SOURCE_HANDLES[Math.floor((LEAD_SOURCE_HANDLES.length - 1) / 2)]!;
  }
  const slot = Math.min(
    LEAD_SOURCE_HANDLES.length - 1,
    Math.max(0, Math.floor((index * LEAD_SOURCE_HANDLES.length) / count)),
  );
  return LEAD_SOURCE_HANDLES[slot]!;
}

export function isInCanvasScene(position: { readonly x: number; readonly y: number }): boolean {
  return (
    position.x > -AGENT_CANVAS_SCENE_BOUND &&
    position.y > -AGENT_CANVAS_SCENE_BOUND &&
    position.x < AGENT_CANVAS_SCENE_BOUND &&
    position.y < AGENT_CANVAS_SCENE_BOUND
  );
}

type Rect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** True when two axis-aligned rects overlap (with optional gutter). */
export function rectsOverlap(a: Rect, b: Rect, gap = 16): boolean {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

/** First free slot in a spreading grid that does not collide with occupied rects. */
export function findFreeAgentSlot(
  occupied: ReadonlyArray<Rect>,
  size: Pick<Rect, "width" | "height"> = DEFAULT_AGENT_NODE_SIZE,
): Pick<AgentCanvasNodeLayout, "x" | "y" | "width" | "height"> {
  for (let index = 0; index < 64; index += 1) {
    const candidate = {
      ...defaultAgentNodeLayout(index),
      width: size.width,
      height: size.height,
    };
    if (!occupied.some((rect) => rectsOverlap(candidate, rect))) {
      return {
        x: candidate.x,
        y: candidate.y,
        width: candidate.width,
        height: candidate.height,
      };
    }
  }
  // Fall back far to the right of everything rather than stacking.
  let maxX = 0;
  for (const rect of occupied) maxX = Math.max(maxX, rect.x + rect.width);
  return {
    x: maxX + NODE_GAP_X,
    y: 80,
    width: size.width,
    height: size.height,
  };
}

/**
 * Ensure every in-scene agent has a non-overlapping layout. Leads/workers keep
 * preferred positions when free; unknown/new nodes claim the next free slot.
 * Off-scene (parked) layouts are left alone.
 */
export function resolveNonOverlappingAgentLayouts(input: {
  readonly threadKeys: ReadonlyArray<string>;
  readonly saved: Readonly<Record<string, AgentCanvasNodeLayout>>;
  readonly notes?: ReadonlyArray<Rect>;
}): Record<string, AgentCanvasNodeLayout> {
  const next: Record<string, AgentCanvasNodeLayout> = {};
  const occupied: Rect[] = [...(input.notes ?? [])];

  // Preserve lead-like nodes first so workers can stay beside them.
  const ordered = [...input.threadKeys].sort((a, b) => {
    const roleRank = (key: string) => {
      const role = input.saved[key]?.role ?? "none";
      if (role === "lead" || role === "coordinator") return 0;
      if (role === "worker") return 1;
      return 2;
    };
    return roleRank(a) - roleRank(b);
  });

  for (const [index, key] of ordered.entries()) {
    const saved = input.saved[key];
    if (saved === undefined) {
      // Never placed on this canvas: park off-scene so project history does not flood
      // the board. Spawn / new-thread / duplicate call setAgentLayout into a free slot.
      next[key] = {
        x: AGENT_CANVAS_SCENE_BOUND + 400 + (index % 8) * 400,
        y: AGENT_CANVAS_SCENE_BOUND + 400 + Math.floor(index / 8) * 360,
        width: DEFAULT_AGENT_NODE_SIZE.width,
        height: DEFAULT_AGENT_NODE_SIZE.height,
        role: "none",
      };
      continue;
    }
    const base = resolveAgentNodeLayout(index, saved);
    if (!isInCanvasScene(base)) {
      next[key] = base;
      continue;
    }
    const collides = occupied.some((rect) => rectsOverlap(base, rect));
    const placed = collides
      ? {
          ...base,
          ...findFreeAgentSlot(occupied, { width: base.width, height: base.height }),
        }
      : base;
    next[key] = placed;
    occupied.push(placed);
  }
  return next;
}

/** Card needs the user (approval, input, finished turn, or failure). */
export function threadNeedsAttention(thread: {
  readonly hasPendingApprovals: boolean;
  readonly hasPendingUserInput: boolean;
  readonly latestRun?: { readonly status: string } | null;
}): boolean {
  if (thread.hasPendingApprovals || thread.hasPendingUserInput) return true;
  const status = thread.latestRun?.status;
  return status === "failed" || status === "completed";
}

export type AgentCanvasStatusTone = "running" | "attention" | "failed" | "idle" | "ready";

export function agentCanvasStatusTone(thread: {
  readonly hasPendingApprovals: boolean;
  readonly hasPendingUserInput: boolean;
  readonly runtime?: { readonly status: string } | null;
  readonly latestRun?: { readonly status: string } | null;
}): AgentCanvasStatusTone {
  if (thread.hasPendingApprovals || thread.hasPendingUserInput) return "attention";
  if (thread.runtime?.status === "running" || thread.latestRun?.status === "running") {
    return "running";
  }
  if (thread.latestRun?.status === "failed") return "failed";
  if (thread.latestRun?.status === "completed") return "idle";
  return "ready";
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
  readonly title?: string;
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
