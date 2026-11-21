import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  Handle,
  NodeResizer,
  Position,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useGT } from "gt-react";
import { CrownIcon, MoreHorizontalIcon, SendIcon, UsersIcon, WaypointsIcon } from "lucide-react";
import { memo, useEffect, useState } from "react";

import { useAgentCanvasStore, type AgentCanvasRole } from "../../agentCanvasStore";
import { useRelativeTimeState } from "../../hooks/useRelativeTimeState";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import type { AgentCanvasLod } from "./agentCanvas.logic";
import {
  agentCanvasPreviewKind,
  LEAD_SOURCE_HANDLES,
  readShotDemo,
  workerKeysForLead,
} from "./agentCanvas.logic";
import { AgentCanvasSession } from "./AgentCanvasSession";

export type AgentCanvasAgentFlowNode = Node<
  {
    readonly threadKey: string;
    readonly thread: EnvironmentThreadShell;
    readonly role: AgentCanvasRole;
    readonly lod: AgentCanvasLod;
    readonly focused: boolean;
    readonly workerCount: number;
    readonly onFocus: () => void;
    readonly onSendToWorkers: (message: string) => Promise<void>;
  },
  "agent"
>;

type StatusTone = "running" | "attention" | "failed" | "idle" | "ready";

function threadStatusTone(thread: EnvironmentThreadShell): StatusTone {
  if (thread.hasPendingApprovals || thread.hasPendingUserInput) return "attention";
  if (thread.runtime?.status === "running" || thread.latestRun?.status === "running") {
    return "running";
  }
  if (thread.latestRun?.status === "failed") return "failed";
  if (thread.latestRun?.status === "completed") return "idle";
  return "ready";
}

function threadStatusLabel(thread: EnvironmentThreadShell, gt: ReturnType<typeof useGT>): string {
  if (thread.hasPendingApprovals) return gt("Needs approval");
  if (thread.hasPendingUserInput) return gt("Waiting for input");
  if (thread.runtime?.status === "running" || thread.latestRun?.status === "running") {
    return gt("Working");
  }
  if (thread.latestRun?.status === "failed") return gt("Failed");
  if (thread.latestRun?.status === "completed") return gt("Done");
  return gt("Ready");
}

function StatusDot(props: { readonly tone: StatusTone }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative size-1.5 shrink-0 rounded-full",
        props.tone === "running" && "agent-canvas-status-pulse bg-success text-success",
        props.tone === "attention" && "bg-warning text-warning",
        props.tone === "failed" && "bg-destructive text-destructive",
        props.tone === "idle" && "bg-muted-foreground/45",
        props.tone === "ready" && "bg-muted-foreground/35",
      )}
    />
  );
}

function RolePill(props: { readonly role: AgentCanvasRole }) {
  const gt = useGT();
  if (props.role === "none") return null;
  const Icon =
    props.role === "lead" ? CrownIcon : props.role === "coordinator" ? WaypointsIcon : UsersIcon;
  const label =
    props.role === "lead"
      ? gt("Lead")
      : props.role === "coordinator"
        ? gt("Coordinator")
        : gt("Worker");
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-2xs font-medium tracking-tight",
        props.role === "lead" && "bg-primary/10 text-primary",
        props.role === "coordinator" && "bg-accent text-accent-foreground",
        props.role === "worker" && "bg-muted text-muted-foreground",
      )}
    >
      <Icon aria-hidden className="size-3 opacity-80" />
      {label}
    </span>
  );
}

function previewLines(input: {
  readonly thread: EnvironmentThreadShell;
  readonly gt: ReturnType<typeof useGT>;
  readonly shotLines: ReadonlyArray<string> | undefined;
}): ReadonlyArray<string> {
  if (input.shotLines && input.shotLines.length > 0) return input.shotLines;
  const kind = agentCanvasPreviewKind({
    goalObjective: input.thread.goal?.objective,
    title: input.thread.title,
    visibleItemCount: input.thread.visibleItemCount,
    latestRunStatus: input.thread.latestRun?.status,
  });
  if (kind === "goal" && input.thread.goal?.objective) {
    return input.thread.goal.objective
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 5);
  }
  if (kind === "completed") {
    return [input.gt("Last run finished. Open to continue or inspect tools.")];
  }
  if (kind === "empty") {
    return [input.gt("No messages yet. Open to start working in this node.")];
  }
  return [input.thread.title];
}

