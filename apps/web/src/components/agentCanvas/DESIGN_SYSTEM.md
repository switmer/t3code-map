# Agent Canvas Design System

Dense, calm, terminal-grade UI for multi-agent canvases. Visual references: **Linear** (status hierarchy), **tldraw** (canvas restraint), **Warp** (mono tool rows).

Tokens live in `agentCanvasTokens.css` (scoped to `[data-agent-canvas]` and `.agent-canvas-ds`). Components live under `design-system/`. Browse live specimens at `/canvas-design-system`.

## Principles

| Principle      | Meaning                                                         |
| -------------- | --------------------------------------------------------------- |
| Dense          | 4px spacing scale, compact type, no decorative padding          |
| Calm           | Muted surfaces, semantic color only on status/edges             |
| Terminal-grade | Mono for paths/commands; tool rows read like a shell transcript |
| Theme-native   | All colors via `var(--color-*)` mixes — no canvas-specific hex  |
| LOD-aware      | Three zoom bands drive card variant, not separate products      |

## Level of detail (LOD)

| Zoom        | Variant       | Behavior                                                                                            |
| ----------- | ------------- | --------------------------------------------------------------------------------------------------- |
| ≥ 0.55      | `interactive` | Full `AgentCard`, live session mount                                                                |
| 0.35 – 0.55 | `preview`     | `PreviewNode` — header + 2–3 summary lines                                                          |
| < 0.35      | `chip`        | `ChipNode` — title + status; **counter-scale** title (inverse zoom) so text stays legible at 20–40% |

**Do** pass `zoom` into `ChipNode` for counter-scale. **Don't** shrink font sizes below tokens at chip LOD — scale the inner wrapper instead.

## Token tables

### Spacing

| Token          | Value |
| -------------- | ----- |
| `--ac-space-0` | 0     |
| `--ac-space-1` | 4px   |
| `--ac-space-2` | 8px   |
| `--ac-space-3` | 12px  |
| `--ac-space-4` | 16px  |
| `--ac-space-5` | 24px  |
| `--ac-space-6` | 32px  |

### Radius

| Token            | Maps to            |
| ---------------- | ------------------ |
| `--ac-radius-sm` | `var(--radius-sm)` |
| `--ac-radius-md` | `var(--radius-md)` |
| `--ac-radius-lg` | `var(--radius-lg)` |
| `--ac-radius-xl` | `var(--radius-xl)` |

### Surfaces & text

| Token                   | Role                              |
| ----------------------- | --------------------------------- |
| `--ac-surface-0..3`     | Canvas background → nested panels |
| `--ac-surface-elevated` | Toolbar, composer, popovers       |
| `--ac-text-primary`     | Titles, primary copy              |
| `--ac-text-secondary`   | Metadata, provider labels         |
| `--ac-text-tertiary`    | Preview lines, hints              |
| `--ac-text-muted`       | Placeholders, disabled            |

### Status

| Tone    | Token                 | Use                         |
| ------- | --------------------- | --------------------------- |
| running | `--ac-status-running` | Active turn / tool          |
| waiting | `--ac-status-waiting` | Approval, input, attention  |
| failed  | `--ac-status-failed`  | Run error                   |
| done    | `--ac-status-done`    | Completed run               |
| idle    | `--ac-status-idle`    | Parked / no recent activity |
| ready   | `--ac-status-ready`   | Ready to send               |

### Roles

| Role        | Surface token                   |
| ----------- | ------------------------------- |
| lead        | `--ac-role-lead-surface`        |
| coordinator | `--ac-role-coordinator-surface` |
| worker      | `--ac-role-worker-surface`      |

### Edges

| Kind       | Token                  |
| ---------- | ---------------------- |
| idle       | `--ac-edge-idle`       |
| active     | `--ac-edge-active`     |
| broadcast  | `--ac-edge-broadcast`  |
| dependency | `--ac-edge-dependency` |

### Motion

| Token                          | Typical use                 |
| ------------------------------ | --------------------------- |
| `--ac-duration-fast` (120ms)   | Hover, handle chrome        |
| `--ac-duration-normal` (200ms) | Composer focus ring         |
| `--ac-duration-stream` (1.4s)  | Status pulse, stream cursor |
| `--ac-ease-lod`                | LOD cross-fade (future)     |

### Z-index

`--ac-z-base` → `--ac-z-modal` (1, 5, 8, 12, 20). React Flow node selection uses raised layer inside the flow.

## Component API (summary)

### `AgentCard`

| Prop      | Values                                                                       |
| --------- | ---------------------------------------------------------------------------- |
| `variant` | `interactive` \| `preview` \| `chip`                                         |
| `state`   | `default` \| `focused` \| `selected` \| `failed` \| `attention` \| `running` |
| slots     | `header`, `body`, `footer`                                                   |

**Do** compose with `CardHeader`. **Don't** embed chat logic — shell only.

### `CardHeader`

`title`, optional `providerLabel`, `statusTone`, `role` + `roleLabel`, `overflow` slot (menus).

### `StatusDot` / `StatusBadge`

Tones: `running` \| `waiting` \| `failed` \| `done` \| `idle` \| `ready`.

**Do** use `StatusDot` in headers. **Don't** use raw Tailwind color utilities for status.

### `ToolRow`

`kind`: `read` \| `edit` \| `test` \| `terminal` \| `search`. `expanded`, `state`: `running` \| `success` \| `fail`.

### `MessageRow`

`role`: `user` \| `assistant` \| `system`. `streaming` adds cursor affordance.

### `CompactComposer`

Gallery shell only: `state`: `unfocused` \| `focused` \| `disabled` \| `streamingStop`.

### `ChipNode` / `PreviewNode`

LOD presentations; accept `title`, `statusTone`, optional `zoom` (chip).

### `CanvasEdgeStyles`

`canvasEdgeClassName(kind)`, `canvasEdgeStyle(kind)` for SVG stroke styles.

### Canvas chrome

`CanvasToolbar`, `ToolbarButton`, `AttentionCounter`, `ZoomBadge`, `CanvasFrame`, `CanvasHandle`, empty/loading/error states.

## Gallery

`DesignSystemGallery` renders every variant/state with a light/dark toggle. Route: `_chat.canvas-design-system.tsx`.

## Import

```ts
import { AgentCard, StatusDot } from "~/components/agentCanvas/design-system";
```

Tokens load via `agentCanvas.css` → `@import "./agentCanvasTokens.css"` (also imported in the gallery).
