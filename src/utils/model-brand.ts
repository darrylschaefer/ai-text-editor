export type ModelBrand = 'openai' | 'claude' | 'gemini' | 'deepseek' | 'meta' | 'mistral' | 'qwen' | 'grok' | 'openrouter';

const brands: { id: ModelBrand; namespaces: string[]; family?: RegExp }[] = [
  { id: 'openai', namespaces: ['openai'], family: /^(?:gpt-|chatgpt-|o\d+(?:-|$))/ },
  { id: 'claude', namespaces: ['anthropic', 'claude'], family: /^claude(?:-|$)/ },
  { id: 'gemini', namespaces: ['google', 'google-deepmind', 'gemini'], family: /^gemini(?:-|$)/ },
  { id: 'deepseek', namespaces: ['deepseek'], family: /^deepseek(?:-|$)/ },
  { id: 'meta', namespaces: ['meta', 'meta-llama'], family: /^(?:llama|meta-llama)(?:[.-]|$)/ },
  { id: 'mistral', namespaces: ['mistral', 'mistralai'], family: /^(?:mistral|mixtral|ministral|codestral|devstral|magistral|pixtral)(?:[.-]|$)/ },
  { id: 'qwen', namespaces: ['qwen', 'alibaba'], family: /^qwen(?:\d|[.-]|$)/ },
  { id: 'grok', namespaces: ['x-ai', 'xai'], family: /^grok(?:[.-]|$)/ },
  { id: 'openrouter', namespaces: ['openrouter'] },
];

/** Identify the model's brand, independently of its connection name or routing service. */
export function modelBrand(model?: string): ModelBrand | undefined {
  const id = model?.trim().toLowerCase();
  if (!id) return;
  if (id.includes('/')) return brands.find(brand => brand.namespaces.includes(id.split('/')[0]))?.id;
  return brands.find(brand => brand.family?.test(id))?.id;
}
