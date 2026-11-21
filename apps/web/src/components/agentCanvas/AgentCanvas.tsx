import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useGT } from "gt-react";
import { LayoutGridIcon, MaximizeIcon, MinusIcon, PlusIcon, SquarePenIcon } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  DEFAULT_AGENT_CANVAS_VIEW,
  useAgentCanvasStore,
  type AgentCanvasNodeLayout,
} from "../../agentCanvasStore";
import { useHandleNewThread } from "../../hooks/useHandleNewThread";
import { useThreadRouteTarget } from "../../hooks/useThreadRouteTarget";
import { observeResize } from "../../lib/observeResize";
import { useVisibleThreadShells } from "../../state/entities";
import { buildThreadRouteParams } from "../../threadRoutes";
import { Button } from "../ui/button";
import { SidebarInset } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  agentCanvasLod,
  clampAgentNodeLayout,
  isNodeOnScreen,
  nodeScreenRect,
  panAgentCanvasView,
  resolveAgentNodeLayout,
  zoomAgentCanvasView,
} from "./agentCanvas.logic";
import { AgentCanvasNode } from "./AgentCanvasNode";

type DragKind = "pan" | "move" | "resize";

/**
 * Infinite canvas of agent threads for the main app. Pan/zoom the surface; drag and resize
 * nodes. Only the focused on-screen node mounts a live ChatView; others stay lightweight.
 */
