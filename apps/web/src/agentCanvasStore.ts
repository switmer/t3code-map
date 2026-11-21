import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "./lib/storage";

export type AgentCanvasMode = "normal" | "canvas";

/** Canvas-local leadership role. Does not change server lineage. */
export type AgentCanvasRole = "none" | "lead" | "coordinator" | "worker";

export type AgentCanvasEdgeKind = "lead" | "link";

export interface AgentCanvasNodeLayout {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly role: AgentCanvasRole;
}

export interface AgentCanvasNote {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly text: string;
}

export interface AgentCanvasEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly kind: AgentCanvasEdgeKind;
  readonly sourceHandle?: string;
  readonly targetHandle?: string;
}

/** React Flow viewport (zoom, not scale). */
export interface AgentCanvasView {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

interface AgentCanvasSnapshot {
  readonly agents: Record<string, AgentCanvasNodeLayout>;
  readonly notes: Record<string, AgentCanvasNote>;
  readonly edges: ReadonlyArray<AgentCanvasEdge>;
}

interface AgentCanvasPersisted {
  mode: AgentCanvasMode;
  view: AgentCanvasView;
  agents: Record<string, AgentCanvasNodeLayout>;
  notes: Record<string, AgentCanvasNote>;
  edges: AgentCanvasEdge[];
}

interface AgentCanvasStore extends AgentCanvasPersisted {
  past: AgentCanvasSnapshot[];
  future: AgentCanvasSnapshot[];
  setMode: (mode: AgentCanvasMode) => void;
  toggleMode: () => void;
  setView: (view: AgentCanvasView) => void;
  setAgentLayout: (threadKey: string, layout: AgentCanvasNodeLayout) => void;
  setAgentRole: (threadKey: string, role: AgentCanvasRole) => void;
  upsertNote: (note: AgentCanvasNote) => void;
  removeNote: (noteId: string) => void;
  setEdges: (edges: ReadonlyArray<AgentCanvasEdge>) => void;
  addEdge: (edge: AgentCanvasEdge) => void;
  removeEdges: (edgeIds: ReadonlyArray<string>) => void;
  removeSelection: (input: {
    readonly agentKeys?: ReadonlyArray<string>;
    readonly noteIds?: ReadonlyArray<string>;
    readonly edgeIds?: ReadonlyArray<string>;
  }) => void;
  resetLayouts: () => void;
  undo: () => void;
  redo: () => void;
  /** Capture a history checkpoint before a user gesture that mutates the graph. */
  pushHistory: () => void;
}

export const AGENT_CANVAS_STORAGE_KEY = "t3code:agent-canvas:v2";

export const DEFAULT_AGENT_NODE_SIZE = { width: 560, height: 640 } as const;
export const MIN_AGENT_NODE_SIZE = { width: 320, height: 240 } as const;
export const MAX_AGENT_NODE_SIZE = { width: 1400, height: 1200 } as const;
export const DEFAULT_NOTE_SIZE = { width: 240, height: 160 } as const;
const DEFAULT_AGENT_CANVAS_VIEW: AgentCanvasView = { x: 64, y: 64, zoom: 0.85 };

const HISTORY_LIMIT = 40;

function isRole(value: unknown): value is AgentCanvasRole {
  return value === "none" || value === "lead" || value === "coordinator" || value === "worker";
}

function sanitizeLayout(value: unknown): AgentCanvasNodeLayout | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.x !== "number" ||
    typeof record.y !== "number" ||
    typeof record.width !== "number" ||
    typeof record.height !== "number"
  ) {
    return null;
  }
  if (![record.x, record.y, record.width, record.height].every(Number.isFinite)) return null;
  return {
    x: record.x,
    y: record.y,
    width: Math.min(MAX_AGENT_NODE_SIZE.width, Math.max(MIN_AGENT_NODE_SIZE.width, record.width)),
    height: Math.min(
      MAX_AGENT_NODE_SIZE.height,
      Math.max(MIN_AGENT_NODE_SIZE.height, record.height),
    ),
    role: isRole(record.role) ? record.role : "none",
  };
}

function sanitizeAgents(value: unknown): Record<string, AgentCanvasNodeLayout> {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, AgentCanvasNodeLayout> = {};
  for (const [key, layout] of Object.entries(value)) {
    if (key.length === 0) continue;
    const sanitized = sanitizeLayout(layout);
    if (sanitized !== null) next[key] = sanitized;
  }
  return next;
}

