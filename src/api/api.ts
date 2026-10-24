import { ConfigInterface, MessageInterface, LegacyConfigInterface } from '@type/document';
import { isAzureEndpoint } from '@utils/api';
import { debug } from '@utils/debug';
import { resolveConnectionRequest } from '@store/connection-store';
import { useConnections } from '@store/connection-store';

const dbg = debug.tag('API');

// Historical callers retain typed exports so saved data remains readable. No retired route sends HTTP.
const retiredApiError = () => new Error('This API was retired in fthr. Start a new chat with a Responses model, or update this macro’s configuration.');

export const getLegacyCompletion = async (
  _endpoint: string, _prompt: string, _config: LegacyConfigInterface, _apiKey?: string, _customHeaders?: Record<string, string>
): Promise<any> => { throw retiredApiError(); };

export const getLegacyCompletionStream = async (
  _endpoint: string, _prompt: string, _config: LegacyConfigInterface, _apiKey?: string, _customHeaders?: Record<string, string>
): Promise<ReadableStream<Uint8Array> | null> => { throw retiredApiError(); };

export const getChatCompletion = async (
  _endpoint: string, _messages: MessageInterface[], _config: ConfigInterface, _apiKey?: string, _customHeaders?: Record<string, string>
): Promise<any> => { throw retiredApiError(); };

export const getChatCompletionStream = async (
  _endpoint: string, _messages: MessageInterface[], _config: ConfigInterface, _apiKey?: string, _customHeaders?: Record<string, string>
): Promise<ReadableStream<Uint8Array> | null> => { throw retiredApiError(); };

// Responses API
export const getResponse = async (
  endpoint: string,
  messages: MessageInterface[],
  config: ConfigInterface,
  apiKey?: string,
  customHeaders?: Record<string, string>
) => {
  if (config.connectionId || useConnections.getState().activeConnectionId) {
    const resolved = resolveConnectionRequest(config, 'responses'); endpoint = resolved.endpoint; apiKey = resolved.apiKey;
  }
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  if (isAzureEndpoint(endpoint) && apiKey) {
    headers['api-key'] = apiKey;

    const gpt3forAzure = 'gpt-35-turbo';
    const model =
      config.model === 'gpt-3.5-turbo' ? gpt3forAzure : config.model;
    const apiVersion = '2023-03-15-preview';

    const path = `openai/deployments/${model}/responses?api-version=${apiVersion}`;

    if (!endpoint.endsWith(path)) {
      if (!endpoint.endsWith('/')) {
        endpoint += '/';
      }
      endpoint += path;
    }
  }

  // Transform config for Responses API:
  // - move reasoning_effort to reasoning.effort
  // - move max_completion_tokens to max_output_tokens
  // - move verbosity to text.verbosity
  // - exclude unsupported parameters (temperature, presence_penalty, top_p, frequency_penalty, provider, apiEndpoint, notes)
  const { 
    reasoning_effort, 
    max_completion_tokens, 
    verbosity,
    temperature,
    presence_penalty,
    top_p,
    frequency_penalty,
    provider,
    connectionId,
    contextPolicy,
    apiEndpoint,
    notes,
    ...restConfig 
  } = config;
  const requestBody: any = {
    input: messages,
    ...restConfig,
  };
  
  // Add reasoning object if reasoning_effort is provided
  if (reasoning_effort !== undefined) {
    requestBody.reasoning = {
      effort: reasoning_effort,
    };
  }
  
  // Transform max_completion_tokens to max_output_tokens
  if (max_completion_tokens !== undefined) {
    requestBody.max_output_tokens = max_completion_tokens;
  }
  
  // Transform verbosity to text.verbosity
  if (verbosity !== undefined) {
    requestBody.text = {
      ...requestBody.text,
      verbosity: verbosity,
    };
  }

  dbg.log('[Responses API - getResponse] Request config:', JSON.stringify(requestBody, null, 2));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) throw new Error(await response.text());

  const data = await response.json();
  return data;
};

