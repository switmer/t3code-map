import { cn } from "~/lib/utils";

import type { AcStatusTone } from "./acTypes";
import { CardHeader } from "./CardHeader";

type PreviewNodeProps = {
  className?: string;
  lines?: readonly string[];
  providerLabel?: string;
  statusTone?: AcStatusTone;
  title: string;
};

export function PreviewNode({
  className,
  lines = ["Summarizing thread…", "3 tools completed"],
  providerLabel,
  statusTone = "running",
  title,
}: PreviewNodeProps) {
  return (
    <article
      className={cn(
        "agent-canvas-ds flex w-full max-w-xs flex-col overflow-hidden rounded-[var(--ac-radius-lg)] border border-[var(--ac-border-default)] bg-[var(--ac-surface-1)] shadow-[var(--ac-shadow-1)]",
        className,
      )}
      data-agent-canvas-lod="preview"
    >
      <CardHeader
        statusTone={statusTone}
        title={title}
        {...(providerLabel !== undefined ? { providerLabel } : {})}
      />
      <div className="flex flex-col gap-[var(--ac-space-1)] px-[var(--ac-space-3)] py-[var(--ac-space-2)]">
        {lines.map((line) => (
          <div
            key={line}
            className="truncate text-[length:var(--ac-font-xs)] text-[var(--ac-text-tertiary)]"
          >
            {line}
          </div>
        ))}
      </div>
    </article>
  );
}
