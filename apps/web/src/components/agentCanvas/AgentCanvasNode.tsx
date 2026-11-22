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
import { CopyPlusIcon, MoreHorizontalIcon, SendIcon } from "lucide-react";
import { memo, useEffect, useState } from "react";

import { useAgentCanvasStore, type AgentCanvasRole } from "../../agentCanvasStore";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import type { AgentCanvasLod } from "./agentCanvas.logic";
import {
  agentCanvasPreviewKind,
  agentCanvasStatusTone,
  LEAD_SOURCE_HANDLES,
  leadHandleTopPercent,
  readShotDemo,
  threadNeedsAttention,
  workerKeysForLead,
} from "./agentCanvas.logic";
import { AgentCanvasSession } from "./AgentCanvasSession";
import type { AcStatusTone } from "./design-system/acTypes";
import { AgentCard } from "./design-system/AgentCard";
import { AttentionBadge } from "./design-system/AttentionBadge";
import { ChipNode } from "./design-system/ChipNode";
import { PreviewNode } from "./design-system/PreviewNode";
import { RolePill } from "./design-system/RolePill";
import { StatusDot } from "./design-system/StatusDot";

export type AgentCanvasAgentFlowNode = Node<
  {
    readonly threadKey: string;
    readonly thread: EnvironmentThreadShell;
    readonly role: AgentCanvasRole;
    readonly lod: AgentCanvasLod;
    readonly zoom: number;
    readonly focused: boolean;
    readonly workerCount: number;
    readonly needsAttention: boolean;
    readonly onFocus: () => void;
    readonly onSendToWorkers: (message: string) => Promise<void>;
    readonly onDuplicateWithModel: () => void;
  },
  "agent"
>;

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

