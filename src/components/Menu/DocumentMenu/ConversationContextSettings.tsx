import { useContext } from 'react';
import useStore from '@store/store';
import { useConnections } from '@store/connection-store';
import type { ChatConversation } from '@store/chat-slice';
import type { ConfigInterface } from '@type/document';
import type { ContextPolicy } from '@type/context-policy';
import { contextLimits } from '@utils/conversation-context';
import { prepareConversationContext } from '@utils/conversation-request';
import { ConversationDraftContext } from '@components/Workspace/ConversationDraftContext';

export default function ConversationContextSettings({ conversation, config, instructions, enabledTools, onChange }: {
  conversation: ChatConversation; config: ConfigInterface; instructions: string; enabledTools: string[]; onChange: (policy: ContextPolicy) => void;
}) {
  const draft = useContext(ConversationDraftContext)?.draft;
  const message = draft?.conversationId === conversation.id ? draft.content : '';
  useStore(state => state.chats?.[state.currentChatIndex]);
  const connections = useConnections(state => state.connections), active = useConnections(state => state.activeConnectionId);
  const model = connections.find(item => item.id === (config.connectionId ?? active))?.models.find(item => item.id === config.model);
  const policy = config.contextPolicy ?? { mode: 'auto' };
  let plan: ReturnType<typeof prepareConversationContext> | undefined, limits: ReturnType<typeof contextLimits> | undefined, error = '';
  try { limits = contextLimits(config, model); plan = prepareConversationContext(conversation, config, instructions, enabledTools, message); }
  catch (reason) { error = (reason as Error).message; }
  const update = (key: 'maxInputTokens' | 'maxRecentTurns' | 'contextWindow', value: string) => onChange({ ...policy, mode: 'custom', [key]: value === '' ? undefined : Number(value) });
  const format = (number: number) => number.toLocaleString();
  return <>
    <label>Context management<select aria-label="Context management" value={policy.mode} onChange={event => onChange({ ...policy, mode: event.target.value as ContextPolicy['mode'] })}>
      <option value="auto">Automatic</option><option value="custom">Custom limits</option>
    </select></label>
    <p className="conversation-model-settings-help">Keeps complete recent turns. Instructions and the latest message stay included.</p>
    {limits && <dl className="conversation-context-summary">
      <div><dt>Estimated input</dt><dd>{plan ? format(plan.report.estimatedInputTokens) : '—'} / {format(limits.inputBudget)}</dd></div>
      {plan && <><div><dt>Instructions & version</dt><dd>{format(plan.report.instructionsTokens)}</dd></div><div><dt>Tool definitions</dt><dd>{format(plan.report.toolsTokens)}</dd></div>
        <div><dt>Conversation</dt><dd>{format(plan.report.historyTokens)}</dd></div>
        <div><dt>Earlier turns</dt><dd>{Math.max(0, plan.report.includedTurns - 1)} kept · {plan.report.excludedTurns} excluded</dd></div></>}
      <div><dt>Output reserved</dt><dd>{format(limits.outputReserve)}</dd></div>
    </dl>}
    <p className="conversation-model-settings-help">{limits?.windowSource === 'catalog' ? `Catalog context window: ${format(limits.contextWindow)} tokens.` : limits?.windowSource === 'custom' ? `Custom context window: ${format(limits.contextWindow)} tokens.` : 'Context window unavailable; using a conservative 32,768-token fallback.'} Counts are local estimates. Recalculated at send.</p>
    <details className="conversation-context-advanced" open={policy.mode === 'custom'}><summary>Advanced limits</summary>
      <label>Input token cap<input aria-label="Input token cap" type="number" min={256} max={2_000_000} step={1} placeholder="32,000 automatically" value={policy.maxInputTokens ?? ''} onChange={event => update('maxInputTokens', event.target.value)} /></label>
      <label>Recent turns to keep<input aria-label="Recent turns to keep" type="number" min={1} max={1000} step={1} placeholder="As many as fit" value={policy.maxRecentTurns ?? ''} onChange={event => update('maxRecentTurns', event.target.value)} /></label>
      <p className="conversation-model-settings-help">Includes your current message. Input caps include instructions and tools; output and safety space are reserved separately.</p>
      {!model?.context_window && <label>Known model context window<input aria-label="Known model context window" type="number" min={1024} max={2_000_000} step={1} placeholder="32,768 fallback" value={policy.contextWindow ?? ''} onChange={event => update('contextWindow', event.target.value)} /></label>}
    </details>
    {error && <p role="alert" className="conversation-settings-error">{error}</p>}
    {plan && <details className="conversation-context-preview"><summary>Included messages ({plan.input.length})</summary>
      <p className="conversation-model-settings-help">Includes the current composer draft. System prompt and tool definitions are counted separately.</p>
      <ol>{plan.input.map((item, index) => <li key={index}><details><summary>{'role' in item ? item.role : item.type === 'function_call' ? `Tool call · ${item.name}` : 'Tool result'}</summary>
        <pre>{'content' in item ? item.content : 'arguments' in item ? item.arguments : item.output}</pre></details></li>)}</ol>
    </details>}
    {!!plan?.report.omittedToolRecords && <p className="conversation-model-settings-help">Incomplete historical tool records were excluded.</p>}
  </>;
}
