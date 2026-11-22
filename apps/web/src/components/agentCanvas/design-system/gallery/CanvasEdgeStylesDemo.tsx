import type { AcEdgeKind } from "../acTypes";
import { canvasEdgeStyle } from "../CanvasEdgeStyles";

const KINDS: AcEdgeKind[] = ["idle", "active", "broadcast", "dependency"];

export function CanvasEdgeStylesDemo() {
  return (
    <div className="flex flex-wrap gap-6">
      {KINDS.map((kind) => {
        const style = canvasEdgeStyle(kind);
        return (
          <svg key={kind} aria-hidden className="h-8 w-24" viewBox="0 0 96 32">
            <title>{kind}</title>
            <line
              stroke={style.stroke}
              strokeLinecap="round"
              strokeWidth={style.strokeWidth}
              x1="4"
              x2="92"
              y1="16"
              y2="16"
            />
            <text className="fill-muted-foreground text-[length:var(--ac-font-xs)]" x="4" y="28">
              {kind}
            </text>
          </svg>
        );
      })}
    </div>
  );
}
