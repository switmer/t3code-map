import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import type { AcRole, AcStatusTone } from "./acTypes";
import { RolePill } from "./RolePill";
import { StatusDot } from "./StatusDot";

type CardHeaderProps = {
  className?: string;
  overflow?: ReactNode;
  providerLabel?: string;
  role?: AcRole;
  roleLabel?: string;
  statusTone?: AcStatusTone;
  title: string;
};

export function CardHeader({
  className,
  overflow,
  providerLabel,
  role = "none",
  roleLabel,
  statusTone = "idle",
  title,
}: CardHeaderProps) {
  return (
    <header
      className={cn(
        "flex min-h-[calc(var(--ac-space-4)+var(--ac-space-1))] items-center gap-[var(--ac-space-2)] border-b border-[var(--ac-border-subtle)] px-[var(--ac-space-3)] py-[var(--ac-space-2)]",
        className,
      )}
    >
      <StatusDot tone={statusTone} />
      <div className="min-w-0 flex-1">
        <div
          className="truncate font-medium text-[length:var(--ac-font-sm)] text-[var(--ac-text-primary)]"
          style={{ lineHeight: "var(--ac-line-tight)" }}
        >
          {title}
        </div>
        {providerLabel ? (
          <div
            className="truncate text-[length:var(--ac-font-xs)] text-[var(--ac-text-tertiary)]"
            style={{ lineHeight: "var(--ac-line-snug)" }}
          >
            {providerLabel}
          </div>
        ) : null}
      </div>
      <RolePill role={role} {...(roleLabel !== undefined ? { label: roleLabel } : {})} />
      {overflow ? (
        <div className="flex shrink-0 items-center gap-[var(--ac-space-1)]">{overflow}</div>
      ) : null}
    </header>
  );
}
