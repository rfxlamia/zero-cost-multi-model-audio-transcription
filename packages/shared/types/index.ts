export interface TranscriptionJob {
  id: string
  userId: string // anonymous UUID
  status: 'uploading' | 'chunking' | 'transcribing' | 'correcting' | 'enhancing' | 'done' | 'error'
  audioUrl?: string // R2 temporary URL
  duration: number
  chunks: TranscriptionChunk[]
  providers: ProviderUsage[]
  metadata: {
    filename: string
    language: 'id' | 'id-en' // Indonesian or mixed
    glossary?: string[]
    createdAt: Date
    expiresAt: Date // 7 days
    quality: QualityMetrics
  }
}

export interface TranscriptionChunk {
  index: number
  startTime: number
  endTime: number
  audioHash: string // for community cache
  transcription: {
    raw: string // ASR output
    quick?: string // immediate correction (Phi-3)
    enhanced?: string // enhanced correction (Groq/HF)
    final: string // best available
    confidence: number
  }
  correctionProvider?: string // which LLM was used
  cached: boolean // from community cache?
}

export interface ProviderUsage {
  name: 'groq' | 'huggingface' | 'together' | 'cohere' | 'local'
  requestsUsed: number
  quotaRemaining: number
  resetAt: Date
  averageLatency: number
}

export interface QualityMetrics {
  wer?: number // word error rate if reference available
  corrections: number // number of corrections made
  enhancement: number // % improvement from raw
  userRating?: 1 | 2 | 3 | 4 | 5
}

export interface CommunityContribution {
  audioHash: string
  transcription: string
  corrections: string
  language: string
  upvotes: number
  contributor: string // anonymous ID
  verifiedBy?: string[] // other users who verified
}
