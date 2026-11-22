import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

import type { AcStatusTone } from "./acTypes";

const statusDotVariants = cva("relative shrink-0 rounded-full", {
  defaultVariants: {
    size: "sm",
    tone: "idle",
  },
  variants: {
    size: {
      lg: "size-2.5",
      md: "size-2",
      sm: "size-1.5",
    },
    tone: {
      done: "bg-[var(--ac-status-done)]",
      failed: "bg-[var(--ac-status-failed)]",
      idle: "bg-[var(--ac-status-idle)]",
      ready: "bg-[var(--ac-status-ready)]",
      running: "ac-status-pulse bg-[var(--ac-status-running)]",
      waiting: "bg-[var(--ac-status-waiting)]",
    } satisfies Record<AcStatusTone, string>,
  },
});

type StatusDotProps = VariantProps<typeof statusDotVariants> & {
  className?: string;
  label?: string;
};

export function StatusDot({ className, label, size, tone }: StatusDotProps) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn(statusDotVariants({ className, size, tone }))}
      role={label ? "img" : undefined}
    />
  );
}
