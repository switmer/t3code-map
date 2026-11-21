import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { useGT } from "gt-react";
import { GripHorizontalIcon } from "lucide-react";
import { memo, type PointerEvent as ReactPointerEvent } from "react";

import type { AgentCanvasNodeLayout } from "../../agentCanvasStore";
import { cn } from "../../lib/utils";
import type { AgentCanvasLod } from "./agentCanvas.logic";
import { AgentCanvasSession } from "./AgentCanvasSession";

function threadStatusTone(thread: EnvironmentThreadShell): string {
  if (thread.hasPendingApprovals || thread.hasPendingUserInput) return "bg-warning";
  if (thread.runtime?.status === "running" || thread.latestRun?.status === "running") {
    return "bg-success";
  }
  if (thread.latestRun?.status === "failed") return "bg-destructive";
  return "bg-muted-foreground/50";
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

export const AgentCanvasNode = memo(function AgentCanvasNode(props: {
  readonly thread: EnvironmentThreadShell;
  readonly layout: AgentCanvasNodeLayout;
  readonly lod: AgentCanvasLod;
  readonly focused: boolean;
  readonly onFocus: () => void;
  readonly onMoveStart: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onResizeStart: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const gt = useGT();
  const threadRef = scopeThreadRef(props.thread.environmentId, props.thread.id);
  const threadKey = scopedThreadKey(threadRef);
  const status = threadStatusLabel(props.thread, gt);

  if (props.lod === "chip") {
    return (
      <button
        type="button"
        data-agent-canvas-node={threadKey}
        data-agent-canvas-lod="chip"
        aria-label={props.thread.title}
        onClick={props.onFocus}
        onPointerDown={(event) => event.stopPropagation()}
        style={{
          left: props.layout.x,
          top: props.layout.y,
          width: Math.min(props.layout.width, 220),
          height: 44,
        }}
        className={cn(
          "absolute flex items-center gap-2 overflow-hidden rounded-lg border bg-card px-3 text-left shadow-sm/5",
          props.focused ? "border-primary ring-2 ring-primary/40" : "border-border",
        )}
      >
        <span className={cn("size-2 shrink-0 rounded-full", threadStatusTone(props.thread))} />
        <span className="min-w-0 truncate text-xs font-medium">{props.thread.title}</span>
      </button>
    );
  }

  return (
    <div
      data-agent-canvas-node={threadKey}
      data-agent-canvas-lod={props.lod}
      style={{
        left: props.layout.x,
        top: props.layout.y,
        width: props.layout.width,
        height: props.layout.height,
      }}
      className={cn(
        "absolute flex flex-col overflow-hidden rounded-xl border bg-card shadow-md/10",
        props.focused ? "border-primary ring-2 ring-primary/30" : "border-border",
      )}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="flex h-9 shrink-0 cursor-grab items-center gap-2 border-b border-border bg-muted/40 px-2 active:cursor-grabbing"
        onPointerDown={props.onMoveStart}
      >
        <GripHorizontalIcon aria-hidden className="size-3.5 text-muted-foreground" />
        <span className={cn("size-2 shrink-0 rounded-full", threadStatusTone(props.thread))} />
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-xs font-semibold"
          onClick={props.onFocus}
        >
          {props.thread.title}
        </button>
        <span className="shrink-0 text-2xs text-muted-foreground">{status}</span>
      </div>

      <div className="relative min-h-0 flex-1">
        {props.lod === "interactive" ? (
          <AgentCanvasSession
            environmentId={props.thread.environmentId}
            threadId={props.thread.id}
            active={props.focused}
          />
        ) : (
          <button
            type="button"
            className="flex h-full w-full flex-col items-start gap-2 bg-background/80 p-3 text-left"
            onClick={props.onFocus}
          >
            <p className="text-xs text-muted-foreground">
              {gt("Click to open this agent on the canvas.")}
            </p>
            <p className="line-clamp-6 text-sm text-foreground/90">
              {props.thread.goal?.objective ??
                props.thread.latestRun?.status ??
                gt("{count, plural, =0 {No messages yet} other {# items}}", {
                  count: props.thread.visibleItemCount,
                })}
            </p>
            <span className="mt-auto text-2xs text-muted-foreground">
              {String(props.thread.providerInstanceId)}
            </span>
          </button>
        )}
      </div>

      <div
        aria-hidden
        className="absolute right-0 bottom-0 size-4 cursor-se-resize"
        onPointerDown={props.onResizeStart}
      >
        <span className="absolute right-1 bottom-1 size-2 border-r-2 border-b-2 border-muted-foreground/60" />
      </div>
    </div>
  );
});