function toAcTone(tone: ReturnType<typeof agentCanvasStatusTone>): AcStatusTone {
  if (tone === "attention") return "waiting";
  if (tone === "idle") return "done";
  return tone;
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

  const thread = data.thread;
  const threadKey = data.threadKey;
  const shot = readShotDemo(threadKey);
  const lod = data.lod;
  const tone = shot?.tone ?? agentCanvasStatusTone(thread);
  const acTone = toAcTone(tone);
  const status = shot?.statusLabel ?? threadStatusLabel(thread, gt);
  const title = shot?.title ?? thread.title;
  const isLeadLike = data.role === "lead" || data.role === "coordinator";
  const highlighted = selected || data.focused;
  const lines = previewLines({ thread, gt, shotLines: shot?.lines });
  const modelLabel = shot?.modelLabel ?? String(thread.providerInstanceId);
  const showAttentionBadge =
    data.needsAttention ||
    threadNeedsAttention(thread) ||
    shot?.tone === "attention" ||
    shot?.tone === "failed";

  const workers = workerKeysForLead(threadKey, edges);

  const handleGeometryKey = `${data.role}:${workers.length}:${lod}`;
  // Keep React Flow handle positions in sync when fan count / role / LOD changes.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- syncs handle geometry with React Flow internals
  useEffect(() => {
    if (handleGeometryKey.length === 0) return;
    updateNodeInternals(id);
  }, [updateNodeInternals, id, handleGeometryKey]);

  const cardState =
    tone === "failed"
      ? "failed"
      : tone === "attention"
        ? "attention"
        : tone === "running"
          ? "running"
          : highlighted
            ? "focused"
            : selected
              ? "selected"
              : "default";

  // Handles must exist at every LOD so lead→worker edges stay visible when zoomed out.
  // Chip/preview keep them invisible; interactive keeps the prior chrome.
  const handleChrome = lod === "interactive" ? "" : "!opacity-0 !pointer-events-none";
  const connectionHandles = (
    <>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className={cn("!-left-1 !top-1/2", handleChrome)}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="in-top"
        className={cn("!-top-1", handleChrome)}
      />
      {LEAD_SOURCE_HANDLES.map((handleId, index) => (
        <Handle
          key={handleId}
          type="source"
          position={Position.Right}
          id={handleId}
          className={cn("!-right-1", handleChrome)}
          style={{
            top: leadHandleTopPercent(index),
            transform: "translate(50%, -50%)",
          }}
        />
      ))}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className={cn("!-right-1", handleChrome)}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="out-bottom"
        className={cn("!-bottom-1", handleChrome)}
      />
    </>
  );

  if (lod === "chip") {
    return (
      <div data-agent-canvas-node={threadKey} className="relative h-full w-full">
        {connectionHandles}
        <ChipNode
          title={title}
          statusTone={acTone}
          statusLabel={status}
          zoom={data.zoom}
          role={data.role}
          showAttention={showAttentionBadge}
          onClick={data.onFocus}
        />
      </div>
    );
  }

  if (lod === "preview") {
    return (
      <div data-agent-canvas-node={threadKey} className="relative w-full">
        {connectionHandles}
        <PreviewNode
          title={title}
          statusTone={acTone}
          providerLabel={modelLabel}
          lines={lines.slice(0, 4)}
          className={cn(highlighted && "ring-1 ring-primary/40")}
        />
      </div>
    );
  }

  return (
    <AgentCard
      variant="interactive"
      state={cardState}
      bodyFlush
      className={cn("group relative h-full w-full", isLeadLike && "ring-1 ring-primary/30")}
      data-agent-canvas-node={threadKey}
      data-agent-canvas-lod={lod}
      data-agent-canvas-status={tone}
      header={
        <div
          className="drag-handle flex h-7 shrink-0 cursor-grab items-center gap-2 border-b border-border/60 px-2 active:cursor-grabbing"
          onPointerDownCapture={() => {
            if (!data.focused) data.onFocus();
          }}
        >
          <StatusDot tone={acTone} />
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate py-0.5 text-left text-xs leading-none font-medium tracking-tight outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={data.onFocus}
                />
              }
            >
              <span className="truncate">{title}</span>
            </TooltipTrigger>
            <TooltipPopup>{title}</TooltipPopup>
          </Tooltip>
          {showAttentionBadge ? (
            <AttentionBadge
              variant={tone === "failed" ? "failed" : tone === "idle" ? "done" : "needs-you"}
              label={
                tone === "failed" ? gt("Failed") : tone === "idle" ? gt("Done") : gt("Needs you")
              }
            />
          ) : null}
          <span className="max-w-24 shrink-0 truncate font-mono text-3xs leading-none text-muted-foreground">
            {modelLabel}
          </span>
          {data.role === "lead" || data.role === "coordinator" || data.role === "worker" ? (
            <RolePill
              role={data.role}
              label={
                data.role === "lead"
                  ? gt("Lead")
                  : data.role === "coordinator"
                    ? gt("Coordinator")
                    : gt("Worker")
              }
            />
          ) : null}
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
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onClick={data.onFocus}>{gt("Open live session")}</DropdownMenuItem>
              <DropdownMenuItem onClick={data.onDuplicateWithModel}>
                <CopyPlusIcon className="size-3.5" />
                {gt("Duplicate with another model")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
      }
      body={
        <>
          <NodeResizer
            minWidth={360}
            minHeight={280}
            maxWidth={1400}
            maxHeight={1200}
            isVisible={highlighted}
            lineClassName="!border-primary/30"
            handleClassName="!size-1.5 !rounded-xs !border-primary !bg-background"
          />

          {connectionHandles}

          {broadcastOpen ? (
            <div
              className="flex shrink-0 flex-col gap-2 border-b border-border/60 bg-muted/20 p-2"
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

          <div className="relative flex min-h-0 flex-1 flex-col">
            <AgentCanvasSession
              environmentId={thread.environmentId}
              threadId={thread.id}
              active={data.focused}
            />
          </div>
        </>
      }
    />
  );
});
