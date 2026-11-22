import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "~/lib/utils";

import type { AcCardState, AcCardVariant } from "./acTypes";

const agentCardVariants = cva(
  "agent-canvas-ds flex flex-col overflow-hidden border bg-[var(--ac-surface-1)] transition-[box-shadow,border-color] duration-[var(--ac-duration-fast)] ease-[var(--ac-ease-hover)]",
  {
    compoundVariants: [
      {
        className: "shadow-[var(--ac-shadow-focus)] border-[var(--ac-border-focus)]",
        state: "focused",
        variant: "interactive",
      },
      {
        className: "ring-1 ring-[color-mix(in_oklab,var(--color-primary)_35%,transparent)]",
        state: "selected",
        variant: ["interactive", "preview"],
      },
      {
        className:
          "border-[color-mix(in_oklab,var(--ac-status-failed)_45%,var(--ac-border-default))]",
        state: "failed",
        variant: ["interactive", "preview", "chip"],
      },
      {
        className:
          "border-[color-mix(in_oklab,var(--ac-status-waiting)_50%,var(--ac-border-default))]",
        state: "attention",
        variant: ["interactive", "preview", "chip"],
      },
      {
        className:
          "border-[color-mix(in_oklab,var(--ac-status-running)_40%,var(--ac-border-default))]",
        state: "running",
        variant: ["interactive", "preview", "chip"],
      },
    ],
    defaultVariants: {
      state: "default",
      variant: "interactive",
    },
    variants: {
      state: {
        attention: "",
        default: "",
        failed: "",
        focused: "",
        running: "",
        selected: "",
      } satisfies Record<AcCardState, string>,
      variant: {
        chip: "rounded-[var(--ac-radius-md)] shadow-[var(--ac-shadow-0)]",
        interactive: "rounded-[var(--ac-radius-lg)] shadow-[var(--ac-shadow-2)]",
        preview: "rounded-[var(--ac-radius-lg)] shadow-[var(--ac-shadow-1)]",
      } satisfies Record<AcCardVariant, string>,
    },
  },
);

type AgentCardProps = VariantProps<typeof agentCardVariants> &
  Omit<HTMLAttributes<HTMLElement>, "children"> & {
    body?: ReactNode;
    bodyClassName?: string;
    /** When true, body has no padding (live ChatView). */
    bodyFlush?: boolean;
    footer?: ReactNode;
    footerClassName?: string;
    header?: ReactNode;
    headerClassName?: string;
  };

export function AgentCard({
  body,
  bodyClassName,
  bodyFlush = false,
  className,
  footer,
  footerClassName,
  header,
  headerClassName,
  state,
  variant,
  ...rest
}: AgentCardProps) {
  return (
    <article
      {...rest}
      className={cn(
        agentCardVariants({ state, variant }),
        "border-[var(--ac-border-default)]",
        className,
      )}
    >
      {header ? <div className={cn("shrink-0", headerClassName)}>{header}</div> : null}
      {body ? (
        <div
          className={cn(
            "relative flex min-h-0 flex-1 flex-col",
            !bodyFlush && "overflow-auto px-[var(--ac-space-3)] py-[var(--ac-space-2)]",
            bodyFlush && "overflow-hidden p-0",
            bodyClassName,
          )}
        >
          {body}
        </div>
      ) : null}
      {footer ? (
        <footer
          className={cn(
            "shrink-0 border-t border-[var(--ac-border-subtle)] px-[var(--ac-space-3)] py-[var(--ac-space-2)]",
            footerClassName,
          )}
        >
          {footer}
        </footer>
      ) : null}
    </article>
  );
}
