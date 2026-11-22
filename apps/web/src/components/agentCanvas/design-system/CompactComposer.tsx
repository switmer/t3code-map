import { cva, type VariantProps } from "class-variance-authority";
import { SquareIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

const composerShellVariants = cva(
  "flex items-end gap-[var(--ac-space-2)] rounded-[var(--ac-radius-lg)] border bg-[var(--ac-surface-elevated)] px-[var(--ac-space-3)] py-[var(--ac-space-2)] shadow-[var(--ac-shadow-1)] transition-[border-color,box-shadow] duration-[var(--ac-duration-normal)]",
  {
    defaultVariants: {
      state: "unfocused",
    },
    variants: {
      state: {
        disabled: "opacity-60 pointer-events-none border-[var(--ac-border-subtle)]",
        focused: "border-[var(--ac-border-focus)] shadow-[var(--ac-shadow-focus)]",
        streamingStop:
          "border-[color-mix(in_oklab,var(--ac-status-running)_35%,var(--ac-border-default))]",
        unfocused: "border-[var(--ac-border-default)]",
      },
    },
  },
);

type CompactComposerProps = VariantProps<typeof composerShellVariants> & {
  actions?: ReactNode;
  className?: string;
  placeholder?: string;
  value?: string;
};

export function CompactComposer({
  actions,
  className,
  placeholder = "Message agent…",
  state,
  value = "",
}: CompactComposerProps) {
  return (
    <div
      className={cn(composerShellVariants({ className, state }), "agent-canvas-ds w-full max-w-md")}
    >
      <textarea
        readOnly
        className="min-h-[calc(var(--ac-space-6)-var(--ac-space-2))] flex-1 resize-none bg-transparent text-[length:var(--ac-font-sm)] text-[var(--ac-text-primary)] outline-none placeholder:text-[var(--ac-text-muted)]"
        placeholder={placeholder}
        value={value}
      />
      {state === "streamingStop" ? (
        <Button aria-label="Stop" size="icon-sm" variant="destructive-outline">
          <SquareIcon aria-hidden className="size-3.5" />
        </Button>
      ) : (
        actions
      )}
    </div>
  );
}
