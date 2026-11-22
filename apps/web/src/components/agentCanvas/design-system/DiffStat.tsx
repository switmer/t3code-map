import { cn } from "~/lib/utils";

type DiffStatProps = {
  className?: string;
  edits?: number;
  reads?: number;
  tests?: number;
};

export function DiffStat({ className, edits = 0, reads = 0, tests = 0 }: DiffStatProps) {
  const chips = [
    { count: reads, key: "read", label: "read" },
    { count: edits, key: "edit", label: "edit" },
    { count: tests, key: "test", label: "test" },
  ].filter((item) => item.count > 0);

  if (chips.length === 0) {
    return (
      <span
        className={cn("text-[length:var(--ac-font-xs)] text-[var(--ac-text-muted)]", className)}
      >
        —
      </span>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-[var(--ac-space-1)]", className)}>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-[var(--ac-space-1)] rounded-[var(--ac-radius-sm)] bg-[var(--ac-surface-3)] px-[var(--ac-space-2)] py-[calc(var(--ac-space-1)/2)] text-[length:var(--ac-font-xs)] text-[var(--ac-text-secondary)]"
        >
          <span className="font-medium tabular-nums">{chip.count}</span>
          {chip.label}
        </span>
      ))}
    </div>
  );
}
