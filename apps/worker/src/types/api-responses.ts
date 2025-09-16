// Type definitions for external API responses

// Groq API Response Types
export interface GroqChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// Hugging Face API Response Types
export interface HuggingFaceTextGenerationResponse {
  generated_text?: string
  // For array responses
  [index: number]: {
    generated_text?: string
  }
}

// Community API Types
export interface CommunitySubmission {
  audioHash: string
  text: string
  corrections?: string
  contributor?: string
}

export interface CommunityData {
  audioHash: string
  upvotes?: number
  text?: string
  corrections?: string
  contributor?: string
}

// Type guard functions
export function isGroqResponse(data: unknown): data is GroqChatCompletionResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'choices' in data &&
    Array.isArray((data as any).choices)
  )
}

export function isHuggingFaceResponse(data: unknown): data is HuggingFaceTextGenerationResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    ('generated_text' in data || (Array.isArray(data) && data.length > 0))
  )
}
