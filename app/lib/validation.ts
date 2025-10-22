export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

export function validateStockCode(stockCode: string): boolean {
  if (!stockCode || typeof stockCode !== 'string') {
    return false;
  }
  
  const sanitized = sanitizeInput(stockCode);
  return /^[A-Z0-9]{1,10}$/.test(sanitized);
}

export function validateMarket(market: string): market is "JP" | "US" {
  return market === "JP" || market === "US";
}

export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateStep(step: any): step is number {
  return typeof step === 'number' && step >= 1 && step <= 3;
}

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function validateRequestBody(body: any, requiredFields: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a valid JSON object'] };
  }
  
  for (const field of requiredFields) {
    if (!(field in body) || body[field] === null || body[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function rateLimitHeaders(remaining: number, resetIn: number) {
  return {
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(Date.now() / 1000 + resetIn / 1000).toString(),
  };
}