const LEAD_HANDLE_TOPS = ["18%", "50%", "82%"] as const;

export const AgentCanvasNode = memo(function AgentCanvasNode({
  id,
  data,
  selected,
}: NodeProps<AgentCanvasAgentFlowNode>) {
  const gt = useGT();
  const updateNodeInternals = useUpdateNodeInternals();
  const setAgentRole = useAgentCanvasStore((state) => state.setAgentRole);
  const pushHistory = useAgentCanvasStore((state) => state.pushHistory);
  const edges = useAgentCanvasStore((state) => state.edges);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const relativeUpdated = useRelativeTimeState(data.thread.updatedAt);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- RF must remeasure fan-out handle positions
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals]);

  const thread = data.thread;
  const threadKey = data.threadKey;
  const shot = readShotDemo(threadKey);
  // Live threads stay interactive; shot-demo only paints preview/chip chrome when LOD asks for it.
  const lod = data.lod;
  const tone = shot?.tone ?? threadStatusTone(thread);
  const status = shot?.statusLabel ?? threadStatusLabel(thread, gt);
  const title = shot?.title ?? thread.title;
  const workers = workerKeysForLead(threadKey, edges);
  const isLeadLike = data.role === "lead" || data.role === "coordinator";
  const highlighted = selected || data.focused;
  const lines = previewLines({ thread, gt, shotLines: shot?.lines });
  const relativeLabel = relativeUpdated.status === "relative" ? relativeUpdated.label : null;
  const modelLabel = shot?.modelLabel ?? String(thread.providerInstanceId);
  const stepsLabel =
    shot?.stepsLabel ??
    (thread.visibleItemCount > 0
      ? gt("{count, plural, one {# step} other {# steps}}", { count: thread.visibleItemCount })
      : null);

  if (lod === "chip") {
    return (
      <button
        type="button"
        data-agent-canvas-node={threadKey}
        data-agent-canvas-lod={lod}
        aria-label={`${title} · ${status}`}
        onClick={data.onFocus}
        className={cn(
          "flex h-full w-full items-center gap-2 overflow-hidden rounded-lg border bg-card px-2.5 text-left",
          "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          highlighted ? "border-primary shadow-composer" : "border-border/80",
        )}
      >
        <StatusDot tone={tone} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium tracking-tight">{title}</span>
        <RolePill role={data.role} />
      </button>
    );
  }

  return (
    <div
      data-agent-canvas-node={threadKey}
      data-agent-canvas-lod={lod}
      className={cn(
        "group relative flex w-full flex-col justify-start overflow-hidden rounded-xl border bg-card",
        lod === "interactive" ? "h-full" : "h-auto",
        "outline-none transition-[border-color,box-shadow] duration-150",
        highlighted
          ? "border-primary/70 shadow-composer"
          : "border-border/65 hover:border-border hover:shadow-composer",
        isLeadLike && "ring-1 ring-primary/22",
        isLeadLike && highlighted && "ring-primary/40",
      )}
      onPointerDownCapture={() => {
        if (!data.focused) data.onFocus();
      }}
    >
      <NodeResizer
        minWidth={360}
        minHeight={280}
        maxWidth={1400}
        maxHeight={1200}
        isVisible={highlighted}
        lineClassName="!border-primary/30"
        handleClassName="!size-1.5 !rounded-xs !border-primary !bg-background"
      />

      <Handle type="target" position={Position.Left} id="in" className="!-left-1" />
      <Handle type="target" position={Position.Top} id="in-top" className="!-top-1" />
      {/* Always mount fan outlets so lead edges can leave from distinct Y positions. */}
      {LEAD_SOURCE_HANDLES.map((handleId, index) => (
        <Handle
          key={handleId}
          type="source"
          position={Position.Right}
          id={handleId}
          className="!-right-1"
          style={{ top: LEAD_HANDLE_TOPS[index], transform: "translate(50%, -50%)" }}
        />
      ))}
      <Handle type="source" position={Position.Right} id="out" className="!-right-1" />
      <Handle type="source" position={Position.Bottom} id="out-bottom" className="!-bottom-1" />

      <div className="drag-handle flex shrink-0 cursor-grab flex-col gap-0.5 border-b border-border/60 px-2.5 py-1.5 active:cursor-grabbing">
        <div className="flex items-start gap-1.5">
          <StatusDot tone={tone} />
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="min-w-0 flex-1 py-0.5 text-left text-sm leading-snug font-medium tracking-tight whitespace-normal outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={data.onFocus}
                />
              }
            >
              <span className="line-clamp-2 wrap-break-word">{title}</span>
            </TooltipTrigger>
            <TooltipPopup>{title}</TooltipPopup>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon-micro"
                  variant="ghost-muted"
                  className="shrink-0"
                  aria-label={gt("Node actions")}
                />
              }
            >
              <MoreHorizontalIcon className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuItem onClick={data.onFocus}>{gt("Open live session")}</DropdownMenuItem>
              {(
                [
                  ["none", gt("No role")],
                  ["lead", gt("Lead")],
                  ["coordinator", gt("Coordinator")],
                  ["worker", gt("Worker")],
                ] as const
              ).map(([role, label]) => (
                <DropdownMenuItem
                  key={role}
                  onClick={() => {
                    pushHistory();
                    setAgentRole(threadKey, role);
                  }}
                >
                  {label}
                </DropdownMenuItem>
              ))}
              {isLeadLike && workers.length > 0 ? (
                <DropdownMenuItem onClick={() => setBroadcastOpen(true)}>
                  {gt("Send to workers")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="truncate pl-3.5 text-2xs text-muted-foreground">{modelLabel}</p>
      </div>

      {broadcastOpen ? (
        <div
          className="flex shrink-0 flex-col gap-2 border-b border-border bg-muted/20 p-2"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <textarea
            value={broadcastText}
            onChange={(event) => setBroadcastText(event.target.value)}
            placeholder={gt("Message for connected workers…")}
            rows={2}
            className="nodrag nopan nowheel resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          />
          <div className="flex justify-end gap-1">
            <Button size="xs" variant="ghost-muted" onClick={() => setBroadcastOpen(false)}>
              {gt("Cancel")}
            </Button>
            <Button
              size="xs"
              disabled={broadcastBusy || broadcastText.trim().length === 0}
              onClick={() => {
                const text = broadcastText.trim();
                if (text.length === 0) return;
                setBroadcastBusy(true);
                void data
                  .onSendToWorkers(text)
                  .then(() => {
                    setBroadcastText("");
                    setBroadcastOpen(false);
                  })
                  .finally(() => setBroadcastBusy(false));
              }}
            >
              <SendIcon />
              {gt("Send")}
            </Button>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "relative min-h-0",
          lod === "interactive" ? "flex min-h-0 flex-1 flex-col" : "shrink-0",
        )}
      >
        {lod === "interactive" ? (
          <AgentCanvasSession
            environmentId={thread.environmentId}
            threadId={thread.id}
            active={data.focused}
          />
        ) : (
          <button
            type="button"
            className="flex w-full flex-col gap-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onClick={data.onFocus}
          >
            <div className="overflow-hidden bg-muted/25 px-3 py-1.5">
              <div className="font-mono text-2xs leading-snug text-muted-foreground">
                {lines.slice(0, 4).map((line) => (
                  <p key={line} className="truncate text-foreground/80">
                    <span className="mr-2 text-muted-foreground/70 select-none">›</span>
                    {line}
                  </p>
                ))}
              </div>
            </div>
            <div className="flex min-h-7 shrink-0 items-center gap-2 border-t border-border/50 px-3 pt-1 pb-1.5 text-2xs text-muted-foreground">
              <RolePill role={data.role} />
              <span className="truncate">{status}</span>
              {relativeLabel ? <span className="truncate">{relativeLabel}</span> : null}
              {stepsLabel ? (
                <span className="ml-auto truncate tabular-nums">{stepsLabel}</span>
              ) : null}
              {data.workerCount > 0 ? (
                <span className="truncate tabular-nums">
                  {gt("{count, plural, one {# worker} other {# workers}}", {
                    count: data.workerCount,
                  })}
                </span>
              ) : null}
            </div>
            {/* Lightweight composer affordance at preview LOD — real ChatView at interactive zoom. */}
            <div
              className="flex shrink-0 items-center gap-1.5 border-t border-border/60 bg-background/80 px-2.5 py-1.5"
              aria-hidden
            >
              <span className="min-h-7 min-w-0 flex-1 truncate rounded-md border border-border/70 bg-muted/30 px-2 py-1 text-2xs text-muted-foreground/80">
                {gt("Ask anything…")}
              </span>
              <span className="size-6 shrink-0 rounded-md bg-primary/80" />
            </div>
          </button>
        )}
      </div>
    </div>
  );
});
