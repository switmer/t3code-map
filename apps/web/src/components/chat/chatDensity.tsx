import { createContext, use } from "react";

export type ChatDensity = "default" | "compact";

const ChatDensityContext = createContext<ChatDensity>("default");

/** Presentation density for ChatView (full-page vs canvas/embedded panes). */
export function ChatDensityProvider(props: {
  readonly value: ChatDensity;
  readonly children: React.ReactNode;
}) {
  return <ChatDensityContext value={props.value}>{props.children}</ChatDensityContext>;
}

export function useChatDensity(): ChatDensity {
  return use(ChatDensityContext);
}
