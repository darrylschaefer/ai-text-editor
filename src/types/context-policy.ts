export interface ContextPolicy {
  mode: 'auto' | 'custom';
  maxInputTokens?: number;
  maxRecentTurns?: number;
  // Used only when the connected catalog does not provide a context window.
  contextWindow?: number;
}

export interface ContextReport {
  contextWindow: number;
  windowSource: 'catalog' | 'custom' | 'fallback';
  inputBudget: number;
  outputReserve: number;
  safetyReserve: number;
  instructionsTokens: number;
  toolsTokens: number;
  historyTokens: number;
  estimatedInputTokens: number;
  includedTurns: number;
  excludedTurns: number;
  omittedToolRecords: number;
}

export interface ContextUsage {
  responseId: string;
  inputTokens: number;
  outputTokens: number;
  estimated: boolean;
}
