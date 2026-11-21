import { afterEach, describe, expect, it } from "vite-plus/test";

import { AGENT_CANVAS_STORAGE_KEY, useAgentCanvasStore } from "./agentCanvasStore";

describe("agentCanvasStore", () => {
  afterEach(() => {
    useAgentCanvasStore.setState({
      mode: "normal",
      view: { x: 48, y: 48, scale: 1 },
      nodes: {},
    });
  });

  it("toggles mode and remembers node layouts", () => {
    expect(AGENT_CANVAS_STORAGE_KEY).toBe("t3code:agent-canvas:v1");
    useAgentCanvasStore.getState().toggleMode();
    expect(useAgentCanvasStore.getState().mode).toBe("canvas");
    useAgentCanvasStore.getState().setNodeLayout("env:thread", {
      x: 40,
      y: 80,
      width: 480,
      height: 600,
    });
    expect(useAgentCanvasStore.getState().nodes["env:thread"]).toEqual({
      x: 40,
      y: 80,
      width: 480,
      height: 600,
    });
    useAgentCanvasStore.getState().resetLayouts();
    expect(useAgentCanvasStore.getState().nodes).toEqual({});
    expect(useAgentCanvasStore.getState().mode).toBe("canvas");
  });
});
