import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";

import { ComposerHandleContext } from "../../composerHandleContext";
import type { ToolCallDiffTarget } from "../../diffPanelStore";
import { useDiffPanelStore } from "../../diffPanelStore";
import type { SideChatParentPanel } from "../../lib/sideChatPane";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { selectThreadTerminalUiState, useTerminalUiStateStore } from "../../terminalUiStateStore";
import ChatView from "../ChatView";
import { BackgroundThreadContext } from "../chat/backgroundThread";
import { ChatDensityProvider } from "../chat/chatDensity";
import { PersistentThreadTerminalDrawer } from "../PersistentThreadTerminals";

/**
 * Canvas ChatView mount: compact density + pinned composer; `active` owns shortcuts.
 *
 * Compact timelines skip LegendList and bottom-anchor via content marginTop slack.
 * Do not pad the scroll node from here — that used to fight virtualizer measure and
 * blank the focused (lead) pane.
 */
export function AgentCanvasSession(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly active: boolean;
}) {
  const threadRef = scopeThreadRef(props.environmentId, props.threadId);
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

  return (
    <div
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
