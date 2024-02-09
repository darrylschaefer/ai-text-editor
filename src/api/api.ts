import { ConfigInterface, MessageInterface } from '@type/document';
import { isAzureEndpoint } from '@utils/api';

export const getChatCompletion = async (
  endpoint: string,
  messages: MessageInterface[],
  config: ConfigInterface,
  apiKey?: string,
  customHeaders?: Record<string, string>
) => {
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

    const path = `openai/deployments/${model}/chat/completions?api-version=${apiVersion}`;

    if (!endpoint.endsWith(path)) {
      if (!endpoint.endsWith('/')) {
        endpoint += '/';
      }
      endpoint += path;
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages,
      ...config,
      max_tokens: undefined,
    }),
  });
  if (!response.ok) throw new Error(await response.text());

  const data = await response.json();
  return data;
};

export const getChatCompletionStream = async (
  endpoint: string,
  messages: MessageInterface[],
  config: ConfigInterface,
  apiKey?: string,
  customHeaders?: Record<string, string>
) => {

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

    const path = `openai/deployments/${model}/chat/completions?api-version=${apiVersion}`;

    if (!endpoint.endsWith(path)) {
      if (!endpoint.endsWith('/')) {
        endpoint += '/';
      }
      endpoint += path;
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages,
      ...config,
      stream: true,
    }),
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