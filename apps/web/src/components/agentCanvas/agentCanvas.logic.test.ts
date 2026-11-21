import { describe, expect, it } from "vite-plus/test";

import {
  AGENT_CANVAS_INTERACTIVE_ZOOM,
  agentCanvasLod,
  agentCanvasPreviewKind,
  agentFlowId,
  clampAgentNodeLayout,
  defaultAgentNodeLayout,
  defaultWorkerLayoutForLead,
  isNodeFullyFramed,
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
  it("places unsaved agents on a spreading grid with roomy gutters", () => {
    expect(defaultAgentNodeLayout(0)).toMatchObject({
      x: 0,
      y: 80,
      width: 380,
      height: 340,
      role: "none",
    });
    expect(defaultAgentNodeLayout(1).x).toBeGreaterThan(defaultAgentNodeLayout(0).width);
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

  it("stacks workers in a clean column beside a lead", () => {
    const lead = { x: 40, y: 80, width: 400, height: 360 };
    const first = defaultWorkerLayoutForLead(lead, 0);
    const second = defaultWorkerLayoutForLead(lead, 1);
    expect(first.x).toBe(lead.x + lead.width + 72);
    expect(first.y).toBe(lead.y);
    expect(second.y).toBe(first.y);
    expect(second.x).toBeGreaterThan(first.x + first.width);
  });

  it("picks lod from visibility and zoom (all on-screen agents interactive at normal zoom)", () => {
    expect(AGENT_CANVAS_INTERACTIVE_ZOOM).toBe(0.55);
    expect(agentCanvasLod({ focused: true, onScreen: true, zoom: 1 })).toBe("interactive");
    expect(agentCanvasLod({ focused: false, onScreen: true, zoom: 1 })).toBe("interactive");
    expect(agentCanvasLod({ focused: false, onScreen: true, zoom: 0.45 })).toBe("preview");
    expect(agentCanvasLod({ focused: true, onScreen: true, zoom: 0.3 })).toBe("chip");
    expect(agentCanvasLod({ focused: true, onScreen: false, zoom: 1 })).toBe("chip");
  });

  it("detects off-screen cards and clamps layouts", () => {
    const layout = { x: 0, y: 0, width: 380, height: 340 };
    expect(isNodeOnScreen(layout, { x: 0, y: 0, zoom: 1 }, { width: 800, height: 600 })).toBe(true);
    expect(
      isNodeOnScreen(layout, { x: -2000, y: -2000, zoom: 1 }, { width: 800, height: 600 }),
    ).toBe(false);
    expect(
      isNodeFullyFramed(layout, { x: 20, y: 20, zoom: 1 }, { width: 800, height: 600 }, 16),
    ).toBe(true);
    expect(
      isNodeFullyFramed(layout, { x: -10, y: 20, zoom: 1 }, { width: 800, height: 600 }, 16),
    ).toBe(false);
    expect(
      clampAgentNodeLayout({ x: -4, y: 8, width: 100, height: 50, role: "none" }),
    ).toMatchObject({
      width: 360,
      height: 280,
    });
  });

  it("builds lead edges, worker rollups, and preview kinds", () => {
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
    expect(
      agentCanvasPreviewKind({
        goalObjective: "Ship auth",
        title: "Lead",
        visibleItemCount: 0,
        latestRunStatus: null,
      }),
    ).toBe("goal");
    expect(
      agentCanvasPreviewKind({
        goalObjective: null,
        title: "Worker",
        visibleItemCount: 3,
        latestRunStatus: "completed",
      }),
    ).toBe("completed");
  });
});
