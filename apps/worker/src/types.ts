export type CorrectionMode = 'quick' | 'enhanced'

export type CorrectionSegment = {
  audioHash: string
  text: string
  mode: CorrectionMode
  glossary?: string[]
}

export type CorrectionResult = {
  audioHash: string
  corrected: string
  confidence: number
  provider: string
  cached: boolean
}

export type BatchCorrectionResponse = {
  provider: string | 'mixed' | 'cache'
  results: CorrectionResult[]
}

export type ProviderName = 'groq' | 'huggingface'

export type ProviderCallOptions = {
  mode: CorrectionMode
  glossary?: string[]
}
