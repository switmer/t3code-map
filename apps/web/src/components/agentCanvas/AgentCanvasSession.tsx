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
import { PersistentThreadTerminalDrawer } from "../PersistentThreadTerminals";

/**
 * Live agent session inside a canvas node: the same ChatView used for side chats, plus the
 * thread's terminal drawer when it is open. Tool diffs open on this thread's own panel store.
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
      className="flex h-full min-h-0 flex-col overflow-hidden bg-background"
      data-agent-canvas-session={scopedThreadKey(threadRef)}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
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
      </div>
      {terminalOpen ? (
        <div className="h-40 shrink-0 border-t border-border">
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
