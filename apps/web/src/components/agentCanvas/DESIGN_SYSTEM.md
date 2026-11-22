# Agent Canvas Design System

Dense, calm, terminal-grade UI for multi-agent canvases. Visual references: **Linear** (status hierarchy), **tldraw** (canvas restraint), **Warp** (mono tool rows).

Tokens live in `agentCanvasTokens.css` (scoped to `[data-agent-canvas]` and `.agent-canvas-ds`). Components live under `design-system/`. Browse live specimens at `/canvas-design-system`.

**Rule:** the canvas is a denser native t3 surface — not a parallel theme. Prefer app tokens and `components/ui` primitives; `--ac-*` exists only as a short alias or a proportional scale of an app value.

## Principles

| Principle        | Meaning                                                            |
| ---------------- | ------------------------------------------------------------------ |
| Dense            | 4px spacing scale, compact type, no decorative padding             |
| Calm             | Muted surfaces, semantic color only on status/edges                |
| Terminal-grade   | Mono for paths/commands; tool rows read like a shell transcript    |
| Theme-native     | All colors via `var(--color-*)` mixes — no canvas-specific hex     |
| Appearance-aware | Mono, composer, and code size follow `appearanceFonts.ts` settings |
| LOD-aware        | Three zoom bands drive card variant, not separate products         |

## Level of detail (LOD)

| Zoom        | Variant       | Behavior                                                                                                |
| ----------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| ≥ 0.55      | `interactive` | Full `AgentCard`, live session mount                                                                    |
| 0.40 – 0.55 | `preview`     | `PreviewNode` — header + 2–3 summary lines                                                              |
| < 0.40      | `chip`        | `ChipNode` — title + status + compact attention; **counter-scale** chrome so text stays legible at ~28% |

Default fit uses `minZoom` **0.85** and frames the lead plus its first workers (distant cards may sit off-screen). Fit gutters clear the minimap. Manual zoom-out still reaches chip LOD (~28%); chip screen size is clamped to each node's layout footprint so chips never overlap. Edges keep lead→right / worker→left fan routing at every LOD. Notes become a compact first-line chip below 40% zoom.

**Do** pass `zoom` into `ChipNode` for counter-scale. In the gallery, wrap specimens with `ChipNodeSpecimen` (simulates RF zoom). **Don't** apply raw counter-scale in an unzoomed gallery cell. **Don't** put a full "Needs you" text badge on chips — use `AttentionBadge compact` (icon + tooltip).

## Canvas → app token mapping

### Type & fonts

| Canvas token                  | App source                            | Notes                                |
| ----------------------------- | ------------------------------------- | ------------------------------------ |
| `--ac-font-xs`                | `--text-2xs` (11px / 0.6875rem)       | Floor — no general 10px              |
| `--ac-font-sm`                | `--text-xs` (12px / 0.75rem)          | Meta labels, chip titles             |
| `--ac-font-md`                | `0.8125rem` (13px)                    | Between xs and sm roles              |
| `--ac-font-base`              | `--text-sm` (14px / 0.875rem)         | Body                                 |
| `--ac-font-lg`                | `--text-base` (16px / 1rem)           | Titles                               |
| `--ac-font-mono`              | `--font-mono`                         | From appearance code-font preference |
| `--ac-font-composer`          | `--font-composer` → `--font-sans`     | Same as main composer                |
| `--ac-font-code`              | `calc(var(--font-size-code) * 0.92)`  | Tracks code size setting             |
| `--ac-font-diff`              | `calc(var(--diffs-font-size) * 0.92)` | Tracks diffs size                    |
| `--ac-font-weight-*`          | 400 / 500 / 600                       | Matches chat meta/body/title         |
| `--ac-line-tight/snug/normal` | 1.25 / 1.35 / 1.5                     | Equivalent roles                     |

### Surfaces, borders, text, accent

| Canvas token            | App source / mix           |
| ----------------------- | -------------------------- |
| `--ac-surface-0`        | `--color-background`       |
| `--ac-surface-1`        | `--color-card`             |
| `--ac-surface-2`        | popover/muted mix          |
| `--ac-surface-3`        | muted translucent          |
| `--ac-surface-elevated` | `--color-popover`          |
| `--ac-border-subtle`    | border @ 65%               |
| `--ac-border-default`   | `--color-border`           |
| `--ac-border-strong`    | foreground/border mix      |
| `--ac-border-focus`     | `--color-ring`             |
| `--ac-text-primary`     | `--color-foreground`       |
| `--ac-text-secondary`   | `--color-muted-foreground` |
| `--ac-text-tertiary`    | muted-foreground @ 72%     |
| `--ac-text-muted`       | muted-foreground @ 55%     |
| `--ac-accent`           | `--color-primary`          |

