import { HandIcon, MousePointer2Icon, Redo2Icon, StickyNoteIcon, Undo2Icon } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import "../agentCanvasTokens.css";

import type { AcCardState, AcCardVariant, AcStatusTone, AcStickyColor } from "./acTypes";
import { AgentCard } from "./AgentCard";
import { AttentionBadge } from "./AttentionBadge";
import { CanvasEdgeStylesDemo } from "./gallery/CanvasEdgeStylesDemo";
import { CanvasFrame } from "./CanvasFrame";
import { CanvasToolbar } from "./CanvasToolbar";
import { CardHeader } from "./CardHeader";
import { ChipNodeSpecimen } from "./ChipNode";
import { CodeBlock } from "./CodeBlock";
import { CompactComposer } from "./CompactComposer";
import { DiffStat } from "./DiffStat";
import { MessageRow } from "./MessageRow";
import { PreviewNode } from "./PreviewNode";
import { RolePill } from "./RolePill";
import { StatusBadge } from "./StatusBadge";
import { StatusDot } from "./StatusDot";
import { StickyNoteCard } from "./StickyNoteCard";
import { ToolRow } from "./ToolRow";
import { ToolbarButton } from "./ToolbarButton";
import { TokenReference } from "./gallery/TokenReference";
import { CanvasEmptyState } from "./CanvasEmptyState";
import { CanvasErrorState } from "./CanvasErrorState";
import { CanvasHandle } from "./CanvasHandle";
import { CanvasLoadingState } from "./CanvasLoadingState";
import { ZoomBadge } from "./ZoomBadge";

const STATUS_TONES: AcStatusTone[] = ["running", "waiting", "failed", "done", "idle", "ready"];
const CARD_VARIANTS: AcCardVariant[] = ["interactive", "preview", "chip"];
const CARD_STATES: AcCardState[] = [
  "default",
  "focused",
  "selected",
  "failed",
  "attention",
  "running",
];
const STICKY_COLORS: AcStickyColor[] = ["yellow", "blue", "green", "pink", "neutral"];

function Section(props: { children: ReactNode; title: string }) {
  return (
    <section className="flex flex-col gap-[var(--ac-space-4)]">
      <h2 className="text-lg font-semibold text-foreground">{props.title}</h2>
      {props.children}
    </section>
  );
}

function SubGrid(props: { children: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-[var(--ac-space-2)] overflow-visible">
      <h3 className="text-sm font-medium text-muted-foreground">{props.label}</h3>
      <div className="flex min-w-0 flex-wrap items-start gap-[var(--ac-space-3)] overflow-visible">
        {props.children}
      </div>
    </div>
  );
}

