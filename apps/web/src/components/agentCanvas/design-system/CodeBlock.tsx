import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

type CodeBlockProps = {
  children: ReactNode;
  className?: string;
  compact?: boolean;
};

export function CodeBlock({ children, className, compact = true }: CodeBlockProps) {
  return (
    <pre
      className={cn(
        "ac-type-mono overflow-x-auto rounded-[var(--ac-radius-sm)] border border-[var(--ac-border-subtle)] bg-[var(--color-code)] text-[var(--ac-text-primary)]",
        compact ? "px-[var(--ac-space-2)] py-[var(--ac-space-1)]" : "p-[var(--ac-space-3)]",
        className,
      )}
    >
      <code>{children}</code>
    </pre>
  );
}
