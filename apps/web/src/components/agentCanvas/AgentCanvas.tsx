import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  type Viewport,
} from "@xyflow/react";
import { useNavigate } from "@tanstack/react-router";
import { useGT } from "gt-react";
import {
  KeyboardIcon,
  LayoutGridIcon,
  Redo2Icon,
  SquarePenIcon,
  StickyNoteIcon,
  Undo2Icon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import "./agentCanvas.css";

import {
  DEFAULT_AGENT_NODE_SIZE,
  useAgentCanvasStore,
  type AgentCanvasEdge,
  type AgentCanvasNodeLayout,
} from "../../agentCanvasStore";
import { useHandleNewThread } from "../../hooks/useHandleNewThread";
import { useThreadRouteTarget } from "../../hooks/useThreadRouteTarget";
import { observeResize } from "../../lib/observeResize";
import { newMessageId } from "../../lib/utils";
import { useVisibleThreadShells } from "../../state/entities";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { buildThreadRouteParams } from "../../threadRoutes";
import { Button } from "../ui/button";
import { SidebarInset } from "../ui/sidebar";
import { toastManager } from "../ui/toast";
import { stackedThreadToast } from "../ui/toastHelpers";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  agentCanvasLod,
  agentFlowId,
  createNoteId,
  defaultNotePlacement,
  isNodeOnScreen,
  newCanvasEdgeId,
  noteFlowId,
  parseAgentFlowId,
  parseNoteFlowId,
  resolveAgentNodeLayout,
  resolveEdgeKind,
  workerKeysForLead,
} from "./agentCanvas.logic";
import { AgentCanvasNode, type AgentCanvasAgentFlowNode } from "./AgentCanvasNode";
import { AgentCanvasNoteNode, type AgentCanvasNoteFlowNode } from "./AgentCanvasNoteNode";

type CanvasFlowNode = AgentCanvasAgentFlowNode | AgentCanvasNoteFlowNode;

const nodeTypes = {
  agent: AgentCanvasNode,
  note: AgentCanvasNoteNode,
};

function toFlowEdge(input: { readonly edge: AgentCanvasEdge; readonly animated: boolean }): Edge {
  const { edge, animated } = input;
  const next: Edge = {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "default",
    className: edge.kind === "lead" ? "lead" : "link",
    animated,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: edge.kind === "lead" ? "var(--color-primary)" : "var(--color-muted-foreground)",
    },
    data: { kind: edge.kind },
  };
  if (edge.sourceHandle) next.sourceHandle = edge.sourceHandle;
  if (edge.targetHandle) next.targetHandle = edge.targetHandle;
  return next;
}

function toStoreLayout(
  node: Node,
  previous: AgentCanvasNodeLayout | undefined,
): AgentCanvasNodeLayout {
  const width =
    typeof node.width === "number"
      ? node.width
      : typeof node.style?.width === "number"
        ? node.style.width
        : (previous?.width ?? DEFAULT_AGENT_NODE_SIZE.width);
  const height =
    typeof node.height === "number"
      ? node.height
      : typeof node.style?.height === "number"
        ? node.style.height
        : (previous?.height ?? DEFAULT_AGENT_NODE_SIZE.height);
  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height,
    role: previous?.role ?? "none",
  };
}

