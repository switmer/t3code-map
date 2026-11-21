import { afterEach, describe, expect, it } from "vite-plus/test";

import { useEnvironmentsCanvasStore } from "./environmentsCanvasStore";

describe("environmentsCanvasStore", () => {
  afterEach(() => {
    useEnvironmentsCanvasStore.setState({
      preferredView: null,
      positions: {},
      view: null,
    });
  });

  it("remembers the preferred environments view and card placements", () => {
    useEnvironmentsCanvasStore.getState().setPreferredView("canvas");
    useEnvironmentsCanvasStore.getState().moveNode("env:a", { x: 120, y: 40 });
    useEnvironmentsCanvasStore.getState().setView({ x: 10, y: 20, scale: 1.25 });

    expect(useEnvironmentsCanvasStore.getState()).toMatchObject({
      preferredView: "canvas",
      positions: { "env:a": { x: 120, y: 40 } },
      view: { x: 10, y: 20, scale: 1.25 },
    });

    useEnvironmentsCanvasStore.getState().resetPositions();
    expect(useEnvironmentsCanvasStore.getState().positions).toEqual({});
    expect(useEnvironmentsCanvasStore.getState().view).toBeNull();
    expect(useEnvironmentsCanvasStore.getState().preferredView).toBe("canvas");
  });
});
