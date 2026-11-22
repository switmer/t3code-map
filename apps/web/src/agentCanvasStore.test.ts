import { afterEach, describe, expect, it } from "vite-plus/test";

import { AGENT_CANVAS_STORAGE_KEY, useAgentCanvasStore } from "./agentCanvasStore";

describe("agentCanvasStore", () => {
  afterEach(() => {
    useAgentCanvasStore.setState({
      mode: "normal",
      view: { x: 32, y: 24, zoom: 0.7 },
      agents: {},
      notes: {},
      edges: [],
      past: [],
      future: [],
    });
  });

  it("toggles mode and remembers agent layouts, edges, and notes", () => {
    expect(AGENT_CANVAS_STORAGE_KEY).toBe("t3code:agent-canvas:v2");
    useAgentCanvasStore.getState().toggleMode();
    expect(useAgentCanvasStore.getState().mode).toBe("canvas");

    useAgentCanvasStore.getState().setAgentLayout("env:thread", {
      x: 40,
      y: 80,
      width: 380,
      height: 340,
      role: "lead",
    });
    useAgentCanvasStore.getState().addEdge({
      id: "e1",
      source: "agent:env:thread",
      target: "agent:env:worker",
      kind: "lead",
    });
    useAgentCanvasStore.getState().upsertNote({
      id: "n1",
      x: 10,
      y: 20,
      width: 240,
      height: 160,
      text: "Ship it",
    });

    expect(useAgentCanvasStore.getState().agents["env:thread"]?.role).toBe("lead");
    expect(useAgentCanvasStore.getState().edges).toHaveLength(1);
    expect(useAgentCanvasStore.getState().notes.n1?.text).toBe("Ship it");

    useAgentCanvasStore.getState().pushHistory();
    useAgentCanvasStore.getState().setAgentRole("env:thread", "coordinator");
    useAgentCanvasStore.getState().undo();
    expect(useAgentCanvasStore.getState().agents["env:thread"]?.role).toBe("lead");

    useAgentCanvasStore.getState().resetLayouts();
    expect(useAgentCanvasStore.getState().agents).toEqual({});
    expect(useAgentCanvasStore.getState().edges).toEqual([]);
    expect(useAgentCanvasStore.getState().notes).toEqual({});
    expect(useAgentCanvasStore.getState().mode).toBe("canvas");
  });
});
