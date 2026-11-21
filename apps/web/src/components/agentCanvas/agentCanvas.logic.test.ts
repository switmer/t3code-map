import { describe, expect, it } from "vite-plus/test";

import {
  agentCanvasLod,
  clampAgentNodeLayout,
  defaultAgentNodeLayout,
  isNodeOnScreen,
  panAgentCanvasView,
  resolveAgentNodeLayout,
  zoomAgentCanvasView,
} from "./agentCanvas.logic";

describe("agent canvas layout", () => {
  it("places unsaved agents on a spreading grid", () => {
    expect(defaultAgentNodeLayout(0)).toEqual({ x: 0, y: 0, width: 420, height: 520 });
    expect(defaultAgentNodeLayout(1).x).toBeGreaterThan(0);
    expect(resolveAgentNodeLayout(2, { x: 10, y: 20, width: 300, height: 400 })).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 400,
    });
  });

  it("zooms around an anchor and pans by deltas", () => {
    const view = { x: 10, y: 20, scale: 1 };
    expect(zoomAgentCanvasView(view, 2, { x: 100, y: 100 })).toEqual({
      scale: 2,
      x: -80,
      y: -60,
    });
    expect(panAgentCanvasView(view, 5, -3)).toEqual({ x: 15, y: 17, scale: 1 });
  });

  it("picks lod from focus, visibility, and zoom", () => {
    expect(agentCanvasLod({ focused: true, onScreen: true, scale: 1 })).toBe("interactive");
    expect(agentCanvasLod({ focused: false, onScreen: true, scale: 1 })).toBe("preview");
    expect(agentCanvasLod({ focused: true, onScreen: true, scale: 0.3 })).toBe("chip");
    expect(agentCanvasLod({ focused: true, onScreen: false, scale: 1 })).toBe("chip");
  });

  it("detects off-screen cards and clamps layouts", () => {
    const layout = { x: 0, y: 0, width: 420, height: 520 };
    expect(isNodeOnScreen(layout, { x: 0, y: 0, scale: 1 }, { width: 800, height: 600 })).toBe(
      true,
    );
    expect(
      isNodeOnScreen(layout, { x: -2000, y: -2000, scale: 1 }, { width: 800, height: 600 }),
    ).toBe(false);
    expect(clampAgentNodeLayout({ x: -4, y: 8, width: 100, height: 50 })).toEqual({
      x: 0,
      y: 8,
      width: 240,
      height: 180,
    });
  });
});
