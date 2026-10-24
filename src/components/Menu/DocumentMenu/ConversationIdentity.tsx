import { Tools } from '@carbon/icons-react';
import type { ChatConversation } from '@store/chat-slice';
import useStore from '@store/store';
import { getEnabledToolDefinitions } from '@api/tools';
import './conversation-identity.css';

export function ConversationToolsCount({ conversation }: { conversation?: ChatConversation | null }) {
  const generating = useStore(state => state.generating);
  const legacyTools = useStore(state => state.enabledTools);
  const selected = conversation?.type === 'agent' ? conversation.agentProfile?.enabledTools ?? legacyTools : [];
  const count = getEnabledToolDefinitions([...new Set(selected)]).length;
  return <button type="button" className="conversation-tools-count" aria-haspopup="dialog" disabled={generating || !conversation}
    onClick={() => window.dispatchEvent(new CustomEvent('fthr-open-model-settings', { detail: 'tools' }))}
    aria-label={`${count} document tools enabled`} title="Document tools">
    <Tools size={14} aria-hidden="true" /><span className="conversation-tools-number">{count}</span>
  </button>;
}