/** Migrate v1 `{ nodes }` payloads that only stored x/y/width/height. */
function sanitizeAgentsFromLegacy(value: unknown): Record<string, AgentCanvasNodeLayout> {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, AgentCanvasNodeLayout> = {};
  for (const [key, layout] of Object.entries(value)) {
    if (key.length === 0 || !layout || typeof layout !== "object") continue;
    const record = layout as Record<string, unknown>;
    const sanitized = sanitizeLayout({ ...record, role: record.role ?? "none" });
    if (sanitized !== null) next[key] = sanitized;
  }
  return next;
}

function sanitizeNote(value: unknown): AgentCanvasNote | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    record.id.length === 0 ||
    typeof record.x !== "number" ||
    typeof record.y !== "number" ||
    typeof record.width !== "number" ||
    typeof record.height !== "number" ||
    typeof record.text !== "string"
  ) {
    return null;
  }
  if (![record.x, record.y, record.width, record.height].every(Number.isFinite)) return null;
  return {
    id: record.id,
    x: record.x,
    y: record.y,
    width: Math.min(640, Math.max(140, record.width)),
    height: Math.min(640, Math.max(100, record.height)),
    text: record.text.slice(0, 4000),
  };
}

function sanitizeNotes(value: unknown): Record<string, AgentCanvasNote> {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, AgentCanvasNote> = {};
  for (const [key, note] of Object.entries(value)) {
    const sanitized = sanitizeNote(note);
    if (sanitized !== null) next[key] = sanitized;
  }
  return next;
}

function sanitizeEdge(value: unknown): AgentCanvasEdge | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.source !== "string" ||
    typeof record.target !== "string" ||
    record.source.length === 0 ||
    record.target.length === 0 ||
    record.source === record.target
  ) {
    return null;
  }
  const kind: AgentCanvasEdgeKind = record.kind === "lead" ? "lead" : "link";
  return {
    id: record.id,
    source: record.source,
    target: record.target,
    kind,
    ...(typeof record.sourceHandle === "string" ? { sourceHandle: record.sourceHandle } : {}),
    ...(typeof record.targetHandle === "string" ? { targetHandle: record.targetHandle } : {}),
  };
}

function sanitizeEdges(value: unknown): AgentCanvasEdge[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const next: AgentCanvasEdge[] = [];
  for (const edge of value) {
    const sanitized = sanitizeEdge(edge);
    if (sanitized === null || seen.has(sanitized.id)) continue;
    seen.add(sanitized.id);
    next.push(sanitized);
  }
  return next;
}

function sanitizeView(value: unknown): AgentCanvasView {
  if (!value || typeof value !== "object") return DEFAULT_AGENT_CANVAS_VIEW;
  const record = value as Record<string, unknown>;
  const zoom =
    typeof record.zoom === "number"
      ? record.zoom
      : typeof record.scale === "number"
        ? record.scale
        : null;
  if (
    typeof record.x !== "number" ||
    typeof record.y !== "number" ||
    zoom === null ||
    !Number.isFinite(record.x) ||
    !Number.isFinite(record.y) ||
    !Number.isFinite(zoom) ||
    zoom <= 0
  ) {
    return DEFAULT_AGENT_CANVAS_VIEW;
  }
  return {
    x: record.x,
    y: record.y,
    zoom: Math.min(2.5, Math.max(0.2, zoom)),
  };
}

function snapshotOf(state: AgentCanvasPersisted): AgentCanvasSnapshot {
  return {
    agents: state.agents,
    notes: state.notes,
    edges: state.edges,
  };
}

function layoutsEqual(a: AgentCanvasNodeLayout, b: AgentCanvasNodeLayout): boolean {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.role === b.role
  );
}

