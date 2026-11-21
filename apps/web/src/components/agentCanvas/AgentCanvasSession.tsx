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

/** Canvas ChatView mount: flex column pins the absolute composer; `active` owns shortcuts. */
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
      data-side-chat-pane={props.threadId}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
      {terminalOpen && props.active ? (
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
