import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

import type { AcStickyColor } from "./acTypes";

const stickyNoteVariants = cva(
  "rounded-[var(--ac-radius-md)] border px-[var(--ac-space-3)] py-[var(--ac-space-2)] text-[length:var(--ac-font-sm)] shadow-[var(--ac-shadow-1)]",
  {
    defaultVariants: {
      color: "yellow",
    },
    variants: {
      color: {
        blue: "border-[color-mix(in_oklab,var(--color-info)_35%,var(--ac-border-default))] bg-[color-mix(in_oklab,var(--color-info)_12%,var(--ac-surface-1))] text-[var(--ac-text-primary)]",
        green:
          "border-[color-mix(in_oklab,var(--color-success)_35%,var(--ac-border-default))] bg-[color-mix(in_oklab,var(--color-success)_12%,var(--ac-surface-1))] text-[var(--ac-text-primary)]",
        neutral:
          "border-[var(--ac-border-default)] bg-[var(--ac-surface-2)] text-[var(--ac-text-primary)]",
        pink: "border-[color-mix(in_oklab,var(--color-destructive)_28%,var(--ac-border-default))] bg-[color-mix(in_oklab,var(--color-destructive)_8%,var(--ac-surface-1))] text-[var(--ac-text-primary)]",
        yellow:
          "border-[color-mix(in_oklab,var(--color-warning)_40%,var(--ac-border-default))] bg-[var(--color-warning-surface)] text-[var(--ac-text-primary)]",
      } satisfies Record<AcStickyColor, string>,
    },
  },
);

type StickyNoteCardProps = VariantProps<typeof stickyNoteVariants> & {
  children: string;
  className?: string;
  title?: string;
};

export function StickyNoteCard({ children, className, color, title }: StickyNoteCardProps) {
  return (
    <aside className={cn(stickyNoteVariants({ className, color }), "agent-canvas-ds max-w-xs")}>
      {title ? (
        <div className="mb-[var(--ac-space-1)] font-medium text-[length:var(--ac-font-xs)] text-[var(--ac-text-secondary)]">
          {title}
        </div>
      ) : null}
      <p className="leading-[var(--ac-line-snug)]">{children}</p>
    </aside>
  );
}
