export interface TranscriptionJob {
    id: string;
    userId: string;
    status: 'uploading' | 'chunking' | 'transcribing' | 'correcting' | 'enhancing' | 'done' | 'error';
    audioUrl?: string;
    duration: number;
    chunks: TranscriptionChunk[];
    providers: ProviderUsage[];
    metadata: {
        filename: string;
        language: 'id' | 'id-en';
        glossary?: string[];
        createdAt: Date;
        expiresAt: Date;
        quality: QualityMetrics;
    };
}
export interface TranscriptionChunk {
    index: number;
    startTime: number;
    endTime: number;
    audioHash: string;
    transcription: {
        raw: string;
        quick?: string;
        enhanced?: string;
        final: string;
        confidence: number;
    };
    correctionProvider?: string;
    cached: boolean;
}
export interface ProviderUsage {
    name: 'groq' | 'huggingface' | 'together' | 'cohere' | 'local';
    requestsUsed: number;
    quotaRemaining: number;
    resetAt: Date;
    averageLatency: number;
}
export interface QualityMetrics {
    wer?: number;
    corrections: number;
    enhancement: number;
    userRating?: 1 | 2 | 3 | 4 | 5;
}
export interface CommunityContribution {
    audioHash: string;
    transcription: string;
    corrections: string;
    language: string;
    upvotes: number;
    contributor: string;
    verifiedBy?: string[];
}