export const useAgentCanvasStore = create<AgentCanvasStore>()(
  persist(
    (set, get) => ({
      mode: "normal",
      view: DEFAULT_AGENT_CANVAS_VIEW,
      agents: {},
      notes: {},
      edges: [],
      past: [],
      future: [],
      setMode: (mode) => set({ mode }),
      toggleMode: () => set({ mode: get().mode === "canvas" ? "normal" : "canvas" }),
      setView: (view) => set({ view: sanitizeView(view) }),
      pushHistory: () => {
        const state = get();
        const snap = snapshotOf(state);
        set({
          past: [...state.past.slice(-(HISTORY_LIMIT - 1)), snap],
          future: [],
        });
      },
      setAgentLayout: (threadKey, layout) => {
        const next = sanitizeLayout(layout);
        if (next === null) return;
        set((state) => {
          const previous = state.agents[threadKey];
          if (previous && layoutsEqual(previous, next)) return state;
          return { agents: { ...state.agents, [threadKey]: next } };
        });
      },
      setAgentRole: (threadKey, role) => {
        set((state) => {
          const previous = state.agents[threadKey];
          if (previous?.role === role) return state;
          const base = previous ?? {
            x: 0,
            y: 0,
            width: DEFAULT_AGENT_NODE_SIZE.width,
            height: DEFAULT_AGENT_NODE_SIZE.height,
            role: "none" as const,
          };
          return {
            agents: { ...state.agents, [threadKey]: { ...base, role } },
          };
        });
      },
      upsertNote: (note) => {
        const sanitized = sanitizeNote(note);
        if (sanitized === null) return;
        set((state) => ({ notes: { ...state.notes, [sanitized.id]: sanitized } }));
      },
      removeNote: (noteId) =>
        set((state) => {
          if (!(noteId in state.notes)) return state;
          const { [noteId]: _removed, ...notes } = state.notes;
          const noteNodeId = `note:${noteId}`;
          return {
            notes,
            edges: state.edges.filter(
              (edge) => edge.source !== noteNodeId && edge.target !== noteNodeId,
            ),
          };
        }),
      setEdges: (edges) => set({ edges: sanitizeEdges(edges) }),
      addEdge: (edge) => {
        const sanitized = sanitizeEdge(edge);
        if (sanitized === null) return;
        set((state) => {
          if (state.edges.some((existing) => existing.id === sanitized.id)) return state;
          if (
            state.edges.some(
              (existing) =>
                existing.source === sanitized.source && existing.target === sanitized.target,
            )
          ) {
            return state;
          }
          return { edges: [...state.edges, sanitized] };
        });
      },
      removeEdges: (edgeIds) => {
        if (edgeIds.length === 0) return;
        const remove = new Set(edgeIds);
        set((state) => ({ edges: state.edges.filter((edge) => !remove.has(edge.id)) }));
      },
      removeSelection: ({ agentKeys = [], noteIds = [], edgeIds = [] }) => {
        const agentsToDrop = new Set(agentKeys);
        const notesToDrop = new Set(noteIds);
        const edgesToDrop = new Set(edgeIds);
        set((state) => {
          const agents = { ...state.agents };
          for (const key of agentsToDrop) delete agents[key];
          const notes = { ...state.notes };
          for (const id of notesToDrop) delete notes[id];
          const droppedNodeIds = new Set<string>([
            ...[...agentsToDrop].map((key) => `agent:${key}`),
            ...[...notesToDrop].map((id) => `note:${id}`),
          ]);
          const edges = state.edges.filter(
            (edge) =>
              !edgesToDrop.has(edge.id) &&
              !droppedNodeIds.has(edge.source) &&
              !droppedNodeIds.has(edge.target),
          );
          return { agents, notes, edges };
        });
      },
      resetLayouts: () =>
        set({
          agents: {},
          notes: {},
          edges: [],
          view: DEFAULT_AGENT_CANVAS_VIEW,
          past: [],
          future: [],
        }),
      undo: () => {
        const state = get();
        const previous = state.past.at(-1);
        if (previous === undefined) return;
        set({
          agents: previous.agents,
          notes: previous.notes,
          edges: [...previous.edges],
          past: state.past.slice(0, -1),
          future: [snapshotOf(state), ...state.future].slice(0, HISTORY_LIMIT),
        });
      },
      redo: () => {
        const state = get();
        const next = state.future[0];
        if (next === undefined) return;
        set({
          agents: next.agents,
          notes: next.notes,
          edges: [...next.edges],
          past: [...state.past, snapshotOf(state)].slice(-HISTORY_LIMIT),
          future: state.future.slice(1),
        });
      },
    }),
    {
      name: AGENT_CANVAS_STORAGE_KEY,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: (state): AgentCanvasPersisted => ({
        mode: state.mode,
        view: state.view,
        agents: state.agents,
        notes: state.notes,
        edges: state.edges,
      }),
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as Partial<AgentCanvasPersisted> & {
          readonly nodes?: unknown;
          readonly scale?: unknown;
        };
        const agents =
          raw.agents !== undefined
            ? sanitizeAgents(raw.agents)
            : sanitizeAgentsFromLegacy(raw.nodes);
        return {
          ...current,
          mode: raw.mode === "canvas" ? "canvas" : "normal",
          view: sanitizeView(raw.view),
          agents,
          notes: sanitizeNotes(raw.notes),
          edges: sanitizeEdges(raw.edges),
          past: [],
          future: [],
        };
      },
    },
  ),
);