### Radius & spacing

| Canvas token         | App source                                             |
| -------------------- | ------------------------------------------------------ |
| `--ac-radius-sm..xl` | `--radius-sm..xl`                                      |
| `--ac-space-1..6`    | 4 / 8 / 12 / 16 / 24 / 32px (same as Tailwind spacing) |

### Shadows (restrained — match sidebar/popover)

| Canvas token        | App equivalent                          |
| ------------------- | --------------------------------------- |
| `--ac-shadow-0`     | none                                    |
| `--ac-shadow-1`     | `--shadow-composer` / `shadow-composer` |
| `--ac-shadow-2`     | `0 1px 2px / 6%` (≈ `shadow-sm`)        |
| `--ac-shadow-3`     | `0 1px 3px / 8%`                        |
| `--ac-shadow-4`     | light raised (toolbar only)             |
| `--ac-shadow-focus` | ring-colored focus halo                 |

Cards use `shadow-composer`, not multi-layer drops.

### Status / roles / edges

| Canvas token                                 | App source                             |
| -------------------------------------------- | -------------------------------------- |
| `--ac-status-running/done`                   | `--color-success`                      |
| `--ac-status-waiting`                        | `--color-warning`                      |
| `--ac-status-failed`                         | `--color-destructive`                  |
| `--ac-status-*-surface`                      | warning/error/success surfaces         |
| `--ac-role-lead*`                            | `--color-primary` mixes                |
| `--ac-role-worker*`                          | muted                                  |
| `--ac-edge-idle/active/broadcast/dependency` | muted / primary / warning / info mixes |

### Motion

| Canvas token           | App / use         |
| ---------------------- | ----------------- |
| `--ac-duration-fast`   | 120ms hover       |
| `--ac-duration-normal` | 200ms focus       |
| `--ac-duration-stream` | 2s pulse / cursor |
| `--ac-ease-lod`        | `--ease-drawer`   |

## Component → app primitive mapping

| Canvas component          | Prefer / reuse                                |
| ------------------------- | --------------------------------------------- |
| `AttentionBadge`          | `Badge` + `Tooltip` (`compact` = icon-only)   |
| `StatusBadge`             | `Badge` size `sm` + `StatusDot`               |
| `RolePill`                | `Badge` size `sm` with role surface tokens    |
| `ToolbarButton`           | `Button` + `Tooltip`                          |
| `ZoomBadge`               | bordered pill; monospace via `--ac-font-mono` |
| `CompactComposer`         | `.ac-type-composer` → `--font-composer`       |
| `CodeBlock` / tool detail | `.ac-type-mono` + `--ac-font-code`            |
| `AgentCard` shadows       | `shadow-composer`                             |
| Canvas menus/focus        | same `ring-ring` / `focus-visible` as chat    |

**Do** import from `~/components/ui/*` when the control already exists. **Don't** invent a second Badge/Button/Tooltip for canvas-only chrome.

## Component API (summary)

### `AgentCard`

| Prop      | Values                                                                       |
| --------- | ---------------------------------------------------------------------------- |
| `variant` | `interactive` \| `preview` \| `chip`                                         |
| `state`   | `default` \| `focused` \| `selected` \| `failed` \| `attention` \| `running` |
| slots     | `header`, `body`, `footer`                                                   |

### `CardHeader`

`title`, optional `providerLabel`, `statusTone`, `role` + `roleLabel`, `overflow` slot (menus).

### `StatusDot` / `StatusBadge` / `AttentionBadge`

Tones: `running` \| `waiting` \| `failed` \| `done` \| `idle` \| `ready`.  
`AttentionBadge compact` for chip LOD.

### `ToolRow` / `MessageRow` / `CompactComposer` / `CodeBlock`

Mono details and code use `--ac-font-code`. Composer uses `--ac-font-composer`.

### `ChipNode` / `PreviewNode`

LOD presentations; pass `zoom` into `ChipNode`. Chip width ~220×36 screen-space after inverse scale.

### `CanvasEdgeStyles`

`canvasEdgeClassName(kind)`, `canvasEdgeStyle(kind)` — edges render at every LOD including chip.

### Canvas chrome

`CanvasToolbar`, `ToolbarButton`, `AttentionCounter`, `ZoomBadge`, `CanvasFrame`, `CanvasHandle`, empty/loading/error states.

## Gallery

`DesignSystemGallery` renders every variant/state with a light/dark toggle. Route: `_chat.canvas-design-system.tsx`.

## Import

```ts
import { AgentCard, StatusDot } from "~/components/agentCanvas/design-system";
```

Tokens load via `agentCanvas.css` → `@import "./agentCanvasTokens.css"` (also imported in the gallery).
