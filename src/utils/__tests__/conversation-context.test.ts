import { describe, expect, it } from 'vitest';
import { assertContinuationBudget, contextLimits, parseContextPolicy, planConversationContext } from '../conversation-context';
import type { MessageInterface } from '@type/document';

const countTokens = (text: string) => Math.ceil(text.length / 4);
const config = { max_completion_tokens: 1200 };
const plan = (messages: MessageInterface[], extra: Partial<Parameters<typeof planConversationContext>[0]> = {}) => planConversationContext({ messages, config, countTokens, ...extra });

describe('conversation context planning', () => {
  it('reserves output and safety independently, using catalog limits first', () => {
    const limits = contextLimits({ max_completion_tokens: 1000, contextPolicy: { mode: 'custom', maxInputTokens: 8000, contextWindow: 9000 } }, { id: 'catalog-model', context_window: 4096 });
    expect(limits).toMatchObject({ contextWindow: 4096, windowSource: 'catalog', inputBudget: 2072, outputReserve: 1000, safetyReserve: 1024 });
    expect(contextLimits(config).windowSource).toBe('fallback');
    expect(contextLimits({ ...config, contextPolicy: { mode: 'custom', contextWindow: 64_000 } }).contextWindow).toBe(64_000);
  });
  it('keeps instructions first and a contiguous suffix of whole turns without changing saved history', () => {
    const messages: MessageInterface[] = [{ role: 'system', content: 'Keep the author’s voice.' }, { role: 'user', content: 'Old '.repeat(300) },
      { role: 'assistant', content: 'Old response.' }, { role: 'user', content: 'Revise this sentence.' }];
    const before = structuredClone(messages);
    const result = plan(messages, { instructions: 'Only edit prose.', tools: [{ name: 'doc_read' }], config: { ...config, contextPolicy: { mode: 'custom', maxInputTokens: 256 } } });
    expect(result.input).toEqual([messages[0], messages[3]]);
    expect(result.report).toMatchObject({ includedTurns: 1, excludedTurns: 1 });
    expect(result.report.estimatedInputTokens).toBeLessThanOrEqual(result.report.inputBudget); expect(messages).toEqual(before);
  });
  it('never drops or truncates the latest request or required instructions to fit', () => {
    const options = { config: { ...config, contextPolicy: { mode: 'custom' as const, maxInputTokens: 256 } } };
    expect(() => plan([{ role: 'user', content: 'x'.repeat(2000) }], options)).toThrow('latest message');
    expect(() => plan([{ role: 'developer', content: 'x'.repeat(2000) }, { role: 'user', content: 'Short request' }], options)).toThrow('required context');
    expect(() => contextLimits({ max_completion_tokens: 40_000 })).toThrow('output reserve');
  });
  it('counts instructions, version context, tool schemas, and conversation records', () => {
    const result = plan([{ role: 'user', content: 'Test' }], { instructions: 'Be clear.', versionContext: 'Use v2.', tools: [{ type: 'function', name: 'read', parameters: { type: 'object' } }] });
    expect(result.input[0]).toEqual({ role: 'system', content: 'Use v2.' });
    expect(result.report.instructionsTokens).toBeGreaterThan(0); expect(result.report.toolsTokens).toBeGreaterThan(0);
    expect(result.report.estimatedInputTokens).toBe(result.report.instructionsTokens + result.report.toolsTokens + result.report.historyTokens + 32);
  });
  it('keeps tool calls paired with results and excludes reasoning display records', () => {
    const result = plan([{ role: 'user', content: 'Read this.' }, { role: 'assistant', content: '', tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'doc_read', arguments: '{}' } }] },
      { role: 'tool', content: 'Passage text', tool_call_id: 'call-1' }, { role: 'assistant', type: 'reasoning', content: 'Internal display record' },
      { role: 'assistant', content: 'A revised passage.' }, { role: 'user', content: 'Make it shorter.' }]);
    expect(result.input).toEqual([{ role: 'user', content: 'Read this.' }, { type: 'function_call', call_id: 'call-1', name: 'doc_read', arguments: '{}' },
      { type: 'function_call_output', call_id: 'call-1', output: 'Passage text' }, { role: 'assistant', content: 'A revised passage.' }, { role: 'user', content: 'Make it shorter.' }]);
  });
  it('omits incomplete historical records instead of sending orphan tool outputs', () => {
    const result = plan([{ role: 'user', content: 'Read.' }, { role: 'assistant', content: '', tool_calls: [{ id: 'missing', type: 'function', function: { name: 'doc_read', arguments: '{}' } }] },
      { role: 'tool', content: 'Orphan result', tool_call_id: 'other-call' }, { role: 'user', content: 'Continue.' }]);
    expect(result.input).toEqual([{ role: 'user', content: 'Read.' }, { role: 'user', content: 'Continue.' }]); expect(result.report.omittedToolRecords).toBe(2);
    const reversed = plan([{ role: 'user', content: 'Read.' }, { role: 'tool', content: 'Result before call', tool_call_id: 'backwards' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'backwards', type: 'function', function: { name: 'doc_read', arguments: '{}' } }] }]);
    expect(reversed.input).toEqual([{ role: 'user', content: 'Read.' }]); expect(reversed.report.omittedToolRecords).toBe(2);
  });
  it('honors custom turn limits and ignores them when Automatic is selected', () => {
    const messages: MessageInterface[] = [{ role: 'user', content: 'Before' }, { role: 'assistant', content: 'Reply' }, { role: 'user', content: 'Now' }];
    expect(plan(messages, { config: { ...config, contextPolicy: { mode: 'custom', maxRecentTurns: 1 } } }).input).toEqual([messages[2]]);
    expect(plan(messages, { config: { ...config, contextPolicy: { mode: 'auto', maxRecentTurns: 1, maxInputTokens: 256 } } }).report.includedTurns).toBe(2);
  });
  it('rejects malformed saved limits and strips unknown fields', () => {
    expect(parseContextPolicy({ mode: 'auto', secret: 'ignored' })).toEqual({ mode: 'auto' });
    for (const value of [{ mode: 'all' }, { mode: 'custom', maxRecentTurns: 0 }, { mode: 'custom', maxInputTokens: Infinity }, { mode: 'custom', contextWindow: 10 }]) expect(() => parseContextPolicy(value)).toThrow('context');
  });
  it('stops oversized continuations without truncating tool results', () => {
    const result = plan([{ role: 'user', content: 'Read this.' }], { config: { ...config, contextPolicy: { mode: 'custom', maxInputTokens: 256 } } });
    const input = [{ type: 'function_call_output', call_id: 'read', output: 'x'.repeat(2000) }], before = structuredClone(input);
    expect(() => assertContinuationBudget(result.report, 100, input, countTokens)).toThrow('tool exchange');
    expect(input).toEqual(before); expect(assertContinuationBudget(result.report, 100, [{ output: 'Small' }], countTokens)).toBeLessThan(256);
  });
});
