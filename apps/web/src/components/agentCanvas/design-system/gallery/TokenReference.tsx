import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

const SPACES = [0, 1, 2, 3, 4, 5, 6] as const;
const RADII = ["sm", "md", "lg", "xl"] as const;
const TYPE_SIZES = [
  { key: "xs", var: "--ac-font-xs" },
  { key: "sm", var: "--ac-font-sm" },
  { key: "md", var: "--ac-font-md" },
  { key: "base", var: "--ac-font-base" },
  { key: "lg", var: "--ac-font-lg" },
] as const;

const SURFACE_SWATCHES = [
  { label: "Surface 0", var: "--ac-surface-0" },
  { label: "Surface 1", var: "--ac-surface-1" },
  { label: "Surface 2", var: "--ac-surface-2" },
  { label: "Elevated", var: "--ac-surface-elevated" },
] as const;

const STATUS_SWATCHES = [
  { label: "Running", var: "--ac-status-running" },
  { label: "Waiting", var: "--ac-status-waiting" },
  { label: "Failed", var: "--ac-status-failed" },
  { label: "Done", var: "--ac-status-done" },
  { label: "Idle", var: "--ac-status-idle" },
  { label: "Ready", var: "--ac-status-ready" },
] as const;

export function TokenReference() {
  return (
    <section className="flex flex-col gap-[var(--ac-space-5)] rounded-[var(--ac-radius-xl)] border border-[var(--ac-border-default)] bg-[var(--ac-surface-1)] p-[var(--ac-space-5)]">
      <h2 className="text-lg font-semibold">Tokens</h2>

      <div className="grid gap-[var(--ac-space-5)] md:grid-cols-2">
        <TokenBlock title="Surfaces">
          <div className="flex flex-wrap gap-2">
            {SURFACE_SWATCHES.map((item) => (
              <Swatch key={item.var} label={item.label} token={item.var} />
            ))}
          </div>
        </TokenBlock>

        <TokenBlock title="Status">
          <div className="flex flex-wrap gap-2">
            {STATUS_SWATCHES.map((item) => (
              <Swatch key={item.var} label={item.label} token={item.var} />
            ))}
          </div>
        </TokenBlock>

        <TokenBlock title="Spacing">
          <div className="flex flex-wrap items-end gap-3">
            {SPACES.map((n) => (
              <div key={n} className="flex flex-col items-center gap-1">
                <div
                  className="rounded-sm bg-[var(--ac-accent-muted)]"
                  style={{
                    height: `var(--ac-space-${n})`,
                    width: `var(--ac-space-${n})`,
                  }}
                />
                <span className="text-[length:var(--ac-font-xs)] text-muted-foreground">
                  {n} · var(--ac-space-{n})
                </span>
              </div>
            ))}
          </div>
        </TokenBlock>

        <TokenBlock title="Radii">
          <div className="flex flex-wrap gap-3">
            {RADII.map((r) => (
              <div
                key={r}
                className="size-12 border-2 border-[var(--ac-border-strong)] bg-[var(--ac-surface-2)]"
                style={{ borderRadius: `var(--ac-radius-${r})` }}
                title={`--ac-radius-${r}`}
              />
            ))}
          </div>
        </TokenBlock>

        <TokenBlock title="Type ramp">
          <div className="flex flex-col gap-2">
            {TYPE_SIZES.map((item) => (
              <p
                key={item.key}
                style={{ fontSize: `var(${item.var})`, lineHeight: "var(--ac-line-snug)" }}
              >
                {item.key} — The quick brown fox
              </p>
            ))}
            <p className="ac-type-mono">Mono — git status && vp check</p>
          </div>
        </TokenBlock>

        <TokenBlock title="Shadows">
          <div className="flex flex-wrap gap-4">
            {([0, 1, 2, 3, 4] as const).map((level) => (
              <div
                key={level}
                className="flex size-16 items-center justify-center rounded-[var(--ac-radius-md)] bg-[var(--ac-surface-1)] text-[length:var(--ac-font-xs)] text-muted-foreground"
                style={{ boxShadow: `var(--ac-shadow-${level})` }}
              >
                {level}
              </div>
            ))}
          </div>
        </TokenBlock>

        <TokenBlock className="md:col-span-2" title="Motion">
          <div className="flex flex-wrap gap-6">
            <MotionDemo duration="var(--ac-duration-fast)" label="Hover" />
            <MotionDemo duration="var(--ac-duration-stream)" eased label="Streaming pulse" />
          </div>
        </TokenBlock>
      </div>
    </section>
  );
}

function TokenBlock(props: { children: ReactNode; className?: string; title: string }) {
  return (
    <div className={cn("flex flex-col gap-[var(--ac-space-2)]", props.className)}>
      <h3 className="text-sm font-medium text-muted-foreground">{props.title}</h3>
      {props.children}
    </div>
  );
}

function Swatch(props: { label: string; token: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="size-10 rounded-[var(--ac-radius-sm)] border border-[var(--ac-border-subtle)]"
        style={{ background: `var(${props.token})` }}
      />
      <span className="max-w-16 text-center text-[length:var(--ac-font-xs)] text-muted-foreground">
        {props.label}
      </span>
    </div>
  );
}

function MotionDemo(props: { duration: string; eased?: boolean; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">{props.label}</span>
      <div
        className={cn(
          "size-8 rounded-full bg-[var(--ac-accent)]",
          props.eased && "ac-status-pulse",
        )}
        style={{
          transition: props.eased
            ? undefined
            : `transform ${props.duration} var(--ac-ease-hover), opacity ${props.duration} var(--ac-ease-hover)`,
        }}
      />
    </div>
  );
}
