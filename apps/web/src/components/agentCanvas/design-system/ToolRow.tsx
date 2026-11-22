import { cva, type VariantProps } from "class-variance-authority";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileSearchIcon,
  FlaskConicalIcon,
  PencilIcon,
  SquareTerminalIcon,
} from "lucide-react";

import { cn } from "~/lib/utils";

import type { AcToolKind, AcToolRowState } from "./acTypes";
import { StatusDot } from "./StatusDot";

const toolRowVariants = cva(
  "flex w-full items-start gap-[var(--ac-space-2)] rounded-[var(--ac-radius-sm)] border border-transparent px-[var(--ac-space-2)] text-left transition-colors duration-[var(--ac-duration-fast)]",
  {
    defaultVariants: {
      expanded: false,
      state: "success",
    },
    variants: {
      expanded: {
        false: "py-[var(--ac-space-1)]",
        true: "py-[var(--ac-space-2)] bg-[var(--ac-surface-3)] border-[var(--ac-border-subtle)]",
      },
      state: {
        fail: "text-[var(--ac-status-failed)]",
        running: "text-[var(--ac-text-primary)]",
        success: "text-[var(--ac-text-secondary)]",
      } satisfies Record<AcToolRowState, string>,
    },
  },
);

const TOOL_ICONS: Record<AcToolKind, typeof PencilIcon> = {
  edit: PencilIcon,
  read: FileSearchIcon,
  search: FileSearchIcon,
  terminal: SquareTerminalIcon,
  test: FlaskConicalIcon,
};

const STATE_TONE: Record<AcToolRowState, "running" | "failed" | "done"> = {
  fail: "failed",
  running: "running",
  success: "done",
};

type ToolRowProps = VariantProps<typeof toolRowVariants> & {
  className?: string;
  detail?: string;
  expanded?: boolean;
  kind: AcToolKind;
  label: string;
  onToggle?: () => void;
  state?: AcToolRowState;
};

export function ToolRow({
  className,
  detail,
  expanded = false,
  kind,
  label,
  onToggle,
  state = "success",
}: ToolRowProps) {
  const Icon = TOOL_ICONS[kind];
  const Chevron = expanded ? ChevronDownIcon : ChevronRightIcon;
  const tone = STATE_TONE[state];
  const interactive = onToggle !== undefined;

  return (
    <div className={cn(toolRowVariants({ className, expanded, state }))}>
      {interactive ? (
        <button
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-start gap-[var(--ac-space-2)]"
          onClick={onToggle}
          type="button"
        >
          <Chevron aria-hidden className="mt-[var(--ac-space-1)] size-3 shrink-0 opacity-70" />
          <Icon aria-hidden className="mt-[var(--ac-space-1)] size-3.5 shrink-0 opacity-80" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-[var(--ac-space-2)]">
              <span className="truncate text-[length:var(--ac-font-sm)] font-medium">{label}</span>
              <StatusDot size="sm" tone={tone} />
            </div>
            {expanded && detail ? (
              <p className="mt-[var(--ac-space-1)] text-[length:var(--ac-font-xs)] text-[var(--ac-text-tertiary)] ac-type-mono">
                {detail}
              </p>
            ) : null}
          </div>
        </button>
      ) : (
        <>
          <Icon aria-hidden className="mt-[var(--ac-space-1)] size-3.5 shrink-0 opacity-80" />
          <div className="min-w-0 flex-1">
            <ToolRowLabel label={label} state={state} tone={tone} />
            {expanded && detail ? (
              <p className="mt-[var(--ac-space-1)] text-[length:var(--ac-font-xs)] text-[var(--ac-text-tertiary)] ac-type-mono">
                {detail}
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function ToolRowLabel(props: {
  label: string;
  state: AcToolRowState;
  tone: "running" | "failed" | "done";
}) {
  return (
    <div className="flex items-center gap-[var(--ac-space-2)]">
      <span className="truncate text-[length:var(--ac-font-sm)] font-medium">{props.label}</span>
      <StatusDot size="sm" tone={props.tone} />
    </div>
  );
}
