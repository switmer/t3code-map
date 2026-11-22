import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangleIcon, CheckIcon, CircleAlertIcon } from "lucide-react";

import { cn } from "~/lib/utils";

const attentionBadgeVariants = cva(
  "inline-flex items-center gap-[var(--ac-space-1)] rounded-[var(--ac-radius-sm)] border px-[var(--ac-space-2)] py-[calc(var(--ac-space-1)/2)] font-medium leading-none",
  {
    defaultVariants: {
      variant: "needs-you",
    },
    variants: {
      variant: {
        done: "border-[color-mix(in_oklab,var(--ac-status-done)_35%,transparent)] bg-[var(--ac-status-done-surface)] text-[var(--ac-status-done)]",
        failed:
          "border-[color-mix(in_oklab,var(--ac-status-failed)_35%,transparent)] bg-[var(--ac-status-failed-surface)] text-[var(--ac-status-failed)]",
        "needs-you":
          "border-[color-mix(in_oklab,var(--ac-status-waiting)_40%,transparent)] bg-[var(--ac-status-waiting-surface)] text-[var(--ac-status-waiting)]",
      },
    },
  },
);

const VARIANT_ICONS = {
  done: CheckIcon,
  failed: CircleAlertIcon,
  "needs-you": AlertTriangleIcon,
} as const;

type AttentionBadgeProps = VariantProps<typeof attentionBadgeVariants> & {
  className?: string;
  label: string;
};

export function AttentionBadge({ className, label, variant }: AttentionBadgeProps) {
  const Icon = VARIANT_ICONS[variant ?? "needs-you"];
  return (
    <span
      className={cn(
        attentionBadgeVariants({ className, variant }),
        "text-[length:var(--ac-font-xs)]",
      )}
    >
      <Icon aria-hidden className="size-3 shrink-0 opacity-90" />
      {label}
    </span>
  );
}
