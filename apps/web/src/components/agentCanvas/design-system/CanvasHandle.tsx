import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const canvasHandleVariants = cva(
  "rounded-full border border-[var(--color-background)] transition-[transform,box-shadow] duration-[var(--ac-duration-fast)]",
  {
    defaultVariants: {
      kind: "default",
      position: "source",
    },
    variants: {
      kind: {
        active: "bg-[var(--color-primary)] shadow-[var(--ac-shadow-focus)]",
        default:
          "bg-[color-mix(in_oklab,var(--color-muted-foreground)_55%,var(--color-background))]",
      },
      position: {
        source: "size-2",
        target: "size-2.5",
      },
    },
  },
);

type CanvasHandleProps = VariantProps<typeof canvasHandleVariants> & {
  className?: string;
};

export function CanvasHandle({ className, kind, position }: CanvasHandleProps) {
  return (
    <span
      aria-hidden
      className={cn(
        canvasHandleVariants({ className, kind, position }),
        "agent-canvas-ds inline-block",
      )}
      data-ac-handle={position}
    />
  );
}
