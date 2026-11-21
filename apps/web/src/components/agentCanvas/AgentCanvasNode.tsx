import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import { useGT } from "gt-react";
import {
  CrownIcon,
  GripHorizontalIcon,
  Maximize2Icon,
  SendIcon,
  UsersIcon,
  WaypointsIcon,
} from "lucide-react";
import { memo, useState } from "react";

import { useAgentCanvasStore, type AgentCanvasRole } from "../../agentCanvasStore";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import type { AgentCanvasLod } from "./agentCanvas.logic";
import { workerKeysForLead } from "./agentCanvas.logic";
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
  if (thread.latestRun?.status === "completed") return gt("Idle");
  return gt("Ready");
}

function StatusDot(props: { readonly tone: StatusTone }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        props.tone === "running" && "agent-canvas-status-pulse bg-success text-success",
        props.tone === "attention" && "bg-warning text-warning",
        props.tone === "failed" && "bg-destructive text-destructive",
        props.tone === "idle" && "bg-muted-foreground/50",
        props.tone === "ready" && "bg-muted-foreground/40",
      )}
    />
  );
}

function RoleBadge(props: { readonly role: AgentCanvasRole }) {
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
    <Badge
      size="sm"
      variant={
        props.role === "lead" ? "default" : props.role === "coordinator" ? "info" : "outline"
      }
    >
      <Icon aria-hidden className="size-3!" />
      {label}
    </Badge>
  );
}

function previewCopy(thread: EnvironmentThreadShell, gt: ReturnType<typeof useGT>): string {
  if (thread.goal?.objective) return thread.goal.objective;
  if (thread.latestRun?.status === "completed") {
    return gt("Last run finished. Open to continue the conversation or inspect tools.");
  }
  return gt(
    "{count, plural, =0 {No messages yet. Open to start working in this node.} other {# timeline items ready to inspect.}}",
    { count: thread.visibleItemCount },
  );
}

