export interface ExportChunkLike {
    index?: number;
    startTime?: number;
    endTime?: number;
    transcription?: {
        raw?: string;
        quick?: string;
        enhanced?: string;
        final?: string;
    };
    raw?: string;
    quick?: string;
    enhanced?: string;
    final?: string;
}
export interface ExportBuildOptions {
    chunkSeconds?: number;
    toleranceSeconds?: number;
    mergeThresholdSeconds?: number;
    minDurationSeconds?: number;
}
export interface ExportSegment {
    index: number;
    start: number;
    end: number;
    text: string;
}
export declare function getExportSegments(job: {
    chunks?: ExportChunkLike[];
} | null | undefined, opts?: ExportBuildOptions): ExportSegment[];
export declare function segmentsToTxt(segments: ExportSegment[]): string;
export declare function segmentsToSrt(segments: ExportSegment[]): string;
export declare function segmentsToVtt(segments: ExportSegment[]): string;
export declare const EXPORT_DEFAULTS: {
    CHUNK_SECONDS: number;
    TOLERANCE_SECONDS: number;
    MERGE_THRESHOLD_SECONDS: number;
    MIN_SEGMENT_DURATION_SECONDS: number;
};
