export interface APIKeyValidationResult {
  isValid: boolean;
  error?: string;
  keyType?: 'openai' | 'perplexity';
}

export async function validateOpenAIKey(apiKey: string): Promise<APIKeyValidationResult> {
  if (!apiKey || !apiKey.startsWith('sk-')) {
    return { isValid: false, error: 'Invalid OpenAI API key format' };
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    if (response.ok) {
      return { isValid: true, keyType: 'openai' };
    } else {
      return { isValid: false, error: 'OpenAI API key is invalid or expired' };
    }
  } catch (error) {
    return { isValid: false, error: 'Failed to validate OpenAI API key' };
  }
}

export async function validatePerplexityKey(apiKey: string): Promise<APIKeyValidationResult> {
  if (!apiKey || !apiKey.startsWith('pplx-')) {
    return { isValid: false, error: 'Invalid Perplexity API key format' };
  }
  
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      })
    });
    
    if (response.ok || response.status === 400) {
      return { isValid: true, keyType: 'perplexity' };
    } else if (response.status === 401) {
      return { isValid: false, error: 'Perplexity API key is invalid or expired' };
    } else {
      return { isValid: false, error: 'Failed to validate Perplexity API key' };
    }
  } catch (error) {
    return { isValid: false, error: 'Failed to validate Perplexity API key' };
  }
}

export function validateEnvironmentKeys(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!process.env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY is not set');
  } else if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
    errors.push('OPENAI_API_KEY has invalid format');
  }
  
  if (!process.env.PERPLEXITY_API_KEY) {
    errors.push('PERPLEXITY_API_KEY is not set');
  } else if (!process.env.PERPLEXITY_API_KEY.startsWith('pplx-')) {
    errors.push('PERPLEXITY_API_KEY has invalid format');
  }
  
  const firebaseKeys = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ];
  
  firebaseKeys.forEach(key => {
    if (!process.env[key]) {
      errors.push(`${key} is not set`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}