export function DesignSystemGallery() {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );

  const toggleTheme = useCallback(() => {
    document.documentElement.classList.toggle("dark");
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  return (
    <div
      className={cn("agent-canvas-ds min-h-screen bg-background text-foreground")}
      data-agent-canvas
    >
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm sm:gap-4 sm:px-6 sm:py-4">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold sm:text-xl">Agent Canvas Design System</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Dense, calm, terminal-grade canvas chrome.
          </p>
        </div>
        <Button onClick={toggleTheme} size="sm" variant="outline" className="shrink-0">
          {dark ? "Light" : "Dark"} mode
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-10 overflow-visible px-4 py-8 sm:gap-12 sm:px-6 sm:py-10">
        <TokenReference />

        <Section title="Status">
          <SubGrid label="StatusDot">
            {STATUS_TONES.map((tone) => (
              <div key={tone} className="flex items-center gap-2">
                <StatusDot size="md" tone={tone} />
                <span className="text-xs text-muted-foreground">{tone}</span>
              </div>
            ))}
          </SubGrid>
          <SubGrid label="StatusBadge">
            {STATUS_TONES.map((tone) => (
              <StatusBadge key={tone} label={tone} tone={tone} />
            ))}
          </SubGrid>
          <SubGrid label="AttentionBadge">
            <AttentionBadge label="Needs you" variant="needs-you" />
            <AttentionBadge label="Failed" variant="failed" />
            <AttentionBadge label="Resolved" variant="done" />
          </SubGrid>
        </Section>

        <Section title="Roles">
          <SubGrid label="RolePill">
            <RolePill label="Lead" role="lead" />
            <RolePill label="Coordinator" role="coordinator" />
            <RolePill label="Worker" role="worker" />
          </SubGrid>
        </Section>

        <Section title="Agent cards">
          {CARD_VARIANTS.map((variant) => (
            <SubGrid key={variant} label={`AgentCard · ${variant}`}>
              {CARD_STATES.map((state) => (
                <div key={state} className="w-full max-w-72 min-w-0 shrink-0 sm:max-w-80">
                  <AgentCard
                    body={<p className="text-xs text-muted-foreground">Body slot</p>}
                    footer={<DiffStat edits={2} reads={4} tests={1} />}
                    header={
                      <CardHeader
                        providerLabel="claude · haiku"
                        role="lead"
                        roleLabel="Lead"
                        statusTone="running"
                        title={`${state} agent`}
                      />
                    }
                    state={state}
                    variant={variant}
                  />
                </div>
              ))}
            </SubGrid>
          ))}
        </Section>

        <Section title="LOD nodes">
          <SubGrid label="PreviewNode">
            <div className="w-full max-w-72 min-w-0">
              <PreviewNode title="Research thread" />
            </div>
            <div className="w-full max-w-72 min-w-0">
              <PreviewNode
                lines={["Waiting for approval"]}
                statusTone="waiting"
                title="PR review"
              />
            </div>
          </SubGrid>
          <SubGrid label="ChipNode (on-screen at zoom)">
            <ChipNodeSpecimen
              caption="At 28% zoom"
              showAttention
              statusTone="waiting"
              title="UI polish"
              zoom={0.28}
            />
            <ChipNodeSpecimen
              caption="At 35% zoom"
              showAttention
              statusTone="waiting"
              title="Docs pass"
              zoom={0.35}
            />
            <ChipNodeSpecimen
              caption="At 28% zoom · running"
              statusTone="running"
              title="Auth routes"
              zoom={0.28}
            />
          </SubGrid>
        </Section>

        <Section title="Conversation">
          <div className="flex max-w-md flex-col gap-2">
            <MessageRow role="user">Ship the canvas design system gallery.</MessageRow>
            <MessageRow role="assistant" streaming>
              Wiring tokens and components
            </MessageRow>
            <MessageRow role="system">System: 3 agents on canvas</MessageRow>
          </div>
          <CodeBlock>{`export function fitLod(zoom: number) {
  if (zoom >= 0.55) return "interactive";
  if (zoom >= 0.4) return "preview";
  return "chip";
}`}</CodeBlock>
        </Section>

        <Section title="Tools">
          <div className="flex max-w-md flex-col gap-1">
            {(["read", "edit", "test", "terminal", "search"] as const).map((kind) => (
              <ToolRow
                key={kind}
                detail="apps/web/src/components/agentCanvas/AgentCard.tsx"
                expanded={kind === "edit"}
                kind={kind}
                label={`${kind} tool`}
                state={kind === "test" ? "fail" : kind === "terminal" ? "running" : "success"}
              />
            ))}
          </div>
          <DiffStat edits={12} reads={8} tests={3} />
        </Section>

        <Section title="Composer shell">
          <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
            <CompactComposer placeholder="Unfocused" state="unfocused" />
            <CompactComposer placeholder="Focused" state="focused" value="Draft message" />
            <CompactComposer state="streamingStop" value="Streaming…" />
            <CompactComposer placeholder="Disabled" state="disabled" />
          </div>
        </Section>

        <Section title="Canvas chrome">
          <CanvasToolbar attentionCount={2}>
            <ToolbarButton active ariaLabel="Select" tooltip="Select (V)">
              <MousePointer2Icon aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton ariaLabel="Hand" tooltip="Pan (H)">
              <HandIcon aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton ariaLabel="Note" tooltip="Sticky note">
              <StickyNoteIcon aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton ariaLabel="Undo" tooltip="Undo">
              <Undo2Icon aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton ariaLabel="Redo" tooltip="Redo">
              <Redo2Icon aria-hidden className="size-4" />
            </ToolbarButton>
          </CanvasToolbar>
          <div className="flex items-center gap-4">
            <ZoomBadge zoom={0.72} />
            <CanvasHandle kind="default" position="source" />
            <CanvasHandle kind="active" position="target" />
          </div>
          <CanvasEdgeStylesDemo />
          <CanvasFrame label="Frame">
            <PreviewNode title="Grouped agent" />
          </CanvasFrame>
        </Section>

        <Section title="Sticky notes">
          <SubGrid label="Colors">
            {STICKY_COLORS.map((color) => (
              <StickyNoteCard key={color} color={color} title={color}>
                {`Canvas annotation for ${color} workflows.`}
              </StickyNoteCard>
            ))}
          </SubGrid>
        </Section>

        <Section title="States">
          <CanvasLoadingState />
          <CanvasEmptyState action={<Button size="sm">Add agent</Button>} />
          <CanvasErrorState
            action={
              <Button size="sm" variant="outline">
                Retry
              </Button>
            }
          />
        </Section>
      </main>
    </div>
  );
}
