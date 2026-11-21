import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "./lib/storage";

export type AgentCanvasMode = "normal" | "canvas";

export interface AgentCanvasNodeLayout {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface AgentCanvasView {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

interface AgentCanvasPersisted {
  mode: AgentCanvasMode;
  view: AgentCanvasView;
  nodes: Record<string, AgentCanvasNodeLayout>;
}

interface AgentCanvasStore extends AgentCanvasPersisted {
  setMode: (mode: AgentCanvasMode) => void;
  toggleMode: () => void;
  setView: (view: AgentCanvasView) => void;
  setNodeLayout: (threadKey: string, layout: AgentCanvasNodeLayout) => void;
  removeNodeLayout: (threadKey: string) => void;
  resetLayouts: () => void;
}

export const AGENT_CANVAS_STORAGE_KEY = "t3code:agent-canvas:v1";

export const DEFAULT_AGENT_NODE_SIZE = { width: 420, height: 520 } as const;
export const DEFAULT_AGENT_CANVAS_VIEW: AgentCanvasView = { x: 48, y: 48, scale: 1 };

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
  if (
    ![record.x, record.y, record.width, record.height].every(Number.isFinite) ||
    record.width < 240 ||
    record.height < 180
  ) {
    return null;
  }
  return {
    x: Math.max(0, record.x),
    y: Math.max(0, record.y),
    width: Math.min(1200, Math.max(240, record.width)),
    height: Math.min(1200, Math.max(180, record.height)),
  };
}

function sanitizeNodes(value: unknown): Record<string, AgentCanvasNodeLayout> {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, AgentCanvasNodeLayout> = {};
  for (const [key, layout] of Object.entries(value)) {
    if (key.length === 0) continue;
    const sanitized = sanitizeLayout(layout);
    if (sanitized !== null) next[key] = sanitized;
  }
  return next;
}

function sanitizeView(value: unknown): AgentCanvasView {
  if (!value || typeof value !== "object") return DEFAULT_AGENT_CANVAS_VIEW;
  const record = value as Record<string, unknown>;
  if (
    typeof record.x !== "number" ||
    typeof record.y !== "number" ||
    typeof record.scale !== "number" ||
    !Number.isFinite(record.x) ||
    !Number.isFinite(record.y) ||
    !Number.isFinite(record.scale) ||
    record.scale <= 0
  ) {
    return DEFAULT_AGENT_CANVAS_VIEW;
  }
  return {
    x: record.x,
    y: record.y,
    scale: Math.min(2.5, Math.max(0.25, record.scale)),
  };
}

export const useAgentCanvasStore = create<AgentCanvasStore>()(
  persist(
    (set, get) => ({
      mode: "normal",
      view: DEFAULT_AGENT_CANVAS_VIEW,
      nodes: {},
      setMode: (mode) => set({ mode }),
      toggleMode: () => set({ mode: get().mode === "canvas" ? "normal" : "canvas" }),
      setView: (view) => set({ view: sanitizeView(view) }),
      setNodeLayout: (threadKey, layout) => {
        const next = sanitizeLayout(layout);
        if (next === null) return;
        set((state) => {
          const previous = state.nodes[threadKey];
          if (
            previous &&
            previous.x === next.x &&
            previous.y === next.y &&
            previous.width === next.width &&
            previous.height === next.height
          ) {
            return state;
          }
          return { nodes: { ...state.nodes, [threadKey]: next } };
        });
      },
      removeNodeLayout: (threadKey) =>
        set((state) => {
          if (!(threadKey in state.nodes)) return state;
          const { [threadKey]: _removed, ...nodes } = state.nodes;
          return { nodes };
        }),
      resetLayouts: () => set({ nodes: {}, view: DEFAULT_AGENT_CANVAS_VIEW }),
    }),
    {
      name: AGENT_CANVAS_STORAGE_KEY,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: (state): AgentCanvasPersisted => ({
        mode: state.mode,
        view: state.view,
        nodes: state.nodes,
      }),
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as Partial<AgentCanvasPersisted>;
        return {
          ...current,
          mode: raw.mode === "canvas" ? "canvas" : "normal",
          view: sanitizeView(raw.view),
          nodes: sanitizeNodes(raw.nodes),
        };
      },
    },
  ),
);