export const getResponseStream = async (
  endpoint: string,
  messages: MessageInterface[],
  config: ConfigInterface,
  apiKey?: string,
  customHeaders?: Record<string, string>,
  signal?: AbortSignal
) => {
  if (config.connectionId || useConnections.getState().activeConnectionId) {
    const resolved = resolveConnectionRequest(config, 'responses'); endpoint = resolved.endpoint; apiKey = resolved.apiKey;
  }
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  if (isAzureEndpoint(endpoint) && apiKey) {
    headers['api-key'] = apiKey;

    const gpt3forAzure = 'gpt-35-turbo';
    const model =
      config.model === 'gpt-3.5-turbo' ? gpt3forAzure : config.model;
    const apiVersion = '2023-03-15-preview';

    const path = `openai/deployments/${model}/responses?api-version=${apiVersion}`;

    if (!endpoint.endsWith(path)) {
      if (!endpoint.endsWith('/')) {
        endpoint += '/';
      }
      endpoint += path;
    }
  }

  // Transform config for Responses API:
  // - move reasoning_effort to reasoning.effort
  // - move max_completion_tokens to max_output_tokens
  // - move verbosity to text.verbosity
  // - exclude unsupported parameters (temperature, presence_penalty, top_p, frequency_penalty, provider, apiEndpoint, notes)
  // - include tools and tool_choice if provided (for agent conversations)
  const { 
    reasoning_effort, 
    max_completion_tokens, 
    verbosity,
    temperature,
    presence_penalty,
    top_p,
    frequency_penalty,
    provider,
    connectionId,
    contextPolicy,
    apiEndpoint,
    notes,
    ...restConfig 
  } = config;
  
  // Extract tools and tool_choice from config (they may not be in ConfigInterface type)
  const configAny = config as any;
  const tools = configAny.tools;
  const tool_choice = configAny.tool_choice;
  
  const requestBody: any = {
    input: messages,
    ...restConfig,
    stream: true,
  };
  
  // Add reasoning object if reasoning_effort is provided
  if (reasoning_effort !== undefined) {
    requestBody.reasoning = {
      effort: reasoning_effort,
    };
  }
  
  // Transform max_completion_tokens to max_output_tokens
  if (max_completion_tokens !== undefined) {
    requestBody.max_output_tokens = max_completion_tokens;
  }
  
  // Transform verbosity to text.verbosity
  if (verbosity !== undefined) {
    requestBody.text = {
      ...requestBody.text,
      verbosity: verbosity,
    };
  }
  
  // Include tools and tool_choice if provided (for agent conversations)
  // Flatten tool definitions for Responses API format
  if (tools !== undefined && Array.isArray(tools) && tools.length > 0) {
    requestBody.tools = tools.map((tool: any) => {
      // If tool has nested function structure, flatten it for Responses API
      if (tool.function) {
        return {
          type: tool.type || 'function',
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters || { type: 'object', properties: {}, required: [] },
        };
      }
      // If already flattened, return as is
      return tool;
    });
  }
  if (tool_choice !== undefined) {
    requestBody.tool_choice = tool_choice;
  }

  dbg.log('[Responses API - getResponseStream] Request config:', JSON.stringify(requestBody, null, 2));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal,
  });
  if (response.status === 404 || response.status === 405) {
    const text = await response.text();
    if (text.includes('model_not_found')) {
      throw new Error(
        text +
          'Please ensure that you have access to this model.'
      );
    } else {
      throw new Error(
        'Invalid API endpoint!'
      );
    }
  }

  if (response.status === 429 || !response.ok) {
    const text = await response.text();
    let error = text;
    if (text.includes('insufficient_quota')) {
      error +=
        'Insufficient quota.';
    } else if (response.status === 429) {
      error += '\nRate limited!';
    }
    throw new Error(error);
  }

  const stream = response.body;
  return stream;
};

// ============================================================================
// MODELS API
// ============================================================================

export const getModelsList = async (
  baseEndpoint: string,
  apiKey?: string,
  customHeaders?: Record<string, string>
) => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  // Construct the models endpoint from the base endpoint
  let modelsEndpoint: string;
  try {
    const url = new URL(baseEndpoint);
    // Remove any existing path and set to /v1/models
    url.pathname = '/v1/models';
    modelsEndpoint = url.toString();
  } catch (e) {
    // If URL parsing fails, try simple string replacement
    if (baseEndpoint.includes('/chat/completions')) {
      modelsEndpoint = baseEndpoint.replace('/chat/completions', '/models');
    } else if (baseEndpoint.includes('/completions')) {
      modelsEndpoint = baseEndpoint.replace('/completions', '/models');
    } else if (baseEndpoint.includes('/responses')) {
      modelsEndpoint = baseEndpoint.replace('/responses', '/models');
    } else {
      // Append /v1/models if no known pattern
      const separator = baseEndpoint.endsWith('/') ? '' : '/';
      modelsEndpoint = `${baseEndpoint}${separator}v1/models`;
    }
  }

  dbg.log('[Models API] Fetching models from:', modelsEndpoint);

  const response = await fetch(modelsEndpoint, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch models: ${text}`);
  }

  const data = await response.json();
  return data;
};
