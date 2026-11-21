import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "~/lib/storage";
import type { FleetCanvasPositions, FleetPoint, FleetViewTransform } from "./environmentsMap.logic";
import { moveFleetCanvasPosition } from "./environmentsMap.logic";

export type EnvironmentsLayoutMode = "map" | "list" | "canvas";

interface EnvironmentsCanvasPersisted {
  preferredView: EnvironmentsLayoutMode | null;
  positions: FleetCanvasPositions;
  view: FleetViewTransform | null;
}

interface EnvironmentsCanvasStore extends EnvironmentsCanvasPersisted {
  setPreferredView: (view: EnvironmentsLayoutMode | null) => void;
  moveNode: (id: string, point: FleetPoint) => void;
  setView: (view: FleetViewTransform | null) => void;
  resetPositions: () => void;
}

const STORAGE_KEY = "t3code:environments-canvas:v1";

function sanitizePoint(value: unknown): FleetPoint | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.x !== "number" || typeof record.y !== "number") return null;
  if (!Number.isFinite(record.x) || !Number.isFinite(record.y)) return null;
  return { x: Math.max(0, record.x), y: Math.max(0, record.y) };
}

function sanitizePositions(value: unknown): FleetCanvasPositions {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, FleetPoint> = {};
  for (const [id, point] of Object.entries(value)) {
    if (id.length === 0) continue;
    const sanitized = sanitizePoint(point);
    if (sanitized !== null) next[id] = sanitized;
  }
  return next;
}

function sanitizeView(value: unknown): FleetViewTransform | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.x !== "number" ||
    typeof record.y !== "number" ||
    typeof record.scale !== "number"
  ) {
    return null;
  }
  if (
    !Number.isFinite(record.x) ||
    !Number.isFinite(record.y) ||
    !Number.isFinite(record.scale) ||
    record.scale <= 0
  ) {
    return null;
  }
  return { x: record.x, y: record.y, scale: record.scale };
}

function sanitizePreferredView(value: unknown): EnvironmentsLayoutMode | null {
  return value === "map" || value === "list" || value === "canvas" ? value : null;
}

export const useEnvironmentsCanvasStore = create<EnvironmentsCanvasStore>()(
  persist(
    (set) => ({
      preferredView: null,
      positions: {},
      view: null,
      setPreferredView: (preferredView) => set({ preferredView }),
      moveNode: (id, point) =>
        set((state) => ({ positions: moveFleetCanvasPosition(state.positions, id, point) })),
      setView: (view) => set({ view }),
      resetPositions: () => set({ positions: {}, view: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: (state): EnvironmentsCanvasPersisted => ({
        preferredView: state.preferredView,
        positions: state.positions,
        view: state.view,
      }),
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as Partial<EnvironmentsCanvasPersisted>;
        return {
          ...current,
          preferredView: sanitizePreferredView(raw.preferredView),
          positions: sanitizePositions(raw.positions),
          view: sanitizeView(raw.view),
        };
      },
    },
  ),
);
