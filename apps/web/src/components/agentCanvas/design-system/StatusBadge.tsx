import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

import type { AcStatusTone } from "./acTypes";
import { StatusDot } from "./StatusDot";

const statusBadgeVariants = cva(
  "inline-flex shrink-0 items-center gap-[var(--ac-space-1)] rounded-[var(--ac-radius-sm)] border border-transparent px-[var(--ac-space-2)] py-[calc(var(--ac-space-1)/2)] font-medium leading-none",
  {
    defaultVariants: {
      tone: "idle",
    },
    variants: {
      tone: {
        done: "bg-[var(--ac-status-done-surface)] text-[var(--ac-status-done)]",
        failed: "bg-[var(--ac-status-failed-surface)] text-[var(--ac-status-failed)]",
        idle: "bg-[var(--ac-status-idle-surface)] text-[var(--ac-text-secondary)]",
        ready: "bg-[var(--ac-status-ready-surface)] text-[var(--ac-text-secondary)]",
        running: "bg-[var(--ac-status-running-surface)] text-[var(--ac-status-running)]",
        waiting: "bg-[var(--ac-status-waiting-surface)] text-[var(--ac-status-waiting)]",
      } satisfies Record<AcStatusTone, string>,
    },
  },
);

type StatusBadgeProps = VariantProps<typeof statusBadgeVariants> & {
  className?: string;
  label: string;
  showDot?: boolean;
};

export function StatusBadge({ className, label, showDot = true, tone }: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ className, tone }), "text-[length:var(--ac-font-xs)]")}
    >
      {showDot ? <StatusDot size="sm" tone={tone} /> : null}
      {label}
    </span>
  );
}
