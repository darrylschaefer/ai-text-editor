export const isAzureEndpoint = (endpoint: string) => {
  return endpoint.includes('openai.azure.com');
};

/**
 * Removes provider, apiEndpoint, and notes fields from config objects
 * These fields are not sent to the API and should be removed before API calls
 */
export function removeProviderAndApiEndpoint<T extends object>(obj: T): Omit<T, 'provider' | 'apiEndpoint' | 'notes'> {
  if (obj && typeof obj === 'object') {
    const { provider, apiEndpoint, notes, ...rest } = obj as any;
    return rest as Omit<T, 'provider' | 'apiEndpoint' | 'notes'>;
  }
  return obj as Omit<T, 'provider' | 'apiEndpoint' | 'notes'>;
}

export const constructEndpointUrl = (
  baseEndpoint: string,
  apiEndpointType: 'completions' | 'chat_completions' | 'responses' | string
): string => {
  // Map internal endpoint type to actual API path
  let targetPath: string;
  if (apiEndpointType === 'chat_completions') {
    targetPath = 'chat/completions';
  } else if (apiEndpointType === 'responses') {
    targetPath = 'responses';
  } else {
    targetPath = apiEndpointType; // 'completions' or other
  }

  // If it's already the correct endpoint, return as is
  if (baseEndpoint.includes(`/${targetPath}`) && !baseEndpoint.includes(`/chat/${targetPath}`)) {
    return baseEndpoint;
  }

  // Extract the base URL (protocol + host)
  try {
    const url = new URL(baseEndpoint);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Handle special case: /v1/chat/completions or /v1/chat/responses
    if (pathParts.length >= 3 && pathParts[pathParts.length - 2] === 'chat' && 
        (pathParts[pathParts.length - 1] === 'completions' || pathParts[pathParts.length - 1] === 'responses')) {
      // For chat_completions, keep the /chat/completions structure
      if (apiEndpointType === 'chat_completions') {
        // Already correct, just return
        return baseEndpoint;
      } else {
        // Remove 'chat' and replace with new endpoint
        pathParts.splice(pathParts.length - 2, 1); // Remove 'chat'
        pathParts[pathParts.length - 1] = targetPath;
      }
    } else if (pathParts.length >= 2) {
      // Replace the last path segment with the new endpoint path
      // For chat_completions, we need to insert 'chat' before 'completions'
      if (apiEndpointType === 'chat_completions') {
        pathParts[pathParts.length - 1] = 'chat';
        pathParts.push('completions');
      } else {
        pathParts[pathParts.length - 1] = targetPath;
      }
    } else {
      // If path structure is unexpected, append the endpoint path
      if (apiEndpointType === 'chat_completions') {
        pathParts.push('chat', 'completions');
      } else {
        pathParts.push(targetPath);
      }
    }
    
    url.pathname = '/' + pathParts.join('/');
    return url.toString();
  } catch (e) {
    // If URL parsing fails, try simple string replacement
    if (baseEndpoint.includes('/chat/completions')) {
      if (apiEndpointType === 'chat_completions') {
        return baseEndpoint; // Already correct
      }
      return baseEndpoint.replace('/chat/completions', `/${targetPath}`);
    }
    if (baseEndpoint.includes('/chat/responses')) {
      return baseEndpoint.replace('/chat/responses', `/${targetPath}`);
    }
    if (baseEndpoint.includes('/completions')) {
      if (apiEndpointType === 'chat_completions') {
        return baseEndpoint.replace('/completions', '/chat/completions');
      }
      return baseEndpoint.replace('/completions', `/${targetPath}`);
    }
    if (baseEndpoint.includes('/responses')) {
      return baseEndpoint.replace('/responses', `/${targetPath}`);
    }
    // If no known pattern, append the endpoint path
    const separator = baseEndpoint.endsWith('/') ? '' : '/';
    if (apiEndpointType === 'chat_completions') {
      return `${baseEndpoint}${separator}chat/completions`;
    }
    return `${baseEndpoint}${separator}${targetPath}`;
  }
};