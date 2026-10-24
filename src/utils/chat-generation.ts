// Transport ownership is transient. A stopped request must never regain
// ownership when the next request sets the shared generating flag to true.
export interface ChatGeneration { conversationId: string; controller: AbortController }
let current: ChatGeneration | undefined;

export function beginChatGeneration(conversationId: string): ChatGeneration {
  cancelChatGeneration();
  current = { conversationId, controller: new AbortController() };
  return current;
}

export const ownsChatGeneration = (generation: ChatGeneration) => current === generation;
export const generatingConversationId = () => current?.conversationId;

export function cancelChatGeneration() {
  const stopped = current;
  current = undefined;
  stopped?.controller.abort();
}
