import { CrownIcon, UsersIcon, WaypointsIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

import type { AcRole } from "./acTypes";

const ROLE_ICONS: Record<Exclude<AcRole, "none">, typeof CrownIcon> = {
  coordinator: WaypointsIcon,
  lead: CrownIcon,
  worker: UsersIcon,
};

const roleClassName: Record<Exclude<AcRole, "none">, string> = {
  coordinator:
    "bg-[var(--ac-role-coordinator-surface)] text-[color-mix(in_oklab,var(--ac-role-coordinator)_70%,var(--color-foreground))]",
  lead: "bg-[var(--ac-role-lead-surface)] text-[var(--ac-role-lead)]",
  worker: "bg-[var(--ac-role-worker-surface)] text-[var(--ac-role-worker)]",
};

type RolePillProps = {
  className?: string;
  label?: string;
  icon?: ReactNode;
  role?: AcRole | null;
};

/** Role chip on the shared `Badge` shell (same height/radius as chat badges). */
export function RolePill({ className, icon, label, role }: RolePillProps) {
  if (role !== "lead" && role !== "coordinator" && role !== "worker") return null;
  const Icon = ROLE_ICONS[role];
  return (
    <Badge
      size="sm"
      variant="label"
      className={cn(
        "gap-0.5 border-transparent text-[length:var(--ac-font-xs)] leading-none",
        roleClassName[role],
        className,
      )}
    >
      {icon ?? <Icon aria-hidden className="size-2.5 opacity-80" />}
      {label ? <span className="leading-none">{label}</span> : null}
    </Badge>
  );
}
