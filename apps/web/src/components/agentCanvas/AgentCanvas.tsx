import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
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
  HandIcon,
  KeyboardIcon,
  MousePointer2Icon,
  Redo2Icon,
  SquarePenIcon,
  StickyNoteIcon,
  Undo2Icon,
  WaypointsIcon,
  XIcon,
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
  defaultWorkerLayoutForLead,
  isInCanvasScene,
  isNodeOnScreen,
  leadSourceHandleForIndex,
  newCanvasEdgeId,
  noteFlowId,
  parseAgentFlowId,
  parseNoteFlowId,
  resolveAgentNodeLayout,
  readShotDemo,
  resolveEdgeKind,
  workerKeysForLead,
} from "./agentCanvas.logic";
import { AgentCanvasLeadEdge } from "./AgentCanvasLeadEdge";
import { AgentCanvasNode, type AgentCanvasAgentFlowNode } from "./AgentCanvasNode";
import { AgentCanvasNoteNode, type AgentCanvasNoteFlowNode } from "./AgentCanvasNoteNode";

type CanvasFlowNode = AgentCanvasAgentFlowNode | AgentCanvasNoteFlowNode;

const nodeTypes = {
  agent: AgentCanvasNode,
  note: AgentCanvasNoteNode,
};

const edgeTypes = {
  agentLead: AgentCanvasLeadEdge,
};

function toFlowEdge(input: {
  readonly edge: AgentCanvasEdge;
  readonly animated: boolean;
  readonly sourceHandle?: string;
  readonly fanIndex?: number;
}): Edge {
  const { edge, animated } = input;
  const sourceHandle = input.sourceHandle ?? edge.sourceHandle;
  // React Flow edge markers styled in agentCanvas.css (not Tailwind utilities).
  const className = `${edge.kind === "lead" ? "lead" : "link"}${animated ? " is-active" : ""}`;
  const fanIndex = input.fanIndex;
  const next: Edge = {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.kind === "lead" ? "agentLead" : "default",
    className,
    animated,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
      color: animated
        ? "color-mix(in oklab, var(--color-primary) 88%, transparent)"
        : "color-mix(in oklab, var(--color-muted-foreground) 70%, transparent)",
    },
    data: {
      kind: edge.kind,
      ...(fanIndex !== undefined ? { fanIndex } : {}),
    },
  };
  if (sourceHandle !== undefined) next.sourceHandle = sourceHandle;
  next.targetHandle = edge.targetHandle ?? "in";
  return next;
}

