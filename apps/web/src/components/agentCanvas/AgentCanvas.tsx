import {
  scopedThreadKey,
  scopeProjectRef,
  scopeThreadRef,
} from "@t3tools/client-runtime/environment";
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
  type FinalConnectionState,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  type Viewport,
} from "@xyflow/react";
import { useNavigate } from "@tanstack/react-router";
import { useGT } from "gt-react";
import {
  AlertTriangleIcon,
  HandIcon,
  KeyboardIcon,
  MoreHorizontalIcon,
  MousePointer2Icon,
  Redo2Icon,
  SquarePenIcon,
  StickyNoteIcon,
  Undo2Icon,
  Volume2Icon,
  VolumeXIcon,
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
import { cn, newMessageId } from "../../lib/utils";
import { useVisibleThreadShells } from "../../state/entities";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { buildThreadRouteParams } from "../../threadRoutes";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/menu";
import { SidebarInset } from "../ui/sidebar";
import { toastManager } from "../ui/toast";
import { stackedThreadToast } from "../ui/toastHelpers";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  attentionQueue,
  playAttentionChime,
  readAttentionSoundEnabled,
  readViewedAttentionKeys,
  writeAttentionSoundEnabled,
  writeViewedAttentionKeys,
} from "./agentCanvasAttention";
import {
  AGENT_CANVAS_DEFAULT_FIT_MIN_ZOOM,
  AGENT_CANVAS_INTERACTIVE_ZOOM,
  AGENT_CANVAS_NARROW_VIEWPORT,
  agentCanvasLod,
  agentFlowId,
  computeFitViewport,
  computeNarrowLeadFit,
  createNoteId,
  narrowLeadFlowWidth,
  defaultNotePlacement,
  defaultWorkerLayoutForLead,
  findFreeAgentSlot,
  isInCanvasScene,
  isNodeOnScreen,
  isSceneClearOfChrome,
  leadSourceHandleForIndex,
  newCanvasEdgeId,
  noteFlowId,
  parseAgentFlowId,
  parseNoteFlowId,
  preferredFitLayouts,
  resolveAgentNodeLayout,
  resolveNonOverlappingAgentLayouts,
  readShotDemo,
  resolveEdgeKind,
  threadNeedsAttention,
  workerKeysForLead,
} from "./agentCanvas.logic";
import { COLLAPSED_SIDEBAR_TITLEBAR_INSET_CLASS } from "../../workspaceTitlebar";
import { AgentCanvasLeadEdge } from "./AgentCanvasLeadEdge";
import { AgentCanvasNode, type AgentCanvasAgentFlowNode } from "./AgentCanvasNode";
import { AgentCanvasNoteNode, type AgentCanvasNoteFlowNode } from "./AgentCanvasNoteNode";
import { chipSizeForLayout } from "./design-system/ChipNode";

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
  readonly omitMarker?: boolean;
}): Edge {
  const { edge, animated } = input;
  const sourceHandle = input.sourceHandle ?? edge.sourceHandle;
  const chipLod = Boolean(input.omitMarker);
  // React Flow edge markers styled in agentCanvas.css (not Tailwind utilities).
  const className = `${edge.kind === "lead" ? "lead" : "link"}${animated ? " is-active" : ""}${chipLod ? " chip-lod" : ""}`;
  const fanIndex = input.fanIndex;
  const next: Edge = {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.kind === "lead" ? "agentLead" : "default",
    className,
    animated,
    // Keep chip-LOD connectors above the layout-sized node hit boxes.
    ...(chipLod ? { zIndex: 1000 } : {}),
    // Arrowheads at chip LOD read as floating stubs on short gaps — omit them.
    ...(chipLod
      ? {}
      : {
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: animated
              ? "color-mix(in oklab, var(--color-primary) 88%, transparent)"
              : "color-mix(in oklab, var(--color-muted-foreground) 70%, transparent)",
          },
        }),
    data: {
      kind: edge.kind,
      chipLod,
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
  const { setViewport, screenToFlowPosition } = useReactFlow();

  const view = useAgentCanvasStore((state) => state.view);
  // Gesture zoom overrides the persisted view while the user is mid-pan/zoom.
  const [gestureZoom, setGestureZoom] = useState<number | null>(null);
  const liveZoom = gestureZoom ?? view.zoom;
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
  const [attentionSound, setAttentionSound] = useState(readAttentionSoundEnabled);
  const [viewedAttention, setViewedAttention] = useState(readViewedAttentionKeys);
  const [showLegend, setShowLegend] = useState(false);
  const prevAttentionRef = useRef<string[]>([]);
  const connectingFromRef = useRef<string | null>(null);
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
  const framedScene = useRef(false);
  const [storeHydrated, setStoreHydrated] = useState(() =>
    useAgentCanvasStore.persist.hasHydrated(),
  );

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- measures the canvas with ResizeObserver
  useEffect(() => {
    if (surface === null) return;
    return observeResize(surface, ([entry]) => {
      if (!entry) return;
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      setViewportSize((prev) => {
        // Crossing the phone breakpoint must re-frame so the lead isn't left clipped.
        const wasNarrow = (prev?.width ?? next.width) < AGENT_CANVAS_NARROW_VIEWPORT;
        const isNarrow = next.width < AGENT_CANVAS_NARROW_VIEWPORT;
        if (wasNarrow !== isNarrow) framedScene.current = false;
        return next;
      });
    });
  }, [surface]);

  // Shot / Playwright helper: apply a viewport without fighting autofit.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- listens for screenshot-script CustomEvents on the surface
  useEffect(() => {
    if (surface === null) return;
    const onSetView = (event: Event) => {
      const detail = (event as CustomEvent<{ x: number; y: number; zoom: number }>).detail;
      if (!detail || typeof detail.zoom !== "number") return;
      framedScene.current = true;
      setGestureZoom(null);
      void setViewport(detail, { duration: 0 }).then(() => {
        setView(detail);
      });
    };
    surface.addEventListener("t3-agent-canvas-set-view", onSetView);
    return () => surface.removeEventListener("t3-agent-canvas-set-view", onSetView);
  }, [setView, setViewport, surface]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- wait for zustand persist before framing
  useEffect(() => {
    if (storeHydrated) return;
    return useAgentCanvasStore.persist.onFinishHydration(() => {
      setStoreHydrated(true);
    });
  }, [storeHydrated]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- hydrate React Flow from persisted viewport once
  useEffect(() => {
    if (!storeHydrated || hydratedViewport.current) return;
    hydratedViewport.current = true;
    void setViewport({ x: view.x, y: view.y, zoom: view.zoom }, { duration: 0 });
  }, [setViewport, storeHydrated, view.x, view.y, view.zoom]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- place new/overlapping agents once; read store inside so drags don't re-fire
  useEffect(() => {
    if (!storeHydrated || threads.length === 0) return;
    const threadKeys = threads.map((thread) =>
      scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
    );
    const saved = useAgentCanvasStore.getState().agents;
    const noteRects = Object.values(useAgentCanvasStore.getState().notes).map((note) => ({
      x: note.x,
      y: note.y,
      width: note.width,
      height: note.height,
    }));
    const resolved = resolveNonOverlappingAgentLayouts({
      threadKeys,
      saved,
      notes: noteRects,
    });
    let changed = false;
    for (const key of threadKeys) {
      const next = resolved[key];
      const prev = saved[key];
      if (next === undefined) continue;
      if (
        prev &&
        prev.x === next.x &&
        prev.y === next.y &&
        prev.width === next.width &&
        prev.height === next.height &&
        prev.role === next.role
      ) {
        continue;
      }
      changed = true;
      setAgentLayout(key, next);
    }
    if (changed) framedScene.current = false;
    // Thread id fingerprint only — dragging must not re-layout.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- id fingerprint, not agents/layouts
  }, [setAgentLayout, storeHydrated, threads.map((thread) => thread.id).join("|")]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- frame once after persist so cards clear toolbar/minimap chrome
  useEffect(() => {
    if (!storeHydrated || framedScene.current || viewportSize === null || threads.length === 0) {
      return;
    }
    const sceneLayouts = threads
      .map((thread, index) => {
        const threadKey = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
        const layout = resolveAgentNodeLayout(index, agents[threadKey]);
        return {
          threadKey,
          layout,
          fit: {
            x: layout.x,
            y: layout.y,
            width: layout.width,
            height: layout.height,
            role: layout.role,
            threadKey,
          },
        };
      })
      .filter((entry) => isInCanvasScene(entry.layout));
    if (sceneLayouts.length === 0) return;
    framedScene.current = true;
    const narrow = viewportSize.width < AGENT_CANVAS_NARROW_VIEWPORT;
    const focusLayouts = preferredFitLayouts(
      sceneLayouts.map((entry) => entry.fit),
      edges,
      narrow ? 0 : 3,
    );
    const leadLayout = focusLayouts[0] ?? sceneLayouts[0]?.fit;
    if (narrow && leadLayout) {
      const fit = computeNarrowLeadFit(leadLayout, viewportSize);
      const cleared = { x: fit.x, y: fit.y, zoom: fit.zoom };
      void setViewport(cleared, { duration: 0 }).then(() => {
        setView(cleared);
      });
      return;
    }
    if (
      view.zoom >= AGENT_CANVAS_DEFAULT_FIT_MIN_ZOOM &&
      isSceneClearOfChrome(
        focusLayouts.length > 0 ? focusLayouts : sceneLayouts.map((entry) => entry.layout),
        view,
        viewportSize,
      )
    ) {
      return;
    }
    const cleared = computeFitViewport(
      focusLayouts.length > 0 ? focusLayouts : sceneLayouts.map((entry) => entry.layout),
      viewportSize,
      // Prefer readable interactive zoom; let distant workers sit off-screen.
      { minZoom: AGENT_CANVAS_DEFAULT_FIT_MIN_ZOOM, maxZoom: 1 },
    );
    void setViewport(cleared, { duration: 0 }).then(() => {
      setView(cleared);
    });
  }, [agents, edges, setView, setViewport, storeHydrated, threads, view, viewportSize]);

  const threadKeyOf = (thread: (typeof threads)[number]) =>
    scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));

  const sceneThreads = threads.filter((thread) => {
    const key = threadKeyOf(thread);
    const layout = agents[key] ?? resolveAgentNodeLayout(0, undefined);
    return isInCanvasScene(layout);
  });
  const attentionKeys = (() => {
    // Only on-canvas agents — never the whole project's parked history.
    const base = attentionQueue(sceneThreads, threadKeyOf, viewedAttention);
    const extras: string[] = [];
    for (const thread of sceneThreads) {
      const key = threadKeyOf(thread);
      if (viewedAttention.has(key) || base.includes(key)) continue;
      const tone = readShotDemo(key)?.tone;
      if (tone === "attention" || tone === "failed") extras.push(key);
    }
    return [...base, ...extras];
  })();

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- optional attention chime when the queue grows
  useEffect(() => {
    const prev = prevAttentionRef.current;
    prevAttentionRef.current = attentionKeys;
    if (!attentionSound) return;
    if (attentionKeys.some((key) => !prev.includes(key))) playAttentionChime();
  }, [attentionKeys, attentionSound]);

  const markAttentionViewed = (threadKey: string) => {
    setViewedAttention((current) => {
      if (current.has(threadKey)) return current;
      const next = new Set(current);
      next.add(threadKey);
      writeViewedAttentionKeys(next);
      return next;
    });
  };

  const focusAttention = (threadKey: string) => {
    const thread = threads.find((candidate) => threadKeyOf(candidate) === threadKey);
    if (thread === undefined) return;
    markAttentionViewed(threadKey);
    const layout = agents[threadKey] ?? resolveAgentNodeLayout(0, undefined);
    if (viewportSize) {
      const cleared = computeFitViewport([layout], viewportSize, {
        minZoom: AGENT_CANVAS_INTERACTIVE_ZOOM,
        maxZoom: 1.1,
      });
      void setViewport(cleared, { duration: 220 }).then(() => setView(cleared));
    }
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(thread.environmentId, thread.id)),
    });
    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(
          `[data-agent-canvas-session="${threadKey}"] [data-testid="composer-editor"]`,
        )
        ?.focus();
    }, 280);
  };

  const focusNextAttention = () => {
    if (attentionKeys.length === 0) return;
    const currentIndex = focusedKey ? attentionKeys.indexOf(focusedKey) : -1;
    const nextKey = attentionKeys[(currentIndex + 1) % attentionKeys.length];
    if (nextKey) focusAttention(nextKey);
  };

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- canvas keyboard shortcuts (? / Esc / .)
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
      if (event.key === "." && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        focusNextAttention();
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
      if (event.key === "Escape") {
        setShowShortcuts(false);
        setShowLegend(false);
        // Esc from inside a thread node returns focus to the canvas (not exit canvas mode).
        if (
          target instanceof HTMLElement &&
          target.closest("[data-agent-canvas-session]") !== null
        ) {
          event.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur?.();
          document
            .querySelector<HTMLElement>("[data-agent-canvas-surface]")
            ?.focus({ preventScroll: true });
        }
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const focusThread = (environmentId: EnvironmentId, threadId: ThreadId) => {
    const key = scopedThreadKey(scopeThreadRef(environmentId, threadId));
    const shell = threads.find((candidate) => threadKeyOf(candidate) === key);
    if (shell && threadNeedsAttention(shell)) markAttentionViewed(key);
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

  const narrowViewport = viewportSize !== null && viewportSize.width < AGENT_CANVAS_NARROW_VIEWPORT;
  const narrowLeadCap =
    narrowViewport && viewportSize !== null ? narrowLeadFlowWidth(viewportSize.width) : null;

  const flowNodes: CanvasFlowNode[] = [
    ...threads.map((thread, index) => {
      const threadKey = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
      const layout = resolveAgentNodeLayout(index, agents[threadKey]);
      const focused = focusedKey === threadKey;
      const liveView = { ...view, zoom: liveZoom };
      const onScreen =
        viewportSize === null ? true : isNodeOnScreen(layout, liveView, viewportSize);
      const lod = agentCanvasLod({ focused, onScreen, zoom: liveZoom });
      const workerCount = workerKeysForLead(threadKey, edges).length;
      // Chip LOD: size the RF node to the chip footprint so Left/Right handles
      // sit on the visible chrome (layout-sized nodes left edges floating above chips).
      const chip = lod === "chip" ? chipSizeForLayout(liveZoom, layout) : null;
      const leadNarrowW =
        narrowLeadCap !== null && (layout.role === "lead" || layout.role === "coordinator")
          ? Math.min(layout.width, narrowLeadCap)
          : null;
      const width = chip ? chip.flowWidth : (leadNarrowW ?? layout.width);
      const height = chip ? chip.flowHeight : lod === "preview" ? undefined : layout.height;
      return {
        id: agentFlowId(threadKey),
        type: "agent" as const,
        position: { x: layout.x, y: layout.y },
        width,
        ...(height !== undefined ? { height } : {}),
        hidden: !isInCanvasScene(layout),
        ...(lod === "interactive" ? { dragHandle: ".drag-handle" as const } : {}),
        style: height !== undefined ? { width, height } : { width },
        data: {
          threadKey,
          thread,
          role: layout.role,
          lod,
          zoom: liveZoom,
          ...(chip
            ? {
                chipScreenWidth: chip.screenWidth,
                chipScreenHeight: chip.screenHeight,
              }
            : {}),
          focused,
          workerCount,
          needsAttention: attentionKeys.includes(threadKey),
          onFocus: () => focusThread(thread.environmentId, thread.id),
          onSendToWorkers: (message: string) => sendToWorkers(threadKey, message),
          onDuplicateWithModel: () => {
            void duplicateWithModel(threadKey);
          },
        },
      } satisfies AgentCanvasAgentFlowNode;
    }),
    ...Object.values(notes).map((note) => {
      const liveView = { ...view, zoom: liveZoom };
      const noteLod = agentCanvasLod({
        focused: false,
        onScreen: viewportSize === null ? true : isNodeOnScreen(note, liveView, viewportSize),
        zoom: liveZoom,
      });
      const chip =
        noteLod === "chip"
          ? chipSizeForLayout(liveZoom, {
              width: Math.max(note.width, 200 / Math.max(liveZoom, 0.15)),
              height: Math.max(note.height, 36 / Math.max(liveZoom, 0.15)),
            })
          : null;
      const width = note.width;
      const height = note.height;
      return {
        id: noteFlowId(note.id),
        type: "note" as const,
        position: { x: note.x, y: note.y },
        width,
        height,
        hidden: !isInCanvasScene(note),
        style: { width, height },
        data: {
          noteId: note.id,
          text: note.text,
          lod: noteLod,
          zoom: liveZoom,
          ...(chip
            ? {
                chipScreenWidth: chip.screenWidth,
                chipScreenHeight: chip.screenHeight,
              }
            : {}),
        },
      } satisfies AgentCanvasNoteFlowNode;
    }),
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
        // Chip LOD: single mid-edge outlets so paths stay lead→right / worker→left.
        sourceHandle = liveZoom < 0.4 ? "out" : leadSourceHandleForIndex(index, ordered.length);
      }
    }
    const omitMarker = liveZoom < 0.4;
    // Lead edges: fan sourceHandles + fanIndex so AgentCanvasLeadEdge can spread origins.
    if (edge.kind === "lead") {
      return fanIndex === undefined
        ? toFlowEdge({
            edge,
            animated: Boolean(edgeActive),
            omitMarker,
            ...(sourceHandle !== undefined ? { sourceHandle } : {}),
          })
        : toFlowEdge({
            edge,
            animated: Boolean(edgeActive),
            fanIndex,
            omitMarker,
            ...(sourceHandle !== undefined ? { sourceHandle } : {}),
          });
    }
    return sourceHandle === undefined
      ? toFlowEdge({ edge, animated: Boolean(edgeActive), omitMarker })
      : toFlowEdge({ edge, animated: Boolean(edgeActive), sourceHandle, omitMarker });
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
        // Chip/preview LOD and narrow lead clamp temporarily size the RF node —
        // never persist those ephemeral dimensions into the layout store.
        const lod = node.data?.lod;
        const preserveSize =
          lod === "chip" ||
          lod === "preview" ||
          ((previous.role === "lead" || previous.role === "coordinator") && narrowViewport);
        const nextLayout = preserveSize
          ? { ...layout, width: previous.width, height: previous.height }
          : layout;
        if (
          previous.x === nextLayout.x &&
          previous.y === nextLayout.y &&
          previous.width === nextLayout.width &&
          previous.height === nextLayout.height &&
          previous.role === nextLayout.role
        ) {
          continue;
        }
        beginHistoryGesture();
        setAgentLayout(agentKey, nextLayout);
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
    const fanTotal = existingLeadTargets + 1;
    const sourceHandle =
      kind === "lead"
        ? (connection.sourceHandle ?? leadSourceHandleForIndex(existingLeadTargets, fanTotal))
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
      // Keep workers in a clean stack/grid so new connections never stack on each other.
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
        const workerCount = existingWorkers.length;
        for (const [workerIndex, workerKey] of existingWorkers.entries()) {
          const placed = defaultWorkerLayoutForLead(leadLayout, workerIndex, workerCount);
          setAgentLayout(workerKey, {
            ...(agents[workerKey] ?? {
              ...placed,
              role: "worker" as const,
            }),
            ...placed,
            role: "worker",
          });
        }
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

  const onMove = (_event: unknown, viewport: Viewport) => {
    setGestureZoom(viewport.zoom);
  };

  const onMoveEnd = (_event: unknown, viewport: Viewport) => {
    setGestureZoom(null);
    setView({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
  };

  const createOnCanvas = async () => {
    if (defaultProjectRef === null) return;
    const created = await handleNewThread(defaultProjectRef);
    if (created === null) return;
    const key = scopedThreadKey(scopeThreadRef(defaultProjectRef.environmentId, created.threadId));
    const occupied = [
      ...Object.values(useAgentCanvasStore.getState().agents).filter((layout) =>
        isInCanvasScene(layout),
      ),
      ...Object.values(useAgentCanvasStore.getState().notes),
    ];
    const slot = findFreeAgentSlot(occupied);
    pushHistory();
    setAgentLayout(key, { ...slot, role: "none" });
  };

  const spawnWorkerFromLead = async (
    leadKey: string,
    dropPosition: { readonly x: number; readonly y: number },
  ) => {
    const lead = threads.find((thread) => threadKeyOf(thread) === leadKey);
    if (lead === undefined) return;
    const projectRef = scopeProjectRef(lead.environmentId, lead.projectId);
    const prompt = [
      `Continue from lead “${lead.title}”.`,
      lead.goal?.objective?.trim() || null,
      "Own a focused slice and report back when ready.",
    ]
      .filter(Boolean)
      .join(" ");
    const created = await handleNewThread(projectRef, {
      prompt,
      ...(lead.branch !== null ? { branch: lead.branch } : {}),
      ...(lead.worktreePath !== null ? { worktreePath: lead.worktreePath } : {}),
    });
    if (created === null) return;
    const workerKey = scopedThreadKey(scopeThreadRef(lead.environmentId, created.threadId));
    const leadLayout = agents[leadKey] ?? resolveAgentNodeLayout(0, undefined);
    const occupied = [
      ...Object.values(useAgentCanvasStore.getState().agents),
      ...Object.values(useAgentCanvasStore.getState().notes),
    ];
    const preferred = {
      x: dropPosition.x - 180,
      y: dropPosition.y - 150,
      width: 360,
      height: 300,
    };
    const slot = occupied.some(
      (rect) =>
        !(
          preferred.x + preferred.width + 16 <= rect.x ||
          rect.x + rect.width + 16 <= preferred.x ||
          preferred.y + preferred.height + 16 <= rect.y ||
          rect.y + rect.height + 16 <= preferred.y
        ),
    )
      ? findFreeAgentSlot(occupied, { width: 360, height: 300 })
      : preferred;
    pushHistory();
    setAgentLayout(workerKey, { ...slot, role: "worker" });
    if ((agents[leadKey]?.role ?? "none") === "none") setAgentRole(leadKey, "lead");
    const workers = workerKeysForLead(leadKey, [
      ...edges,
      {
        id: "pending",
        source: agentFlowId(leadKey),
        target: agentFlowId(workerKey),
        kind: "lead",
      },
    ]);
    addStoreEdge({
      id: newCanvasEdgeId(agentFlowId(leadKey), agentFlowId(workerKey)),
      source: agentFlowId(leadKey),
      target: agentFlowId(workerKey),
      kind: "lead",
      sourceHandle: leadSourceHandleForIndex(workers.length - 1, workers.length),
      targetHandle: "in",
    });
    // Keep existing workers tidy beside the lead after spawn.
    for (const [workerIndex, key] of workers.entries()) {
      const placed = defaultWorkerLayoutForLead(leadLayout, workerIndex, workers.length);
      if (key === workerKey) {
        setAgentLayout(key, { ...slot, role: "worker" });
      } else {
        setAgentLayout(key, {
          ...(agents[key] ?? { ...placed, role: "worker" as const }),
          ...placed,
          role: "worker",
        });
      }
    }
    focusThread(lead.environmentId, created.threadId);
    toastManager.add(
      stackedThreadToast({
        type: "success",
        title: gt("Spawned worker from lead"),
      }),
    );
  };

  const duplicateWithModel = async (sourceKey: string) => {
    const source = threads.find((thread) => threadKeyOf(thread) === sourceKey);
    if (source === undefined) return;
    const projectRef = scopeProjectRef(source.environmentId, source.projectId);
    // Demo-safe: always Replay/showcase — never call a paid provider from canvas duplicate.
    const prompt =
      source.goal?.objective?.trim() ||
      `Same task as “${source.title}”: re-run with another model.`;
    const created = await handleNewThread(projectRef, {
      prompt,
      ...(source.branch !== null ? { branch: source.branch } : {}),
      ...(source.worktreePath !== null ? { worktreePath: source.worktreePath } : {}),
    });
    if (created === null) return;
    const siblingKey = scopedThreadKey(scopeThreadRef(source.environmentId, created.threadId));
    const sourceLayout = agents[sourceKey] ?? resolveAgentNodeLayout(0, undefined);
    const side = {
      x: sourceLayout.x + sourceLayout.width + 40,
      y: sourceLayout.y,
      width: sourceLayout.width,
      height: sourceLayout.height,
      role: "none" as const,
    };
    pushHistory();
    setAgentLayout(siblingKey, side);
    focusThread(source.environmentId, created.threadId);
    toastManager.add(
      stackedThreadToast({
        type: "success",
        title: gt("Duplicated beside the original (Replay demo model)"),
      }),
    );
  };

  const onConnectStart = (_event: unknown, params: { nodeId: string | null }) => {
    connectingFromRef.current = params.nodeId;
  };

  const onConnectEnd = (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
    const fromId = connectingFromRef.current;
    connectingFromRef.current = null;
    if (connectionState.isValid) return;
    if (fromId === null) return;
    const leadKey = parseAgentFlowId(fromId);
    if (leadKey === null) return;
    const leadRole = agents[leadKey]?.role ?? "none";
    if (leadRole !== "lead" && leadRole !== "coordinator") return;
    const point =
      "clientX" in event
        ? { x: event.clientX, y: event.clientY }
        : event.changedTouches[0]
          ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
          : null;
    if (point === null) return;
    const flow = screenToFlowPosition(point);
    void spawnWorkerFromLead(leadKey, flow);
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

  const zoomPercent = Math.round(liveZoom * 100);
  const panMode = tool === "pan";
  const sceneNodes = flowNodes.filter((node) => isInCanvasScene(node.position));
  const sceneAgentCount = sceneNodes.filter((node) => node.type === "agent").length;

  return (
    <div
      data-agent-canvas
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background"
    >
      <div
        className={cn(
          "flex h-[var(--workspace-topbar-height)] min-h-[var(--workspace-topbar-height)] shrink-0 items-center gap-2 border-b border-border/70 pr-(--workspace-gutter-end) pl-(--workspace-gutter-start) sm:gap-3",
          COLLAPSED_SIDEBAR_TITLEBAR_INSET_CLASS,
        )}
      >
        <h1 className="min-w-0 truncate text-sm font-medium tracking-tight">
          {gt("Agent canvas")}
        </h1>
        <span className="hidden text-2xs text-muted-foreground sm:inline">
          {gt("{count, plural, one {# agent} other {# agents}}", { count: sceneAgentCount })}
        </span>
        {attentionKeys.length > 0 ? (
          <Button
            size="xs"
            variant="secondary"
            data-agent-canvas-attention-count
            className="min-w-0 shrink"
            onClick={focusNextAttention}
          >
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <AlertTriangleIcon className="size-3.5 shrink-0 text-warning" />
              <span className="truncate">
                {gt("{count, plural, one {# needs you} other {# need you}}", {
                  count: attentionKeys.length,
                })}
              </span>
            </span>
          </Button>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="icon-xs" variant="ghost-muted" aria-label={gt("Canvas options")} />
              }
            >
              <MoreHorizontalIcon className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{gt("Attention")}</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    const next = !attentionSound;
                    setAttentionSound(next);
                    writeAttentionSoundEnabled(next);
                  }}
                >
                  {attentionSound ? (
                    <Volume2Icon className="size-3.5" />
                  ) : (
                    <VolumeXIcon className="size-3.5" />
                  )}
                  {attentionSound ? gt("Attention sound on") : gt("Attention sound off")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={focusNextAttention}
                  disabled={attentionKeys.length === 0}
                >
                  <AlertTriangleIcon className="size-3.5" />
                  {gt("Next needing attention (.)")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>{gt("Status legend")}</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setShowLegend((open) => !open)}>
                  {gt("Show status legend")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <div className="px-2 py-1.5 text-3xs leading-relaxed text-muted-foreground">
                <p>
                  <span className="mr-1 inline-block size-1.5 rounded-full bg-success" />
                  {gt("Running")}
                </p>
                <p>
                  <span className="mr-1 inline-block size-1.5 rounded-full bg-warning" />
                  {gt("Waiting on you")}
                </p>
                <p>
                  <span className="mr-1 inline-block size-1.5 rounded-full bg-destructive" />
                  {gt("Failed")}
                </p>
                <p>
                  <span className="mr-1 inline-block size-1.5 rounded-full bg-muted-foreground/45" />
                  {gt("Done / idle")}
                </p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="xs" variant="ghost" onClick={() => setMode("normal")}>
            <XIcon className="size-3.5" />
            {gt("Exit")}
          </Button>
        </div>
      </div>

      <div
        ref={setSurface}
        className="relative min-h-0 flex-1 outline-none"
        tabIndex={-1}
        data-agent-canvas-surface
      >
        <ReactFlow
          className="agent-canvas-flow"
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
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
          onMove={onMove}
          onMoveEnd={onMoveEnd}
          minZoom={0.28}
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
          // Keep edges mounted when LOD swaps node size — culling dropped chip paths.
          onlyRenderVisibleElements={false}
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

          {sceneNodes.length >= 3 && (viewportSize?.width ?? 0) >= AGENT_CANVAS_NARROW_VIEWPORT ? (
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
                  const agentLayouts = sceneThreads.map((thread, index) => {
                    const threadKey = threadKeyOf(thread);
                    const layout = agents[threadKey] ?? resolveAgentNodeLayout(index, undefined);
                    return {
                      x: layout.x,
                      y: layout.y,
                      width: layout.width,
                      height: layout.height,
                      role: layout.role,
                      threadKey,
                    };
                  });
                  // Prefer live surface size — ResizeObserver state can lag a resize by a frame.
                  const size =
                    surface && surface.clientWidth > 0
                      ? { width: surface.clientWidth, height: surface.clientHeight }
                      : (viewportSize ?? { width: 1200, height: 800 });
                  const narrow = size.width < AGENT_CANVAS_NARROW_VIEWPORT;
                  const focusLayouts = preferredFitLayouts(agentLayouts, edges, narrow ? 0 : 3);
                  const leadLayout = focusLayouts[0] ?? agentLayouts[0];
                  const fit =
                    narrow && leadLayout
                      ? computeNarrowLeadFit(leadLayout, size)
                      : computeFitViewport(
                          focusLayouts.length > 0 ? focusLayouts : agentLayouts,
                          size,
                          {
                            minZoom: AGENT_CANVAS_DEFAULT_FIT_MIN_ZOOM,
                            maxZoom: 1,
                          },
                        );
                  const cleared = { x: fit.x, y: fit.y, zoom: fit.zoom };
                  void setViewport(cleared, { duration: 220 }).then(() => {
                    setView(cleared);
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
                  <li>{gt("Drag a lead handle onto empty canvas to spawn a worker")}</li>
                  <li>{gt(". jumps to the next agent that needs you")}</li>
                  <li>{gt("Leads can broadcast a prompt to connected workers")}</li>
                  <li>{gt("Press ? to toggle this panel")}</li>
                </ul>
              </div>
            </Panel>
          ) : null}

          {showLegend ? (
            <Panel position="top-right" className="mt-3! mr-3!">
              <div
                className="rounded-xl border border-border bg-popover/95 p-3 text-2xs shadow-composer backdrop-blur-md"
                data-agent-canvas-status-legend
              >
                <p className="mb-1.5 text-xs font-medium text-foreground">
                  {gt("Status at a glance")}
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-success" />
                    {gt("Running: elapsed shows when the thread provides a start time")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-warning" />
                    {gt("Waiting on you: approval or input")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-destructive" />
                    {gt("Failed: open the card for the real error")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-muted-foreground/45" />
                    {gt("Done / idle")}
                  </li>
                  <li className="pt-1 text-3xs">
                    {gt("Cost and tokens appear only when the thread data includes them.")}
                  </li>
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
 * connections, selection, minimap, and fit-to-view. On-screen agents at normal zoom each mount a
 * live ChatView; far-out zoom falls back to preview/chip for performance.
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
