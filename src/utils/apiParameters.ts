/**
 * Centralized parameter definitions for different API endpoints
 * This file defines which parameters are available for each endpoint type
 */

import { ApiEndpointOptions, ConfigInterface, LegacyConfigInterface } from '@type/document';
import { _defaultChatConfig, _defaultLegacyConfig } from '@constants/chat';

export type ParameterKey = 
  | 'temperature' 
  | 'top_p' 
  | 'presence_penalty' 
  | 'frequency_penalty'
  | 'reasoning_effort'
  | 'verbosity'
  | 'max_tokens'
  | 'max_completion_tokens';

export interface ParameterDefinition {
  key: ParameterKey;
  label: string;
  type: 'slider' | 'select';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  defaultValue: any;
}

/**
 * Parameter definitions for each API endpoint
 */
export const endpointParameters: Record<ApiEndpointOptions, ParameterDefinition[]> = {
  completions: [
    {
      key: 'max_tokens',
      label: 'Max Tokens',
      type: 'slider',
      min: 1,
      max: 4096,
      step: 1,
      defaultValue: _defaultLegacyConfig.max_tokens || 100,
    },
    {
      key: 'temperature',
      label: 'Temperature',
      type: 'slider',
      min: 0,
      max: 2,
      step: 0.1,
      defaultValue: _defaultLegacyConfig.temperature ?? 1,
    },
    {
      key: 'top_p',
      label: 'Top P',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      defaultValue: _defaultLegacyConfig.top_p ?? 1,
    },
    {
      key: 'presence_penalty',
      label: 'Presence Penalty',
      type: 'slider',
      min: -2,
      max: 2,
      step: 0.1,
      defaultValue: _defaultLegacyConfig.presence_penalty ?? 0,
    },
    {
      key: 'frequency_penalty',
      label: 'Frequency Penalty',
      type: 'slider',
      min: -2,
      max: 2,
      step: 0.1,
      defaultValue: _defaultLegacyConfig.frequency_penalty ?? 0,
    },
  ],
  chat_completions: [
    {
      key: 'max_completion_tokens',
      label: 'Max Completion Tokens',
      type: 'slider',
      min: 0,
      max: 4096,
      step: 1,
      defaultValue: _defaultChatConfig.max_completion_tokens,
    },
    {
      key: 'temperature',
      label: 'Temperature',
      type: 'slider',
      min: 0,
      max: 2,
      step: 0.1,
      defaultValue: _defaultChatConfig.temperature,
    },
    {
      key: 'top_p',
      label: 'Top P',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      defaultValue: _defaultChatConfig.top_p,
    },
    {
      key: 'presence_penalty',
      label: 'Presence Penalty',
      type: 'slider',
      min: -2,
      max: 2,
      step: 0.1,
      defaultValue: _defaultChatConfig.presence_penalty,
    },
    {
      key: 'frequency_penalty',
      label: 'Frequency Penalty',
      type: 'slider',
      min: -2,
      max: 2,
      step: 0.1,
      defaultValue: _defaultChatConfig.frequency_penalty,
    },
  ],
  responses: [
    {
      key: 'max_completion_tokens',
      label: 'Max Completion Tokens',
      type: 'slider',
      min: 0,
      max: 4096,
      step: 1,
      defaultValue: _defaultChatConfig.max_completion_tokens,
    },
    {
      key: 'reasoning_effort',
      label: 'Reasoning Effort',
      type: 'select',
      options: ['none', 'low', 'medium', 'high', 'xhigh'],
      defaultValue: _defaultChatConfig.reasoning_effort || 'medium',
    },
    {
      key: 'verbosity',
      label: 'Verbosity',
      type: 'select',
      options: ['low', 'medium', 'high'],
      defaultValue: _defaultChatConfig.verbosity || 'medium',
    },
  ],
};

/**
 * Get parameter definitions for a specific endpoint
 */
export function getParametersForEndpoint(endpoint: ApiEndpointOptions): ParameterDefinition[] {
  return endpointParameters[endpoint] || [];
}

/**
 * Get default values for a specific endpoint
 */
export function getDefaultValuesForEndpoint(endpoint: ApiEndpointOptions): Partial<ConfigInterface | LegacyConfigInterface> {
  if (endpoint === 'completions') {
    return {
      max_tokens: _defaultLegacyConfig.max_tokens || 100,
      temperature: _defaultLegacyConfig.temperature ?? 1,
      top_p: _defaultLegacyConfig.top_p ?? 1,
      presence_penalty: _defaultLegacyConfig.presence_penalty ?? 0,
      frequency_penalty: _defaultLegacyConfig.frequency_penalty ?? 0,
    };
  } else if (endpoint === 'chat_completions') {
    return {
      max_completion_tokens: _defaultChatConfig.max_completion_tokens,
      temperature: _defaultChatConfig.temperature,
      top_p: _defaultChatConfig.top_p,
      presence_penalty: _defaultChatConfig.presence_penalty,
      frequency_penalty: _defaultChatConfig.frequency_penalty,
    };
  } else {
    // responses
    return {
      max_completion_tokens: _defaultChatConfig.max_completion_tokens,
      reasoning_effort: _defaultChatConfig.reasoning_effort || 'medium',
      verbosity: _defaultChatConfig.verbosity || 'medium',
    };
  }
}

/**
 * Check if a parameter is valid for a specific endpoint
 */
export function isParameterValidForEndpoint(
  parameter: ParameterKey,
  endpoint: ApiEndpointOptions
): boolean {
  const params = getParametersForEndpoint(endpoint);
  return params.some(p => p.key === parameter);
}





