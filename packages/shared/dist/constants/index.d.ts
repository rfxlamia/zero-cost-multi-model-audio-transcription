export declare const PROVIDER_QUOTAS: {
    readonly groq: {
        readonly dailyRequests: 14400;
        readonly minuteRequests: 30;
    };
    readonly huggingface: {
        readonly dailyRequests: 1000;
    };
    readonly together: {
        readonly creditEquivalent: 2000;
    };
    readonly cohere: {
        readonly trialRequests: 3000;
        readonly minuteRequests: 100;
    };
    readonly workersAI: {
        readonly dailyMinutes: 10;
    };
    readonly cloudflareKV: {
        readonly dailyReads: 100000;
    };
    readonly cloudflareR2: {
        readonly storageGB: 10;
    };
};
export declare const BATCH_SIZE = 5;
export declare const MAX_AUDIO_DURATION_MINUTES = 8;
export declare const CHUNK_DURATION_SECONDS = 30;
export declare const MAX_FILE_SIZE_MB = 80;
export declare const SSE_EVENTS: {
    readonly STATUS: "status";
    readonly RAW: "raw";
    readonly QUICK: "quick";
    readonly ENHANCED: "enhanced";
    readonly PROGRESS: "progress";
    readonly DONE: "done";
    readonly ERROR: "error";
};
export declare const KV_KEYS: {
    readonly COMMUNITY_CACHE: (audioHash: string) => string;
    readonly RESPONSE_CACHE: (audioHash: string, type: "raw" | "quick" | "enhanced" | "final") => string;
    readonly QUOTA_COUNTERS: (provider: string, day: string) => string;
    readonly JOB_STATE: (jobId: string) => string;
};
export declare const CACHE_TTL_DAYS = 7;
export declare const RATE_LIMITS: {
    readonly IP: {
        readonly HOUR_WINDOW_SEC: number;
        readonly HOUR_MAX: 100;
        readonly DAY_WINDOW_SEC: number;
        readonly DAY_MAX: 500;
    };
    readonly USER: {
        readonly HOUR_WINDOW_SEC: number;
        readonly HOUR_MAX: 30;
        readonly DAY_WINDOW_SEC: number;
        readonly DAY_MAX: 50;
    };
};
export declare const LANGUAGES: readonly ["id", "id-en"];
export declare const QUALITY_THRESHOLDS: {
    readonly LOW_CONFIDENCE: 0.8;
};