export const AgentCanvasNode = memo(function AgentCanvasNode({
  data,
  selected,
}: NodeProps<AgentCanvasAgentFlowNode>) {
  const gt = useGT();
  const setAgentRole = useAgentCanvasStore((state) => state.setAgentRole);
  const pushHistory = useAgentCanvasStore((state) => state.pushHistory);
  const edges = useAgentCanvasStore((state) => state.edges);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastBusy, setBroadcastBusy] = useState(false);

  const thread = data.thread;
  const threadKey = data.threadKey;
  const tone = threadStatusTone(thread);
  const status = threadStatusLabel(thread, gt);
  const workers = workerKeysForLead(threadKey, edges);
  const isLeadLike = data.role === "lead" || data.role === "coordinator";
  const highlighted = selected || data.focused;

  if (data.lod === "chip") {
    return (
      <button
        type="button"
        data-agent-canvas-node={threadKey}
        data-agent-canvas-lod="chip"
        aria-label={`${thread.title} · ${status}`}
        onClick={data.onFocus}
        className={cn(
          "flex h-full w-full items-center gap-2 overflow-hidden rounded-xl border bg-card/95 px-3 text-left shadow-xs backdrop-blur-sm",
          "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          highlighted ? "border-primary ring-2 ring-primary/35" : "border-border/80",
        )}
      >
        <StatusDot tone={tone} />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold tracking-tight">
          {thread.title}
        </span>
        <RoleBadge role={data.role} />
      </button>
    );
  }

  return (
    <div
      data-agent-canvas-node={threadKey}
      data-agent-canvas-lod={data.lod}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card",
        "agent-canvas-node-shadow dark:agent-canvas-node-shadow-dark",
        "outline-none",
        highlighted
          ? "border-primary ring-2 ring-primary/30"
          : "border-border/70 hover:border-border",
        isLeadLike && !highlighted && "border-primary/25",
      )}
    >
      <NodeResizer
        minWidth={320}
        minHeight={240}
        maxWidth={1400}
        maxHeight={1200}
        isVisible={highlighted}
        lineClassName="!border-primary/40"
        handleClassName="!size-2.5 !rounded-sm !border-primary !bg-background !shadow-xs"
      />

      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!-left-1.5 !size-3 !border-2 !border-background !bg-muted-foreground/75"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="!-right-1.5 !size-3 !border-2 !border-background !bg-primary"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="out-bottom"
        className="!-bottom-1.5 !size-3 !border-2 !border-background !bg-primary/80"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="in-top"
        className="!-top-1.5 !size-3 !border-2 !border-background !bg-muted-foreground/75"
      />

      <div className="drag-handle flex h-11 shrink-0 cursor-grab items-center gap-2 border-b border-border/70 bg-gradient-to-b from-muted/50 to-muted/25 px-2.5 active:cursor-grabbing">
        <GripHorizontalIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground/80" />
        <StatusDot tone={tone} />
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-sm font-semibold tracking-tight outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          onClick={data.onFocus}
        >
          {thread.title}
        </button>
        <RoleBadge role={data.role} />
        <Badge
          size="sm"
          variant={
            tone === "running"
              ? "success"
              : tone === "attention"
                ? "warning"
                : tone === "failed"
                  ? "error"
                  : "outline"
          }
          className="hidden shrink-0 sm:inline-flex"
        >
          {status}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button size="xs" variant="ghost-muted" className="shrink-0" />}
          >
            {gt("Role")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
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
          </DropdownMenuContent>
        </DropdownMenu>

        {isLeadLike && workers.length > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={gt("Send message to workers")}
                  onClick={() => setBroadcastOpen((open) => !open)}
                >
                  <SendIcon />
                </Button>
              }
            />
            <TooltipPopup>
              {gt("Send a prompt to {count, plural, one {# worker} other {# workers}}", {
                count: workers.length,
              })}
            </TooltipPopup>
          </Tooltip>
        ) : null}
      </div>

      {broadcastOpen ? (
        <div
          className="flex shrink-0 flex-col gap-2 border-b border-border bg-muted/25 p-2.5"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <textarea
            value={broadcastText}
            onChange={(event) => setBroadcastText(event.target.value)}
            placeholder={gt("Message for connected workers…")}
            rows={2}
            className="nodrag nopan nowheel resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          />
          <div className="flex justify-end gap-1.5">
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
              {gt("Send to workers")}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {data.lod === "interactive" ? (
          <AgentCanvasSession
            environmentId={thread.environmentId}
            threadId={thread.id}
            active={data.focused}
          />
        ) : (
          <button
            type="button"
            className="flex h-full w-full flex-col gap-3 bg-gradient-to-b from-card via-card to-muted/35 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onClick={data.onFocus}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge size="sm" variant="secondary">
                {String(thread.providerInstanceId)}
              </Badge>
              {data.workerCount > 0 ? (
                <Badge size="sm" variant="info">
                  <UsersIcon className="size-3!" />
                  {gt("{count, plural, one {# worker} other {# workers}}", {
                    count: data.workerCount,
                  })}
                </Badge>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 space-y-2.5">
              <div className="rounded-xl border border-border/60 bg-background/80 p-3 shadow-xs">
                <p className="mb-1.5 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                  {gt("Latest")}
                </p>
                <p className="line-clamp-8 text-sm leading-relaxed text-foreground/90">
                  {previewCopy(thread, gt)}
                </p>
              </div>
              <div className="space-y-1.5 opacity-70" aria-hidden>
                <div className="h-2 w-11/12 rounded-full bg-muted" />
                <div className="h-2 w-2/3 rounded-full bg-muted/80" />
                <div className="ml-auto h-2 w-1/2 rounded-full bg-primary/15" />
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-2xs font-medium text-primary">
              <Maximize2Icon className="size-3" />
              {gt("Open live session")}
            </div>
          </button>
        )}
      </div>
    </div>
  );
});
