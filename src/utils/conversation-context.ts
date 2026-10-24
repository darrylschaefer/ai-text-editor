import type { ConfigInterface, MessageInterface, ModelMetadata } from '@type/document';
import type { ContextPolicy, ContextReport } from '@type/context-policy';

export type ContextItem = { role: string; content: string } | { type: 'function_call'; call_id: string; name: string; arguments: string } |
  { type: 'function_call_output'; call_id: string; output: string };
export type TokenCounter = (text: string) => number;
export const AUTOMATIC_INPUT_CAP = 32_000;
export const FALLBACK_CONTEXT_WINDOW = 32_768;

export function parseContextPolicy(value: unknown): ContextPolicy {
  if (value === undefined) return { mode: 'auto' };
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid context policy.');
  const raw = value as Record<string, unknown>;
  if (raw.mode !== 'auto' && raw.mode !== 'custom') throw new Error('Invalid context mode.');
  const result: ContextPolicy = { mode: raw.mode };
  for (const [key, min, max] of [['maxInputTokens', 256, 2_000_000], ['maxRecentTurns', 1, 1000], ['contextWindow', 1024, 2_000_000]] as const) {
    const number = raw[key];
    if (number !== undefined) {
      if (typeof number !== 'number' || !Number.isInteger(number) || number < min || number > max) throw new Error(`Invalid context setting: ${key}.`);
      result[key] = number;
    }
  }
  return result;
}

export function contextLimits(config: Pick<ConfigInterface, 'max_completion_tokens' | 'contextPolicy'>, model?: ModelMetadata) {
  const policy = parseContextPolicy(config.contextPolicy);
  const catalogWindow = typeof model?.context_window === 'number' && Number.isInteger(model.context_window) && model.context_window > 0 ? model.context_window : undefined;
  const customWindow = policy.mode === 'custom' ? policy.contextWindow : undefined;
  const contextWindow = catalogWindow ?? customWindow ?? FALLBACK_CONTEXT_WINDOW;
  const outputReserve = config.max_completion_tokens;
  if (!Number.isInteger(outputReserve) || outputReserve < 16) throw new Error('Choose a valid maximum output token count.');
  const safetyReserve = Math.max(1024, Math.ceil(contextWindow * .05));
  const available = contextWindow - outputReserve - safetyReserve;
  const inputBudget = Math.min(available, policy.mode === 'custom' ? policy.maxInputTokens ?? AUTOMATIC_INPUT_CAP : AUTOMATIC_INPUT_CAP);
  if (inputBudget < 256) throw new Error('The output reserve leaves too little input space. Lower maximum output tokens or correct the context window.');
  return { policy, contextWindow, windowSource: catalogWindow ? 'catalog' as const : customWindow ? 'custom' as const : 'fallback' as const,
    outputReserve, safetyReserve, inputBudget };
}

// Replay complete user turns. Tool calls/results are paired inside each turn;
// incomplete historical records are omitted rather than sending orphan items.
function replayTurn(messages: MessageInterface[]) {
  const calls = new Map(messages.flatMap(message => (message.tool_calls ?? []).map(call => [call.id, call] as const)));
  const callOrder = new Map<string, number>();
  messages.forEach((message, index) => message.tool_calls?.forEach(call => { if (!callOrder.has(call.id)) callOrder.set(call.id, index); }));
  const results = new Map(messages.flatMap((message, index) => message.role === 'tool' && message.tool_call_id ? [[message.tool_call_id, index] as const] : []));
  const paired = new Set([...calls.keys()].filter(id => results.has(id) && results.get(id)! > callOrder.get(id)!));
  const emitted = new Set<string>(), items: ContextItem[] = [];
  let omitted = 0;
  for (const message of messages) {
    if (message.type === 'reasoning') continue;
    if (message.role === 'tool') {
      if (message.tool_call_id && paired.has(message.tool_call_id) && emitted.has(message.tool_call_id) && !emitted.has(`result:${message.tool_call_id}`)) {
        items.push({ type: 'function_call_output', call_id: message.tool_call_id, output: typeof message.content === 'string' ? message.content : JSON.stringify(message.content) });
        emitted.add(`result:${message.tool_call_id}`);
      } else omitted++;
    } else {
      if (message.content) items.push({ role: message.role, content: message.content });
      for (const call of message.tool_calls ?? []) {
        if (!paired.has(call.id)) { omitted++; continue; }
        if (emitted.has(call.id)) continue;
        items.push({ type: 'function_call', call_id: call.id, name: call.function.name, arguments: call.function.arguments });
        emitted.add(call.id);
      }
    }
  }
  return { items, omitted };
}

export function planConversationContext(options: {
  messages: MessageInterface[]; config: Pick<ConfigInterface, 'max_completion_tokens' | 'contextPolicy'>; model?: ModelMetadata;
  instructions?: string; versionContext?: string; tools?: unknown[]; countTokens: TokenCounter;
}) {
  const { messages, countTokens } = options, limits = contextLimits(options.config, options.model);
  const pinned: ContextItem[] = messages.filter(message => message.role === 'system' || message.role === 'developer')
    .map(message => ({ role: message.role, content: message.content }));
  if (options.versionContext) pinned.push({ role: 'system', content: options.versionContext });
  const instructionsTokens = countTokens(options.instructions || '') + (pinned.length ? countTokens(JSON.stringify(pinned)) : 0);
  const toolsTokens = options.tools?.length ? countTokens(JSON.stringify(options.tools)) : 0;
  const fixedTokens = instructionsTokens + toolsTokens + 32;
  const turns: MessageInterface[][] = [];
  for (const message of messages) {
    if (message.role === 'system' || message.role === 'developer' || message.type === 'reasoning') continue;
    if (message.role === 'user') turns.push([]);
    if (turns.length) turns[turns.length - 1].push(message);
  }
  if (!turns.length) throw new Error('Type a message before sending.');
  let historyTokens = 0, includedTurns = 0, omittedToolRecords = 0;
  const retained: ContextItem[][] = [];
  const maxTurns = limits.policy.mode === 'custom' ? limits.policy.maxRecentTurns ?? Infinity : Infinity;
  for (let index = turns.length - 1; index >= 0; index--) {
    const turn = replayTurn(turns[index]), cost = countTokens(JSON.stringify(turn.items));
    if (includedTurns >= maxTurns || fixedTokens + historyTokens + cost > limits.inputBudget) {
      if (!includedTurns) throw new Error('The latest message and required context exceed the input budget. Shorten the message, disable unused tools, or increase the context budget.');
      break;
    }
    retained.unshift(turn.items); historyTokens += cost; includedTurns++; omittedToolRecords += turn.omitted;
  }
  const report: ContextReport = { contextWindow: limits.contextWindow, windowSource: limits.windowSource, inputBudget: limits.inputBudget,
    outputReserve: limits.outputReserve, safetyReserve: limits.safetyReserve, instructionsTokens, toolsTokens, historyTokens,
    estimatedInputTokens: fixedTokens + historyTokens, includedTurns, excludedTurns: turns.length - includedTurns, omittedToolRecords };
  return { input: [...pinned, ...retained.flat()], report };
}

export function assertContinuationBudget(report: ContextReport, retainedTokens: number, input: unknown[], countTokens: TokenCounter) {
  const next = retainedTokens + report.instructionsTokens + report.toolsTokens + countTokens(JSON.stringify(input)) + 32;
  if (next > report.inputBudget) throw new Error('This tool exchange has reached the context budget. Its results are saved. Send a new message to continue with refreshed context, or increase the input budget.');
  return next;
}
