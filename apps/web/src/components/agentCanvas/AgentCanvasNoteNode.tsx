import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import { useGT } from "gt-react";
import { StickyNoteIcon, Trash2Icon } from "lucide-react";
import { memo, useState, type CSSProperties } from "react";

import { useAgentCanvasStore } from "../../agentCanvasStore";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import type { AgentCanvasLod } from "./agentCanvas.logic";
import { AGENT_CANVAS_CHIP_SCREEN } from "./design-system/ChipNode";

export type AgentCanvasNoteFlowNode = Node<
  {
    readonly noteId: string;
    readonly text: string;
    readonly lod?: AgentCanvasLod;
    readonly zoom?: number;
    readonly chipScreenWidth?: number;
    readonly chipScreenHeight?: number;
  },
  "note"
>;

export const AgentCanvasNoteNode = memo(function AgentCanvasNoteNode({
  id,
  data,
  selected,
}: NodeProps<AgentCanvasNoteFlowNode>) {
  const gt = useGT();
  const upsertNote = useAgentCanvasStore((state) => state.upsertNote);
  const removeNote = useAgentCanvasStore((state) => state.removeNote);
  const pushHistory = useAgentCanvasStore((state) => state.pushHistory);
  const note = useAgentCanvasStore((state) => state.notes[data.noteId]);
  const [draft, setDraft] = useState(data.text);

  if (note === undefined) return null;

  const lod = data.lod ?? "interactive";
  const zoom = data.zoom ?? 1;

  if (lod === "chip") {
    const safeZoom = Math.max(0.15, Math.min(zoom, 1));
    const screenW = data.chipScreenWidth ?? Math.min(AGENT_CANVAS_CHIP_SCREEN.width, 160);
    const screenH = data.chipScreenHeight ?? AGENT_CANVAS_CHIP_SCREEN.height;
    const firstLine = note.text.split(/\n+/)[0]?.trim() || gt("Note");
    const innerStyle: CSSProperties = {
      width: screenW,
      height: screenH,
      transform: `scale(${1 / safeZoom})`,
      transformOrigin: "top left",
    };
    return (
      <div
        className="relative h-full w-full overflow-hidden"
        data-agent-canvas-note={data.noteId}
        data-agent-canvas-lod="chip"
      >
        <Handle type="target" position={Position.Left} id="in" className="!opacity-0" />
        <Handle type="source" position={Position.Right} id="out" className="!opacity-0" />
        <Tooltip>
          <TooltipTrigger
            render={
              <div
                className="box-border inline-flex max-w-full items-center gap-1.5 overflow-hidden rounded-md border border-warning/40 bg-warning/10 px-2 shadow-composer"
                style={innerStyle}
              >
                <StickyNoteIcon aria-hidden className="size-3 shrink-0 text-warning" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium tracking-tight text-foreground">
                  {firstLine}
                </span>
              </div>
            }
          />
          <TooltipPopup>{note.text}</TooltipPopup>
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "agent-canvas-sticky group relative flex h-full w-full flex-col overflow-hidden rounded-lg",
        selected && "ring-2 ring-inset ring-primary/35",
      )}
      data-agent-canvas-note={data.noteId}
    >
      <NodeResizer
        minWidth={150}
        minHeight={100}
        maxWidth={480}
        maxHeight={480}
        isVisible={selected}
        lineClassName="!border-primary/35"
        handleClassName="!size-1.5 !rounded-xs !border-primary !bg-background"
      />
      <Handle type="target" position={Position.Left} id="in" className="!bg-warning/80" />
      <Handle type="source" position={Position.Right} id="out" className="!bg-warning/80" />

      <div className="flex h-6 shrink-0 items-center gap-1 px-2.5 pt-1">
        <span className="min-w-0 flex-1 truncate text-2xs font-medium tracking-tight text-muted-foreground/80">
          {gt("Note")}
        </span>
        <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            size="icon-micro"
            variant="ghost-muted"
            aria-label={gt("Delete note")}
            onClick={() => {
              pushHistory();
              removeNote(data.noteId);
            }}
          >
            <Trash2Icon className="size-3" />
          </Button>
        </span>
      </div>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft === note.text) return;
          pushHistory();
          upsertNote({ ...note, text: draft });
        }}
        onPointerDown={(event) => event.stopPropagation()}
        placeholder={gt("Write a note…")}
        className={cn(
          "nodrag nopan nowheel min-h-0 flex-1 resize-none bg-transparent px-2.5 pb-2.5",
          "text-sm leading-relaxed text-foreground/90 outline-none placeholder:text-muted-foreground/55",
          "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        )}
        aria-label={gt("Sticky note text")}
      />
      <span className="sr-only">{id}</span>
    </div>
  );
});
