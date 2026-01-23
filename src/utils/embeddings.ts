import useStore from '@store/store';
import { isAzureEndpoint } from './api';

/**
 * Get embeddings API endpoint from chat completions endpoint
 */
function getEmbeddingsEndpoint(baseEndpoint: string): string {
  try {
    const url = new URL(baseEndpoint);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Replace 'chat/completions' or 'completions' with 'embeddings'
    if (pathParts.includes('chat') && pathParts.includes('completions')) {
      pathParts.splice(pathParts.indexOf('chat'), 2, 'embeddings');
    } else if (pathParts.includes('completions')) {
      pathParts[pathParts.indexOf('completions')] = 'embeddings';
    } else {
      pathParts.push('embeddings');
    }
    
    url.pathname = '/' + pathParts.join('/');
    return url.toString();
  } catch (e) {
    // Fallback: simple string replacement
    return baseEndpoint
      .replace('/chat/completions', '/embeddings')
      .replace('/completions', '/embeddings')
      .replace(/\/$/, '') + '/embeddings';
  }
}

/**
 * Generate embedding for text using OpenAI embeddings API
 */
export async function generateEmbedding(
  text: string,
  model: string = 'text-embedding-3-small'
): Promise<number[]> {
  const apiKey = useStore.getState().apiKey;
  const apiEndpoint = useStore.getState().apiEndpoint;
  
  if (!apiKey || !apiEndpoint) {
    throw new Error('API key or endpoint not configured');
  }
  
  const embeddingsEndpoint = getEmbeddingsEndpoint(apiEndpoint);
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };
  
  // Handle Azure endpoints
  if (isAzureEndpoint(embeddingsEndpoint) && apiKey) {
    headers['api-key'] = apiKey;
    
    // Azure embeddings endpoint structure
    const azureModel = model.replace('text-embedding-', 'text-embedding-ada-002'); // Azure model mapping
    const apiVersion = '2023-05-15';
    const path = `openai/deployments/${azureModel}/embeddings?api-version=${apiVersion}`;
    
    const url = new URL(embeddingsEndpoint);
    if (!url.pathname.includes(path)) {
      url.pathname = `/${path}`;
    }
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        input: text,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Embeddings API error: ${await response.text()}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  }
  
  // Standard OpenAI endpoint
  const response = await fetch(embeddingsEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      input: text,
      model: model,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Embeddings API error: ${await response.text()}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  return dotProduct / denominator;
}
