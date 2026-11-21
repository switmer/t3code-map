import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { useEffect, useRef } from "react";

import { ComposerHandleContext } from "../../composerHandleContext";
import type { ToolCallDiffTarget } from "../../diffPanelStore";
import { useDiffPanelStore } from "../../diffPanelStore";
import { observeResize } from "../../lib/observeResize";
import type { SideChatParentPanel } from "../../lib/sideChatPane";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { selectThreadTerminalUiState, useTerminalUiStateStore } from "../../terminalUiStateStore";
import ChatView from "../ChatView";
import { BackgroundThreadContext } from "../chat/backgroundThread";
import { ChatDensityProvider } from "../chat/chatDensity";
import { PersistentThreadTerminalDrawer } from "../PersistentThreadTerminals";

/** Pad short threads so history sits on the composer; scroll long threads to the end. */
function pinTimelineToComposer(root: HTMLElement) {
  const scroll = root.querySelector<HTMLElement>(".messages-timeline-scroll");
  if (!scroll) return;
  scroll.style.paddingTop = "0px";
  const slack = Math.max(0, scroll.clientHeight - scroll.scrollHeight);
  if (slack > 0) {
    scroll.style.paddingTop = `${slack}px`;
  }
  scroll.scrollTop = scroll.scrollHeight;
}

/** Canvas ChatView mount: compact density + pinned composer; `active` owns shortcuts. */
export function AgentCanvasSession(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly active: boolean;
}) {
  const threadRef = scopeThreadRef(props.environmentId, props.threadId);
  const rootRef = useRef<HTMLDivElement>(null);
  const terminalOpen = useTerminalUiStateStore(
    (state) =>
      selectThreadTerminalUiState(state.terminalUiStateByThreadKey, threadRef).terminalOpen,
  );
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const parentPanel: SideChatParentPanel = {
    hostRef: threadRef,
    openToolDiff: (target: ToolCallDiffTarget) => {
      useDiffPanelStore.getState().selectToolCall(threadRef, target);
    },
    runShellCommand: () => {
      useTerminalUiStateStore.getState().setTerminalOpen(threadRef, true);
    },
  };

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- pins the timeline scroll DOM to the composer while the session is mounted
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let stopScroll: (() => void) | undefined;
    let raf = 0;
    const run = () => {
      pinTimelineToComposer(root);
      const scroll = root.querySelector<HTMLElement>(".messages-timeline-scroll");
      if (scroll && stopScroll === undefined) {
        stopScroll = observeResize(scroll, run);
      }
    };
    const schedule = () => {
      if (raf !== 0) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        run();
      });
    };
    run();
    const timers = [80, 250, 600, 1200].map((ms) => window.setTimeout(run, ms));
    const mo = new MutationObserver(schedule);
    mo.observe(root, { childList: true, subtree: true });
    const stopRoot = observeResize(root, run);
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      if (raf !== 0) window.cancelAnimationFrame(raf);
      mo.disconnect();
      stopScroll?.();
      stopRoot();
    };
  }, [
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- thread switch remounts observers; resize handles size changes
    props.threadId,
  ]);

  return (
    <div
      ref={rootRef}
      className="nodrag nowheel nopan flex h-full min-h-0 flex-col overflow-hidden bg-background"
      data-agent-canvas-session={scopedThreadKey(threadRef)}
      data-agent-canvas-session-active={props.active ? "true" : "false"}
      data-chat-density="compact"
      data-side-chat-pane={props.threadId}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatDensityProvider value="compact">
          <BackgroundThreadContext value={!props.active}>
            <ComposerHandleContext value={null}>
              <ChatView
                environmentId={props.environmentId}
                threadId={props.threadId}
                routeKind="server"
                embedded={parentPanel}
              />
            </ComposerHandleContext>
          </BackgroundThreadContext>
        </ChatDensityProvider>
      </div>
      {terminalOpen && props.active ? (
        <div className="h-32 shrink-0 border-t border-border">
          <PersistentThreadTerminalDrawer
            threadRef={threadRef}
            threadId={props.threadId}
            active={props.active}
            composerHeight={0}
            launchContext={null}
            splitShortcutLabel={undefined}
            splitVerticalShortcutLabel={undefined}
            newShortcutLabel={undefined}
            closeShortcutLabel={undefined}
            keybindings={keybindings}
            onAddTerminalContext={() => {}}
          />
        </div>
      ) : null}
    </div>
  );
}
