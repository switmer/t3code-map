import { cva, type VariantProps } from "class-variance-authority";
import { CrownIcon, UsersIcon, WaypointsIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import type { AcRole } from "./acTypes";

const rolePillVariants = cva(
  "inline-flex h-4 shrink-0 items-center gap-[var(--ac-space-1)] rounded-[var(--ac-radius-sm)] px-[var(--ac-space-1)] font-medium tracking-tight",
  {
    defaultVariants: {
      role: "none",
    },
    variants: {
      role: {
        coordinator:
          "bg-[var(--ac-role-coordinator-surface)] text-[color-mix(in_oklab,var(--ac-role-coordinator)_70%,var(--color-foreground))]",
        lead: "bg-[var(--ac-role-lead-surface)] text-[var(--ac-role-lead)]",
        none: "hidden",
        worker: "bg-[var(--ac-role-worker-surface)] text-[var(--ac-role-worker)]",
      } satisfies Record<AcRole, string>,
    },
  },
);

const ROLE_ICONS: Record<Exclude<AcRole, "none">, typeof CrownIcon> = {
  coordinator: WaypointsIcon,
  lead: CrownIcon,
  worker: UsersIcon,
};

type RolePillProps = VariantProps<typeof rolePillVariants> & {
  className?: string;
  label?: string;
  icon?: ReactNode;
};

export function RolePill({ className, icon, label, role }: RolePillProps) {
  if (role !== "lead" && role !== "coordinator" && role !== "worker") return null;
  const Icon = ROLE_ICONS[role];
  return (
    <span className={cn(rolePillVariants({ className, role }), "text-[length:var(--ac-font-xs)]")}>
      {icon ?? <Icon aria-hidden className="size-2.5 opacity-80" />}
      {label}
    </span>
  );
}
