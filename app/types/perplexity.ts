// Shared Perplexity API types (UTF-8)

export interface PerplexityMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PerplexityUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface PerplexityChoiceDelta {
  role?: string;
  content?: string;
}

export interface PerplexityChoiceMessage {
  role: "assistant";
  content: string;
}

export interface PerplexityChoice {
  index: number;
  finish_reason: string;
  message?: PerplexityChoiceMessage;
  delta?: PerplexityChoiceDelta;
}

export interface PerplexityResponse {
  id: string;
  model: string;
  created: number;
  usage?: PerplexityUsage;
  citations?: string[];
  choices: PerplexityChoice[];
}

export interface PerplexitySearchRequestOptions {
  return_citations?: boolean;
  return_images?: boolean;
  return_related_questions?: boolean;
}

