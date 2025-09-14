export const PROVIDER_QUOTAS = {
  groq: {
    dailyRequests: 14400,
    minuteRequests: 30,
  },
  huggingface: {
    dailyRequests: 1000,
  },
  together: {
    creditEquivalent: 2000, // approximate corrections from $25 credit
  },
  cohere: {
    trialRequests: 3000,
    minuteRequests: 100,
  },
  workersAI: {
    dailyMinutes: 10,
  },
  cloudflareKV: {
    dailyReads: 100000,
  },
  cloudflareR2: {
    storageGB: 10,
  },
} as const;

export const BATCH_SIZE = 5; // segments per LLM request

export const MAX_AUDIO_DURATION_MINUTES = 10;
export const CHUNK_DURATION_SECONDS = 30;
export const MAX_FILE_SIZE_MB = 100;

export const SSE_EVENTS = {
  STATUS: 'status',
  RAW: 'raw',
  QUICK: 'quick',
  ENHANCED: 'enhanced',
  PROGRESS: 'progress',
  DONE: 'done',
  ERROR: 'error',
} as const;

export const KV_KEYS = {
  COMMUNITY_CACHE: (audioHash: string) => `COMMUNITY_CACHE:${audioHash}`,
  RESPONSE_CACHE: (audioHash: string, type: 'raw' | 'quick' | 'enhanced' | 'final') => `RESPONSE_CACHE:${audioHash}:${type}`,
  QUOTA_COUNTERS: (provider: string, day: string) => `QUOTA_COUNTERS:${provider}:day:${day}`,
  JOB_STATE: (jobId: string) => `JOB_STATE:${jobId}`,
} as const;

export const CACHE_TTL_DAYS = 7; // for response cache and auto-delete

export const LANGUAGES = ['id', 'id-en'] as const;

export const QUALITY_THRESHOLDS = {
  LOW_CONFIDENCE: 0.8, // threshold to trigger enhanced correction
} as const;