type CanvasTool = "select" | "pan";

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
  const [tool, setTool] = useState<CanvasTool>("select");
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
      if (event.key === "v" || event.key === "V") {
        setTool("select");
        return;
      }
      if (event.key === "h" || event.key === "H") {
        setTool("pan");
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
      // Shot demo forces preview chrome even when lod is interactive — size those to content too.
      const shotPreview = readShotDemo(threadKey) !== null;
      const sizedToContent = lod !== "interactive" || shotPreview;
      return {
        id: agentFlowId(threadKey),
        type: "agent" as const,
        position: { x: layout.x, y: layout.y },
        width: layout.width,
        ...(sizedToContent ? {} : { height: layout.height }),
        hidden: !isInCanvasScene(layout),
        dragHandle: ".drag-handle",
        style: sizedToContent
          ? { width: layout.width }
          : { width: layout.width, height: layout.height },
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
          width: note.width,
          height: note.height,
          hidden: !isInCanvasScene(note),
          style: { width: note.width, height: note.height },
          data: { noteId: note.id, text: note.text },
        }) satisfies AgentCanvasNoteFlowNode,
    ),
  ];

  const leadFanOrder = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.kind !== "lead") continue;
    const targets = leadFanOrder.get(edge.source) ?? [];
    targets.push(edge.target);
    leadFanOrder.set(edge.source, targets);
  }
  for (const [source, targets] of leadFanOrder) {
    targets.sort((a, b) => {
      const aAgent = parseAgentFlowId(a);
      const bAgent = parseAgentFlowId(b);
      const aY = aAgent !== null ? (agents[aAgent]?.y ?? 0) : 0;
      const bY = bAgent !== null ? (agents[bAgent]?.y ?? 0) : 0;
      return aY - bY;
    });
    leadFanOrder.set(source, targets);
  }

  const flowEdges: Edge[] = edges.map((edge) => {
    const targetAgent = parseAgentFlowId(edge.target);
    const targetThread =
      targetAgent === null
        ? undefined
        : threads.find(
            (candidate) =>
              scopedThreadKey(scopeThreadRef(candidate.environmentId, candidate.id)) ===
              targetAgent,
          );
    const targetShotTone = targetAgent === null ? null : readShotDemo(targetAgent)?.tone;
    // Animate only the edge into an actively running worker — keep the rest solid + muted.
    const edgeActive =
      edge.kind === "lead" &&
      (targetShotTone === "running" ||
        targetThread?.runtime?.status === "running" ||
        targetThread?.latestRun?.status === "running");
    let sourceHandle = edge.sourceHandle;
    let fanIndex: number | undefined;
    if (edge.kind === "lead") {
      const ordered = leadFanOrder.get(edge.source) ?? [];
      const index = ordered.indexOf(edge.target);
      if (index >= 0) {
        fanIndex = index;
        sourceHandle = leadSourceHandleForIndex(index);
      }
    }
    // Lead edges: fan sourceHandles + fanIndex so AgentCanvasLeadEdge can spread origins.
    if (edge.kind === "lead") {
      return fanIndex === undefined
        ? toFlowEdge({
            edge,
            animated: Boolean(edgeActive),
            ...(sourceHandle !== undefined ? { sourceHandle } : {}),
          })
        : toFlowEdge({
            edge,
            animated: Boolean(edgeActive),
            fanIndex,
            ...(sourceHandle !== undefined ? { sourceHandle } : {}),
          });
    }
    return sourceHandle === undefined
      ? toFlowEdge({ edge, animated: Boolean(edgeActive) })
      : toFlowEdge({ edge, animated: Boolean(edgeActive), sourceHandle });
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
    const existingLeadTargets =
      kind === "lead"
        ? edges.filter((edge) => edge.kind === "lead" && edge.source === connection.source).length
        : 0;
    const sourceHandle =
      kind === "lead"
        ? (connection.sourceHandle ?? leadSourceHandleForIndex(existingLeadTargets))
        : (connection.sourceHandle ?? "out");
    pushHistory();
    addStoreEdge({
      id: newCanvasEdgeId(connection.source, connection.target),
      source: connection.source,
      target: connection.target,
      kind,
      sourceHandle,
      targetHandle: connection.targetHandle ?? "in",
    });
    if (kind === "lead" && sourceAgent !== null) {
      const targetAgent = parseAgentFlowId(connection.target);
      if ((agents[sourceAgent]?.role ?? "none") === "none") setAgentRole(sourceAgent, "lead");
      if (targetAgent !== null && (agents[targetAgent]?.role ?? "none") === "none") {
        setAgentRole(targetAgent, "worker");
      }
      // Keep workers in a clean column so new connections never stack on top of each other.
      if (targetAgent !== null) {
        const leadLayout = agents[sourceAgent] ?? resolveAgentNodeLayout(0, undefined);
        const existingWorkers = workerKeysForLead(sourceAgent, [
          ...edges,
          {
            id: "pending",
            source: connection.source,
            target: connection.target,
            kind: "lead",
          },
        ]);
        const workerIndex = Math.max(0, existingWorkers.indexOf(targetAgent));
        const placed = defaultWorkerLayoutForLead(leadLayout, workerIndex);
        setAgentLayout(targetAgent, {
          ...(agents[targetAgent] ?? {
            ...placed,
            role: "worker" as const,
          }),
          ...placed,
          role: "worker",
        });
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

  const zoomPercent = Math.round(view.zoom * 100);
  const panMode = tool === "pan";
  const sceneNodes = flowNodes.filter((node) => isInCanvasScene(node.position));

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border/70 px-3">
        <h1 className="text-sm font-medium tracking-tight">{gt("Agent canvas")}</h1>
        <span className="text-2xs text-muted-foreground">
          {gt("{count, plural, one {# agent} other {# agents}}", { count: threads.length })}
        </span>
        <div className="ml-auto">
          <Button size="xs" variant="ghost" onClick={() => setMode("normal")}>
            <XIcon className="size-3.5" />
            {gt("Exit")}
          </Button>
        </div>
      </div>

      <div ref={setSurface} className="relative min-h-0 flex-1">
        <ReactFlow
          className="agent-canvas-flow"
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
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
          snapGrid={[8, 8]}
          connectionMode={ConnectionMode.Loose}
          selectionMode={SelectionMode.Partial}
          selectionOnDrag={!panMode}
          panOnDrag={panMode ? true : [1, 2]}
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
            gap={24}
            size={1}
            color="color-mix(in oklab, var(--color-border) 70%, transparent)"
          />

          {sceneNodes.length >= 3 ? (
            <MiniMap
              pannable
              zoomable={false}
              nodeStrokeWidth={1.25}
              nodeColor={(node) => {
                if (node.type === "note") {
                  return "color-mix(in oklab, var(--color-warning) 45%, var(--color-muted))";
                }
                const role = (node.data as { role?: string } | undefined)?.role;
                if (role === "lead" || role === "coordinator") {
                  return "color-mix(in oklab, var(--color-primary) 55%, var(--color-muted))";
                }
                return "var(--color-muted-foreground)";
              }}
              maskColor="color-mix(in oklab, var(--color-foreground) 12%, transparent)"
              maskStrokeColor="color-mix(in oklab, var(--color-foreground) 45%, transparent)"
              maskStrokeWidth={1.5}
              offsetScale={10}
              style={{ width: 140, height: 90 }}
              className="!right-3 !bottom-16 !left-auto !m-0"
            />
          ) : null}

          {/* Above the minimap so the % control never overlaps its bottom edge. */}
          <Panel position="bottom-right" className="agent-canvas-zoom-panel">
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-popover/95 p-0.5 shadow-composer backdrop-blur-md">
              <Button
                size="xs"
                variant="ghost-muted"
                aria-label={gt("Fit view · {percent}%", { percent: zoomPercent })}
                onClick={() => {
                  void fitView({
                    padding: 0.08,
                    duration: 220,
                    nodes: sceneNodes,
                    minZoom: 0.9,
                    maxZoom: 1,
                  }).then(() => {
                    const next = getViewport();
                    // Small upward nudge so the floating toolbar stays clear of the cluster.
                    const cleared = { x: next.x, y: next.y + 14, zoom: next.zoom };
                    void setViewport(cleared, { duration: 0 }).then(() => {
                      setView(cleared);
                    });
                  });
                }}
              >
                <span className="min-w-10 text-center tabular-nums">{zoomPercent}%</span>
              </Button>
            </div>
          </Panel>

          <Panel position="bottom-center" className="mb-5!">
            <div className="flex items-center gap-0.5 rounded-full border border-border bg-popover/95 p-1 shadow-composer backdrop-blur-md">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon-xs"
                      variant={tool === "select" ? "secondary" : "ghost"}
                      aria-label={gt("Select")}
                      aria-pressed={tool === "select"}
                      onClick={() => setTool("select")}
                    />
                  }
                >
                  <MousePointer2Icon />
                </TooltipTrigger>
                <TooltipPopup>{gt("Select")}</TooltipPopup>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon-xs"
                      variant={tool === "pan" ? "secondary" : "ghost"}
                      aria-label={gt("Pan")}
                      aria-pressed={tool === "pan"}
                      onClick={() => setTool("pan")}
                    />
                  }
                >
                  <HandIcon />
                </TooltipTrigger>
                <TooltipPopup>{gt("Pan")}</TooltipPopup>
              </Tooltip>
              <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={gt("New agent")}
                      onClick={() => void createOnCanvas()}
                    />
                  }
                >
                  <SquarePenIcon />
                </TooltipTrigger>
                <TooltipPopup>{gt("New agent")}</TooltipPopup>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={gt("Add note")}
                      onClick={addNote}
                    />
                  }
                >
                  <StickyNoteIcon />
                </TooltipTrigger>
                <TooltipPopup>{gt("Add note")}</TooltipPopup>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={gt("Connect agents")}
                      disabled
                    />
                  }
                >
                  <WaypointsIcon />
                </TooltipTrigger>
                <TooltipPopup>{gt("Drag a handle to connect")}</TooltipPopup>
              </Tooltip>
              <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
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
              <Button
                size="icon-xs"
                variant={showShortcuts ? "secondary" : "ghost"}
                aria-label={gt("Keyboard shortcuts")}
                aria-expanded={showShortcuts}
                onClick={() => setShowShortcuts((open) => !open)}
              >
                <KeyboardIcon />
              </Button>
            </div>
          </Panel>

          {showShortcuts ? (
            <Panel position="bottom-center" className="mb-16!">
              <div className="max-w-sm rounded-xl border border-border bg-popover/95 p-3 text-2xs leading-relaxed text-muted-foreground shadow-composer backdrop-blur-md">
                <p className="mb-1.5 text-xs font-medium text-foreground">{gt("Shortcuts")}</p>
                <ul className="space-y-1">
                  <li>{gt("V selects · H pans · scroll zooms to the cursor")}</li>
                  <li>{gt("Nodes snap to an 8px grid while dragging")}</li>
                  <li>{gt("Shift-click or Shift-drag to multi-select")}</li>
                  <li>{gt("Delete / Backspace removes the selection")}</li>
                  <li>{gt("Drag a handle to connect agents or notes")}</li>
                  <li>{gt("Leads can broadcast a prompt to connected workers")}</li>
                  <li>{gt("Press ? to toggle this panel")}</li>
                </ul>
              </div>
            </Panel>
          ) : null}

          {threads.length === 0 ? (
            <Panel position="top-center" className="pointer-events-none mt-16!">
              <div className="pointer-events-auto flex w-full max-w-sm flex-col gap-3 rounded-xl border border-border bg-card/96 p-5 shadow-composer backdrop-blur-md">
                <div className="space-y-1">
                  <p className="text-sm font-medium tracking-tight text-foreground">
                    {gt("Arrange your agents on an infinite canvas")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {gt(
                      "Add agents, connect a lead to workers, drop sticky notes, then drag and resize freely.",
                    )}
                  </p>
                </div>
                <ol className="space-y-1.5 text-xs text-muted-foreground">
                  <li>1. {gt("Create agents with New agent. Each lands as a resizable panel.")}</li>
                  <li>2. {gt("Drag a port from a lead to workers to wire up broadcast.")}</li>
                  <li>3. {gt("Drop sticky notes for plans, then pan and zoom as you work.")}</li>
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
