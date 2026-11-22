import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

import type { AcMessageRole } from "./acTypes";

const messageRowVariants = cva(
  "rounded-[var(--ac-radius-md)] px-[var(--ac-space-3)] py-[var(--ac-space-2)] text-[length:var(--ac-font-sm)]",
  {
    defaultVariants: {
      role: "assistant",
      streaming: false,
    },
    variants: {
      role: {
        assistant: "bg-[var(--ac-surface-2)] text-[var(--ac-text-primary)]",
        system:
          "border border-dashed border-[var(--ac-border-subtle)] bg-transparent text-[var(--ac-text-tertiary)] text-[length:var(--ac-font-xs)]",
        user: "bg-[var(--ac-accent-muted)] text-[var(--ac-text-primary)]",
      } satisfies Record<AcMessageRole, string>,
      streaming: {
        false: "",
        true: "ac-stream-cursor",
      },
    },
  },
);

type MessageRowProps = VariantProps<typeof messageRowVariants> & {
  children: string;
  className?: string;
};

export function MessageRow({ children, className, role, streaming }: MessageRowProps) {
  return (
    <div
      className={cn(
        messageRowVariants({ className, role, streaming }),
        "leading-[var(--ac-line-normal)]",
      )}
    >
      {children}
    </div>
  );
}