export function AgentCanvas() {
  const gt = useGT();
  const navigate = useNavigate();
  const threads = useVisibleThreadShells();
  const routeTarget = useThreadRouteTarget();
  const focusedKey = routeTarget?.kind === "server" ? scopedThreadKey(routeTarget.threadRef) : null;
  const view = useAgentCanvasStore((state) => state.view);
  const nodes = useAgentCanvasStore((state) => state.nodes);
  const setView = useAgentCanvasStore((state) => state.setView);
  const setNodeLayout = useAgentCanvasStore((state) => state.setNodeLayout);
  const resetLayouts = useAgentCanvasStore((state) => state.resetLayouts);
  const setMode = useAgentCanvasStore((state) => state.setMode);
  const { handleNewThread, defaultProjectRef } = useHandleNewThread();

  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const drag = useRef<{
    readonly kind: DragKind;
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    readonly originView: typeof view;
    readonly threadKey?: string;
    readonly originLayout?: AgentCanvasNodeLayout;
  } | null>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- measures the canvas with ResizeObserver
  useEffect(() => {
    if (surface === null) return;
    return observeResize(surface, ([entry]) => {
      if (!entry) return;
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
  }, [surface]);

  const focusThread = (environmentId: EnvironmentId, threadId: ThreadId) => {
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(environmentId, threadId)),
    });
  };

  const onWheel = useEffectEvent((event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setView(
      zoomAgentCanvasView(view, Math.exp(-event.deltaY * 0.01), {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      }),
    );
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- non-passive wheel listener for pinch zoom
  useEffect(() => {
    if (surface === null) return;
    surface.addEventListener("wheel", onWheel, { passive: false });
    return () => surface.removeEventListener("wheel", onWheel);
  }, [surface]);

  const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || drag.current !== null) return;
    if ((event.target as Element).closest("[data-agent-canvas-node]")) return;
    drag.current = {
      kind: "pan",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originView: view,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const beginMove = (threadKey: string, layout: AgentCanvasNodeLayout) => {
    return (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || drag.current !== null) return;
      event.stopPropagation();
      drag.current = {
        kind: "move",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originView: view,
        threadKey,
        originLayout: layout,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    };
  };

  const beginResize = (threadKey: string, layout: AgentCanvasNodeLayout) => {
    return (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || drag.current !== null) return;
      event.stopPropagation();
      drag.current = {
        kind: "resize",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originView: view,
        threadKey,
        originLayout: layout,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (current.kind === "pan") {
      setView(panAgentCanvasView(current.originView, dx, dy));
      return;
    }
    if (current.threadKey === undefined || current.originLayout === undefined) return;
    if (current.kind === "move") {
      setNodeLayout(
        current.threadKey,
        clampAgentNodeLayout({
          ...current.originLayout,
          x: current.originLayout.x + dx / view.scale,
          y: current.originLayout.y + dy / view.scale,
        }),
      );
      return;
    }
    setNodeLayout(
      current.threadKey,
      clampAgentNodeLayout({
        ...current.originLayout,
        width: current.originLayout.width + dx / view.scale,
        height: current.originLayout.height + dy / view.scale,
      }),
    );
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
  };

  const zoom = (factor: number) => {
    if (viewport === null) return;
    setView(
      zoomAgentCanvasView(view, factor, {
        x: viewport.width / 2,
        y: viewport.height / 2,
      }),
    );
  };

  const createOnCanvas = async () => {
    if (defaultProjectRef === null) return;
    await handleNewThread(defaultProjectRef);
  };

  const lastBroughtIntoView = useRef<string | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- pan once when the focused agent changes
  useEffect(() => {
    if (focusedKey === null || viewport === null) return;
    if (lastBroughtIntoView.current === focusedKey) return;
    const index = threads.findIndex(
      (thread) => scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)) === focusedKey,
    );
    if (index < 0) return;
    lastBroughtIntoView.current = focusedKey;
    const layout = resolveAgentNodeLayout(index, nodes[focusedKey]);
    if (isNodeOnScreen(layout, view, viewport, 24)) return;
    const rect = nodeScreenRect(layout, view);
    setView(
      panAgentCanvasView(
        view,
        viewport.width / 2 - (rect.left + rect.right) / 2,
        viewport.height / 2 - (rect.top + rect.bottom) / 2,
      ),
    );
  }, [focusedKey, nodes, setView, threads, view, viewport]);

  return (
    <SidebarInset className="h-svh min-h-0 overflow-hidden overscroll-y-none md:h-dvh">
      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
          <LayoutGridIcon aria-hidden className="size-4 text-muted-foreground" />
          <h1 className="text-sm font-medium">{gt("Agent canvas")}</h1>
          <span className="text-2xs text-muted-foreground">
            {gt("{count, plural, one {# agent} other {# agents}}", { count: threads.length })}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button size="xs" variant="outline" onClick={() => void createOnCanvas()}>
                    <SquarePenIcon />
                    {gt("New agent")}
                  </Button>
                }
              />
              <TooltipPopup>{gt("Create a new thread and open it on the canvas")}</TooltipPopup>
            </Tooltip>
            <Button size="xs" variant="ghost-muted" onClick={resetLayouts}>
              {gt("Reset layout")}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setMode("normal")}>
              {gt("Exit canvas")}
            </Button>
          </div>
        </div>

        <div
          ref={setSurface}
          className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
          style={{
            backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1.5px)",
            backgroundSize: `${22 * view.scale}px ${22 * view.scale}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
          onPointerDown={beginPan}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          >
            {threads.map((thread, index) => {
              const threadKey = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
              const layout = resolveAgentNodeLayout(index, nodes[threadKey]);
              const onScreen = viewport === null ? true : isNodeOnScreen(layout, view, viewport);
              const focused = focusedKey === threadKey;
              const lod = agentCanvasLod({ focused, onScreen, scale: view.scale });
              return (
                <AgentCanvasNode
                  key={threadKey}
                  thread={thread}
                  layout={layout}
                  lod={lod}
                  focused={focused}
                  onFocus={() => focusThread(thread.environmentId, thread.id)}
                  onMoveStart={beginMove(threadKey, layout)}
                  onResizeStart={beginResize(threadKey, layout)}
                />
              );
            })}
          </div>

          {threads.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
                <p className="text-sm text-muted-foreground">
                  {gt("No agents yet. Create one to place it on the canvas.")}
                </p>
                <Button size="sm" onClick={() => void createOnCanvas()}>
                  <SquarePenIcon />
                  {gt("New agent")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-lg border border-border bg-popover/95 p-0.5 shadow-xs">
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={gt("Zoom out")}
            onClick={() => zoom(0.8)}
          >
            <MinusIcon />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={gt("Zoom in")}
            onClick={() => zoom(1.25)}
          >
            <PlusIcon />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={gt("Reset view")}
            onClick={() => setView(DEFAULT_AGENT_CANVAS_VIEW)}
          >
            <MaximizeIcon />
          </Button>
        </div>
      </div>
    </SidebarInset>
  );
}
