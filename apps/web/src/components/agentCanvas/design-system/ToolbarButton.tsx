import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

type ToolbarButtonProps = {
  active?: boolean;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  tooltip?: string;
};

export function ToolbarButton({
  active,
  ariaLabel,
  children,
  className,
  disabled,
  onClick,
  tooltip,
}: ToolbarButtonProps) {
  const button = (
    <Button
      aria-label={ariaLabel}
      aria-pressed={active}
      className={cn(
        active && "bg-[var(--ac-surface-3)] ring-1 ring-[var(--ac-border-strong)]",
        className,
      )}
      disabled={disabled}
      onClick={onClick}
      size="icon-sm"
      variant="ghost"
    >
      {children}
    </Button>
  );

  if (!tooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipPopup>{tooltip}</TooltipPopup>
    </Tooltip>
  );
}