function AgentCanvasFlow() {
  const gt = useGT();
  const navigate = useNavigate();
  const threads = useVisibleThreadShells();
  const routeTarget = useThreadRouteTarget();
  const focusedKey = routeTarget?.kind === "server" ? scopedThreadKey(routeTarget.threadRef) : null;
  const { fitView, setViewport, getViewport, screenToFlowPosition } = useReactFlow();

  const view = useAgentCanvasStore((state) => state.view);
  const agents = useAgentCanvasStore((state) => state.agents);
  const notes = useAgentCanvasStore((state) => state.notes);
  const edges = useAgentCanvasStore((state) => state.edges);
  const past = useAgentCanvasStore((state) => state.past);
  const future = useAgentCanvasStore((state) => state.future);
  const setView = useAgentCanvasStore((state) => state.setView);
  const setAgentLayout = useAgentCanvasStore((state) => state.setAgentLayout);
  const setAgentRole = useAgentCanvasStore((state) => state.setAgentRole);
  const upsertNote = useAgentCanvasStore((state) => state.upsertNote);
  const setEdges = useAgentCanvasStore((state) => state.setEdges);
  const addStoreEdge = useAgentCanvasStore((state) => state.addEdge);
  const removeSelection = useAgentCanvasStore((state) => state.removeSelection);
  const resetLayouts = useAgentCanvasStore((state) => state.resetLayouts);
  const setMode = useAgentCanvasStore((state) => state.setMode);
  const pushHistory = useAgentCanvasStore((state) => state.pushHistory);
  const undo = useAgentCanvasStore((state) => state.undo);
  const redo = useAgentCanvasStore((state) => state.redo);
  const { handleNewThread, defaultProjectRef } = useHandleNewThread();
  const startThreadTurn = useOrchestrationCommand(threadEnvironment.startTurn, {
    reportFailure: false,
  });

  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const historyGesture = useRef(false);
  const hydratedViewport = useRef(false);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- measures the canvas with ResizeObserver
  useEffect(() => {
    if (surface === null) return;
    return observeResize(surface, ([entry]) => {
      if (!entry) return;
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
  }, [surface]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- hydrate React Flow from persisted viewport once
  useEffect(() => {
    if (hydratedViewport.current) return;
    hydratedViewport.current = true;
    void setViewport({ x: view.x, y: view.y, zoom: view.zoom }, { duration: 0 });
  }, [setViewport, view.x, view.y, view.zoom]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- canvas keyboard shortcuts (? / Esc)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
        event.preventDefault();
        setShowShortcuts((open) => !open);
        return;
      }
      if (event.key === "Escape") setShowShortcuts(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const focusThread = (environmentId: EnvironmentId, threadId: ThreadId) => {
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(environmentId, threadId)),
    });
  };

  const sendToWorkers = async (leadKey: string, message: string) => {
    const workerKeys = workerKeysForLead(leadKey, useAgentCanvasStore.getState().edges);
    if (workerKeys.length === 0) return;
    const byKey = new Map(
      threads.map((thread) => [
        scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
        thread,
      ]),
    );
    let sent = 0;
    for (const workerKey of workerKeys) {
      const worker = byKey.get(workerKey);
      if (worker === undefined) continue;
      const result = await startThreadTurn({
        environmentId: worker.environmentId,
        input: {
          threadId: worker.id,
          message: {
            messageId: newMessageId(),
            role: "user",
            text: message,
            attachments: [],
          },
          runtimeMode: worker.runtimeMode,
          interactionMode: worker.interactionMode,
        },
      });
      if (result._tag === "Success") sent += 1;
    }
    toastManager.add(
      stackedThreadToast({
        type: sent > 0 ? "success" : "error",
        title:
          sent > 0
            ? gt("Sent to {count, plural, one {# worker} other {# workers}}", { count: sent })
            : gt("Could not send to workers"),
      }),
    );
  };

  const flowNodes: CanvasFlowNode[] = [
    ...threads.map((thread, index) => {
      const threadKey = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
      const layout = resolveAgentNodeLayout(index, agents[threadKey]);
      const focused = focusedKey === threadKey;
      const onScreen = viewportSize === null ? true : isNodeOnScreen(layout, view, viewportSize);
      const lod = agentCanvasLod({ focused, onScreen, zoom: view.zoom });
      const workerCount = workerKeysForLead(threadKey, edges).length;
      return {
        id: agentFlowId(threadKey),
        type: "agent" as const,
        position: { x: layout.x, y: layout.y },
        dragHandle: ".drag-handle",
        style: { width: layout.width, height: layout.height },
        data: {
          threadKey,
          thread,
          role: layout.role,
          lod,
          focused,
          workerCount,
          onFocus: () => focusThread(thread.environmentId, thread.id),
          onSendToWorkers: (message: string) => sendToWorkers(threadKey, message),
        },
      } satisfies AgentCanvasAgentFlowNode;
    }),
    ...Object.values(notes).map(
      (note) =>
        ({
          id: noteFlowId(note.id),
          type: "note" as const,
          position: { x: note.x, y: note.y },
          style: { width: note.width, height: note.height },
          data: { noteId: note.id, text: note.text },
        }) satisfies AgentCanvasNoteFlowNode,
    ),
  ];

  const flowEdges: Edge[] = edges.map((edge) => {
    const sourceAgent = parseAgentFlowId(edge.source);
    const sourceThread =
      sourceAgent === null
        ? undefined
        : threads.find(
            (candidate) =>
              scopedThreadKey(scopeThreadRef(candidate.environmentId, candidate.id)) ===
              sourceAgent,
          );
    const leadAnimated =
      edge.kind === "lead" &&
      (sourceThread?.runtime?.status === "running" ||
        sourceThread?.latestRun?.status === "running");
    return toFlowEdge({ edge, animated: Boolean(leadAnimated) });
  });

  const beginHistoryGesture = () => {
    if (historyGesture.current) return;
    pushHistory();
    historyGesture.current = true;
  };

  const endHistoryGesture = () => {
    historyGesture.current = false;
  };

  const onNodesChange: OnNodesChange<CanvasFlowNode> = (changes) => {
    const next = changes.applyTo(flowNodes);
    for (const node of next) {
      const agentKey = parseAgentFlowId(node.id);
      if (agentKey !== null) {
        const previous = agents[agentKey] ?? resolveAgentNodeLayout(0, undefined);
        const layout = toStoreLayout(node, previous);
        if (
          previous.x === layout.x &&
          previous.y === layout.y &&
          previous.width === layout.width &&
          previous.height === layout.height &&
          previous.role === layout.role
        ) {
          continue;
        }
        beginHistoryGesture();
        setAgentLayout(agentKey, layout);
        continue;
      }
      const noteId = parseNoteFlowId(node.id);
      if (noteId === null) continue;
      const previous = notes[noteId];
      if (previous === undefined) continue;
      const width =
        typeof node.width === "number"
          ? node.width
          : typeof node.style?.width === "number"
            ? node.style.width
            : previous.width;
      const height =
        typeof node.height === "number"
          ? node.height
          : typeof node.style?.height === "number"
            ? node.style.height
            : previous.height;
      if (
        previous.x === node.position.x &&
        previous.y === node.position.y &&
        previous.width === width &&
        previous.height === height
      ) {
        continue;
      }
      beginHistoryGesture();
      upsertNote({
        ...previous,
        x: node.position.x,
        y: node.position.y,
        width,
        height,
      });
    }
  };

  const onEdgesChange: OnEdgesChange = (changes) => {
    const next = changes.applyTo(flowEdges);
    const mapped: AgentCanvasEdge[] = next.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: (edge.data as { kind?: AgentCanvasEdge["kind"] } | undefined)?.kind ?? "link",
      ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
      ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}),
    }));
    if (JSON.stringify(mapped) === JSON.stringify(edges)) return;
    beginHistoryGesture();
    setEdges(mapped);
  };

  const onConnect = (connection: Connection) => {
    if (connection.source === null || connection.target === null) return;
    if (connection.source === connection.target) return;
    const sourceAgent = parseAgentFlowId(connection.source);
    const sourceRole = sourceAgent !== null ? (agents[sourceAgent]?.role ?? "none") : "none";
    const kind = resolveEdgeKind({ sourceRole });
    pushHistory();
    addStoreEdge({
      id: newCanvasEdgeId(connection.source, connection.target),
      source: connection.source,
      target: connection.target,
      kind,
      ...(connection.sourceHandle ? { sourceHandle: connection.sourceHandle } : {}),
      ...(connection.targetHandle ? { targetHandle: connection.targetHandle } : {}),
    });
    if (kind === "lead" && sourceAgent !== null) {
      const targetAgent = parseAgentFlowId(connection.target);
      if ((agents[sourceAgent]?.role ?? "none") === "none") setAgentRole(sourceAgent, "lead");
      if (targetAgent !== null && (agents[targetAgent]?.role ?? "none") === "none") {
        setAgentRole(targetAgent, "worker");
      }
    }
  };

  const onDelete = ({
    nodes: deletedNodes,
    edges: deletedEdges,
  }: {
    nodes: CanvasFlowNode[];
    edges: Edge[];
  }) => {
    pushHistory();
    removeSelection({
      agentKeys: deletedNodes
        .map((node) => parseAgentFlowId(node.id))
        .filter((key): key is string => key !== null),
      noteIds: deletedNodes
        .map((node) => parseNoteFlowId(node.id))
        .filter((id): id is string => id !== null),
      edgeIds: deletedEdges.map((edge) => edge.id),
    });
  };

  const onMoveEnd = (_event: unknown, viewport: Viewport) => {
    setView({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
  };

  const createOnCanvas = async () => {
    if (defaultProjectRef === null) return;
    await handleNewThread(defaultProjectRef);
  };

  const addNote = () => {
    pushHistory();
    const id = createNoteId();
    const placement = defaultNotePlacement(Object.keys(notes).length);
    const center = screenToFlowPosition({
      x: (viewportSize?.width ?? 800) / 2,
      y: (viewportSize?.height ?? 600) / 2,
    });
    upsertNote({
      id,
      x: center.x - placement.width / 2,
      y: center.y - placement.height / 2,
      width: placement.width,
      height: placement.height,
      text: "",
    });
  };

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border bg-card/40 px-3 backdrop-blur-sm">
        <div className="flex size-7 items-center justify-center rounded-lg border border-border/80 bg-muted/40">
          <LayoutGridIcon aria-hidden className="size-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold tracking-tight">{gt("Agent canvas")}</h1>
          <p className="text-2xs text-muted-foreground">
            {gt("{count, plural, one {# agent} other {# agents}}", { count: threads.length })}
            {" · "}
            {gt("Snap · connect · broadcast")}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
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
          <Button size="xs" variant="outline" onClick={addNote}>
            <StickyNoteIcon />
            {gt("Add note")}
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={gt("Undo")}
            disabled={past.length === 0}
            onClick={undo}
          >
            <Undo2Icon />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={gt("Redo")}
            disabled={future.length === 0}
            onClick={redo}
          >
            <Redo2Icon />
          </Button>
          <Button size="xs" variant="ghost-muted" onClick={resetLayouts}>
            {gt("Reset layout")}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setMode("normal")}>
            {gt("Exit canvas")}
          </Button>
        </div>
      </div>

      <div ref={setSurface} className="relative min-h-0 flex-1">
        <ReactFlow
          className="agent-canvas-flow"
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={() => {
            historyGesture.current = false;
            beginHistoryGesture();
          }}
          onNodeDragStop={endHistoryGesture}
          onSelectionDragStart={() => {
            historyGesture.current = false;
            beginHistoryGesture();
          }}
          onSelectionDragStop={endHistoryGesture}
          onDelete={onDelete}
          onMoveEnd={onMoveEnd}
          minZoom={0.2}
          maxZoom={2.5}
          snapToGrid
          snapGrid={[16, 16]}
          connectionMode={ConnectionMode.Loose}
          selectionMode={SelectionMode.Partial}
          selectionOnDrag
          panOnDrag={[1, 2]}
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick={false}
          deleteKeyCode={["Backspace", "Delete"]}
          multiSelectionKeyCode="Shift"
          fitView={false}
          proOptions={{ hideAttribution: true }}
          onPaneClick={endHistoryGesture}
        >
          <Background
            id="agent-canvas-dots"
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.1}
            color="color-mix(in oklab, var(--color-border) 85%, transparent)"
          />
          <MiniMap pannable zoomable nodeStrokeWidth={2} className="!bottom-3 !left-3 !m-0" />
          <Controls
            showInteractive={false}
            className="!right-3 !bottom-3 !left-auto !m-0"
            onFitView={() => {
              void fitView({ padding: 0.18, duration: 220 }).then(() => {
                const next = getViewport();
                setView({ x: next.x, y: next.y, zoom: next.zoom });
              });
            }}
          />
          <Panel position="top-left" className="m-3!">
            <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-popover/95 p-0.5 shadow-composer backdrop-blur-md">
              <Button
                size="icon-xs"
                variant={showShortcuts ? "secondary" : "ghost"}
                aria-label={gt("Keyboard shortcuts")}
                aria-expanded={showShortcuts}
                onClick={() => setShowShortcuts((open) => !open)}
              >
                <KeyboardIcon />
              </Button>
              <span className="pr-2 text-2xs text-muted-foreground">{gt("Press ?")}</span>
            </div>
            {showShortcuts ? (
              <div className="mt-2 max-w-xs rounded-xl border border-border bg-popover/95 p-3 text-2xs leading-relaxed text-muted-foreground shadow-composer backdrop-blur-md">
                <p className="mb-1.5 font-medium text-foreground">{gt("Shortcuts")}</p>
                <ul className="space-y-1">
                  <li>{gt("Drag empty space or middle-click to pan")}</li>
                  <li>{gt("Scroll or pinch to zoom toward the cursor")}</li>
                  <li>{gt("Shift-click or Shift-drag to multi-select")}</li>
                  <li>{gt("Delete / Backspace removes the selection")}</li>
                  <li>{gt("Drag a handle to connect agents or notes")}</li>
                  <li>{gt("Undo and redo from the toolbar")}</li>
                  <li>{gt("Press ? to toggle this panel")}</li>
                </ul>
              </div>
            ) : null}
          </Panel>

          {threads.length === 0 ? (
            <Panel position="top-center" className="pointer-events-none mt-14!">
              <div className="pointer-events-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-card/96 p-6 shadow-composer backdrop-blur-md">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
                    <LayoutGridIcon className="size-5 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {gt("Arrange your agents on an infinite canvas")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {gt(
                        "Add agents, connect a lead to workers, drop sticky notes, then drag and resize freely.",
                      )}
                    </p>
                  </div>
                </div>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold text-foreground">
                      1
                    </span>
                    {gt("Create agents with New agent. Each lands as a resizable panel.")}
                  </li>
                  <li className="flex gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold text-foreground">
                      2
                    </span>
                    {gt("Drag a port from a lead to workers to wire up broadcast.")}
                  </li>
                  <li className="flex gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold text-foreground">
                      3
                    </span>
                    {gt("Drop sticky notes for plans, then pan and zoom as you work.")}
                  </li>
                </ol>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => void createOnCanvas()}>
                    <SquarePenIcon />
                    {gt("New agent")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={addNote}>
                    <StickyNoteIcon />
                    {gt("Add note")}
                  </Button>
                </div>
              </div>
            </Panel>
          ) : null}
        </ReactFlow>
      </div>
    </div>
  );
}

/**
 * Infinite canvas of agent threads for the main app. Built on React Flow for solid move/resize,
 * connections, selection, minimap, and fit-to-view. Only the focused agent mounts a live ChatView.
 */
export function AgentCanvas() {
  return (
    <SidebarInset className="h-svh min-h-0 overflow-hidden overscroll-y-none md:h-dvh">
      <ReactFlowProvider initialMinZoom={0.2} initialMaxZoom={2.5}>
        <AgentCanvasFlow />
      </ReactFlowProvider>
    </SidebarInset>
  );
}
