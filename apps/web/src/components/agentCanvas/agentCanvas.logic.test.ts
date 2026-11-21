import { describe, expect, it } from "vite-plus/test";

import {
  agentCanvasLod,
  agentFlowId,
  clampAgentNodeLayout,
  defaultAgentNodeLayout,
  isNodeOnScreen,
  newCanvasEdgeId,
  noteFlowId,
  parseAgentFlowId,
  parseNoteFlowId,
  resolveAgentNodeLayout,
  resolveEdgeKind,
  workerKeysForLead,
} from "./agentCanvas.logic";

describe("agent canvas layout", () => {
  it("places unsaved agents on a spreading grid with larger defaults", () => {
    expect(defaultAgentNodeLayout(0)).toMatchObject({
      x: 0,
      y: 0,
      width: 560,
      height: 640,
      role: "none",
    });
    expect(defaultAgentNodeLayout(1).x).toBeGreaterThan(0);
    expect(
      resolveAgentNodeLayout(2, {
        x: 10,
        y: 20,
        width: 600,
        height: 700,
        role: "lead",
      }),
    ).toEqual({
      x: 10,
      y: 20,
      width: 600,
      height: 700,
      role: "lead",
    });
  });

  it("picks lod from focus, visibility, and zoom", () => {
    expect(agentCanvasLod({ focused: true, onScreen: true, zoom: 1 })).toBe("interactive");
    expect(agentCanvasLod({ focused: false, onScreen: true, zoom: 1 })).toBe("preview");
    expect(agentCanvasLod({ focused: true, onScreen: true, zoom: 0.3 })).toBe("chip");
    expect(agentCanvasLod({ focused: true, onScreen: false, zoom: 1 })).toBe("chip");
  });

  it("detects off-screen cards and clamps layouts", () => {
    const layout = { x: 0, y: 0, width: 560, height: 640 };
    expect(isNodeOnScreen(layout, { x: 0, y: 0, zoom: 1 }, { width: 800, height: 600 })).toBe(true);
    expect(
      isNodeOnScreen(layout, { x: -2000, y: -2000, zoom: 1 }, { width: 800, height: 600 }),
    ).toBe(false);
    expect(
      clampAgentNodeLayout({ x: -4, y: 8, width: 100, height: 50, role: "none" }),
    ).toMatchObject({
      width: 320,
      height: 240,
    });
  });

  it("builds lead edges and worker rollups", () => {
    expect(agentFlowId("env:a")).toBe("agent:env:a");
    expect(parseAgentFlowId("agent:env:a")).toBe("env:a");
    expect(noteFlowId("n1")).toBe("note:n1");
    expect(parseNoteFlowId("note:n1")).toBe("n1");
    expect(newCanvasEdgeId("a", "b")).toBe("e:a->b");
    expect(resolveEdgeKind({ sourceRole: "lead" })).toBe("lead");
    expect(resolveEdgeKind({ sourceRole: "none" })).toBe("link");
    expect(
      workerKeysForLead("lead-key", [
        {
          id: "1",
          source: "agent:lead-key",
          target: "agent:worker-1",
          kind: "lead",
        },
        {
          id: "2",
          source: "agent:lead-key",
          target: "note:n1",
          kind: "link",
        },
      ]),
    ).toEqual(["worker-1"]);
  });
});
