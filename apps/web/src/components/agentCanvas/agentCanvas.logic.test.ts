import { describe, expect, it } from "vite-plus/test";

import {
  AGENT_CANVAS_DEFAULT_FIT_MIN_ZOOM,
  AGENT_CANVAS_INTERACTIVE_ZOOM,
  agentCanvasLod,
  agentCanvasPreviewKind,
  agentFlowId,
  clampAgentNodeLayout,
  computeFitViewport,
  computeNarrowLeadFit,
  defaultAgentNodeLayout,
  defaultWorkerLayoutForLead,
  isNodeFullyFramed,
  isNodeOnScreen,
  isSceneClearOfChrome,
  leadHandleTopPercent,
  leadSourceHandleForIndex,
  newCanvasEdgeId,
  noteFlowId,
  parseAgentFlowId,
  parseNoteFlowId,
  preferredFitLayouts,
  resolveAgentNodeLayout,
  resolveEdgeKind,
  resolveNonOverlappingAgentLayouts,
  rectsOverlap,
  isInCanvasScene,
  threadNeedsAttention,
  workerKeysForLead,
} from "./agentCanvas.logic";
import { chipSizeForLayout } from "./design-system/ChipNode";

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

  it("stacks one or two workers beside a lead", () => {
    const lead = { x: 40, y: 80, width: 400, height: 360 };
    const first = defaultWorkerLayoutForLead(lead, 0, 2);
    const second = defaultWorkerLayoutForLead(lead, 1, 2);
    expect(first.x).toBe(lead.x + lead.width + 240);
    expect(second.x).toBe(first.x);
    expect(second.y).toBeGreaterThan(first.y + first.height);
  });

  it("lays out three-plus workers in a two-column grid", () => {
    const lead = { x: 40, y: 80, width: 400, height: 360 };
    const a = defaultWorkerLayoutForLead(lead, 0, 3);
    const b = defaultWorkerLayoutForLead(lead, 1, 3);
    const c = defaultWorkerLayoutForLead(lead, 2, 3);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBe(a.y);
    expect(c.x).toBe(a.x);
    expect(c.y).toBeGreaterThan(a.y + a.height);
  });

  it("flags approval, input, finished, and failed threads for attention", () => {
    expect(
      threadNeedsAttention({
        hasPendingApprovals: true,
        hasPendingUserInput: false,
        latestRun: null,
      }),
    ).toBe(true);
    expect(
      threadNeedsAttention({
        hasPendingApprovals: false,
        hasPendingUserInput: true,
        latestRun: null,
      }),
    ).toBe(true);
    expect(
      threadNeedsAttention({
        hasPendingApprovals: false,
        hasPendingUserInput: false,
        latestRun: { status: "completed" },
      }),
    ).toBe(true);
    expect(
      threadNeedsAttention({
        hasPendingApprovals: false,
        hasPendingUserInput: false,
        latestRun: { status: "failed" },
      }),
    ).toBe(true);
    expect(
      threadNeedsAttention({
        hasPendingApprovals: false,
        hasPendingUserInput: false,
        latestRun: { status: "running" },
      }),
    ).toBe(false);
  });

  it("places overlapping unknown agents into free slots", () => {
    const lead = { x: 32, y: 120, width: 380, height: 320, role: "lead" as const };
    const orphan = { x: 40, y: 130, width: 380, height: 320, role: "none" as const };
    const next = resolveNonOverlappingAgentLayouts({
      threadKeys: ["lead", "orphan", "w1"],
      saved: {
        lead,
        orphan,
        w1: { x: 500, y: 120, width: 360, height: 300, role: "worker" },
      },
      notes: [{ x: 32, y: 16, width: 196, height: 88 }],
    });
    expect(rectsOverlap(next.lead!, next.orphan!)).toBe(false);
    expect(rectsOverlap(next.lead!, next.w1!)).toBe(false);
    expect(rectsOverlap(next.orphan!, { x: 32, y: 16, width: 196, height: 88 })).toBe(false);
  });

  it("parks threads with no saved layout off-scene", () => {
    const next = resolveNonOverlappingAgentLayouts({
      threadKeys: ["fresh"],
      saved: {},
    });
    expect(isInCanvasScene(next.fresh!)).toBe(false);
  });

  it("fits the scene clear of toolbar and minimap chrome", () => {
    const layouts = [
      { x: 0, y: 0, width: 380, height: 300 },
      { x: 460, y: 0, width: 360, height: 300 },
      { x: 860, y: 0, width: 360, height: 300 },
    ];
    const viewport = { width: 1512, height: 982 };
    const view = computeFitViewport(layouts, viewport);
    expect(isSceneClearOfChrome(layouts, view, viewport)).toBe(true);
    expect(view.zoom).toBeGreaterThanOrEqual(AGENT_CANVAS_INTERACTIVE_ZOOM);
  });

  it("prefers lead + workers for readable default fit", () => {
    expect(AGENT_CANVAS_DEFAULT_FIT_MIN_ZOOM).toBe(0.85);
    const layouts = [
      {
        x: 0,
        y: 0,
        width: 640,
        height: 680,
        role: "lead" as const,
        threadKey: "lead",
      },
      {
        x: 800,
        y: 0,
        width: 360,
        height: 300,
        role: "worker" as const,
        threadKey: "w1",
      },
      {
        x: 800,
        y: 340,
        width: 360,
        height: 300,
        role: "worker" as const,
        threadKey: "w2",
      },
      {
        x: 2000,
        y: 0,
        width: 360,
        height: 300,
        role: "worker" as const,
        threadKey: "far",
      },
    ];
    const edges = [
      {
        id: "e1",
        source: agentFlowId("lead"),
        target: agentFlowId("w1"),
        kind: "lead" as const,
      },
      {
        id: "e2",
        source: agentFlowId("lead"),
        target: agentFlowId("w2"),
        kind: "lead" as const,
      },
    ];
    const preferred = preferredFitLayouts(layouts, edges);
    expect(preferred.map((entry) => entry.threadKey)).toEqual(["lead", "w1", "w2"]);
    const viewport = { width: 1512, height: 982 };
    const view = computeFitViewport(preferred, viewport, {
      minZoom: AGENT_CANVAS_DEFAULT_FIT_MIN_ZOOM,
      maxZoom: 1,
    });
    expect(view.zoom).toBeGreaterThanOrEqual(AGENT_CANVAS_DEFAULT_FIT_MIN_ZOOM);
    expect(isSceneClearOfChrome(preferred, view, viewport)).toBe(true);
  });

  it("clamps chip size to the layout footprint so chips cannot overlap", () => {
    const tight = chipSizeForLayout(0.28, { width: 480, height: 260 });
    expect(tight.flowWidth).toBeLessThanOrEqual(480);
    expect(tight.flowHeight).toBeLessThanOrEqual(260);
    expect(tight.screenWidth).toBeLessThanOrEqual(200);
    // Wide layouts still leave connector room (≤72% of footprint) before the 200px cap.
    const wide = chipSizeForLayout(0.28, { width: 900, height: 700 });
    expect(wide.screenWidth).toBeCloseTo(Math.min(200, 900 * 0.28 * 0.72), 5);
    expect(wide.flowWidth).toBeCloseTo(wide.screenWidth / 0.28, 5);
    expect(wide.flowWidth).toBeLessThanOrEqual(900);
  });

  it("frames the lead card fully on a narrow phone viewport", () => {
    const lead = { x: 80, y: 96, width: 640, height: 680 };
    const viewport = { width: 430, height: 900 };
    const view = computeNarrowLeadFit(lead, viewport);
    const left = lead.x * view.zoom + view.x;
    const right = (lead.x + lead.width) * view.zoom + view.x;
    expect(left).toBeGreaterThanOrEqual(12 - 0.5);
    expect(right).toBeLessThanOrEqual(viewport.width - 12 + 0.5);
    expect(right - left).toBeLessThanOrEqual(viewport.width - 24 + 0.5);
    expect(view.zoom).toBeLessThan(0.85);
  });

  it("spreads lead handles evenly for fan edges", () => {
    expect(leadSourceHandleForIndex(0, 1)).toBe("out-2");
    expect(leadSourceHandleForIndex(0, 3)).toBe("out-0");
    expect(leadSourceHandleForIndex(1, 3)).toBe("out-2");
    expect(leadSourceHandleForIndex(2, 3)).toBe("out-4");
    expect(leadHandleTopPercent(0)).toBe(`${(1 / 7) * 100}%`);
  });

  it("picks lod from visibility and zoom (all on-screen agents interactive at normal zoom)", () => {
    expect(AGENT_CANVAS_INTERACTIVE_ZOOM).toBe(0.55);
    expect(agentCanvasLod({ focused: true, onScreen: true, zoom: 1 })).toBe("interactive");
    expect(agentCanvasLod({ focused: false, onScreen: true, zoom: 1 })).toBe("interactive");
    expect(agentCanvasLod({ focused: false, onScreen: true, zoom: 0.45 })).toBe("preview");
    expect(agentCanvasLod({ focused: true, onScreen: true, zoom: 0.3 })).toBe("chip");
    expect(agentCanvasLod({ focused: false, onScreen: true, zoom: 0.38 })).toBe("chip");
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
