import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import { useGT } from "gt-react";
import { StickyNoteIcon, Trash2Icon } from "lucide-react";
import { memo, useState } from "react";

import { useAgentCanvasStore } from "../../agentCanvasStore";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export type AgentCanvasNoteFlowNode = Node<
  {
    readonly noteId: string;
    readonly text: string;
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

  return (
    <div
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-xl border",
        "border-warning/40 bg-warning-surface text-foreground",
        "agent-canvas-note-shadow",
        selected && "ring-2 ring-inset ring-primary/45",
      )}
      data-agent-canvas-note={data.noteId}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-warning/12 to-transparent"
      />
      <NodeResizer
        minWidth={160}
        minHeight={120}
        maxWidth={640}
        maxHeight={640}
        isVisible={selected}
        lineClassName="!border-primary/40"
        handleClassName="!size-2.5 !rounded-sm !border-primary !bg-background"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!size-2.5 !border-2 !border-background !bg-warning"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="!size-2.5 !border-2 !border-background !bg-warning"
      />

      <div className="relative flex h-9 shrink-0 items-center gap-1.5 border-b border-warning/20 px-2.5">
        <StickyNoteIcon aria-hidden className="size-3.5 text-warning-foreground" />
        <span className="min-w-0 flex-1 truncate text-2xs font-semibold tracking-wide text-warning-foreground/85 uppercase">
          {gt("Note")}
        </span>
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
          "nodrag nopan nowheel relative min-h-0 flex-1 resize-none bg-transparent px-3 py-2.5",
          "text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70",
          "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        )}
        aria-label={gt("Sticky note text")}
      />
      <span className="sr-only">{id}</span>
    </div>
  );
});
