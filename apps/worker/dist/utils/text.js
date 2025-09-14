const LIMITS = {
    quick: 600,
    enhanced: 1200,
};
export function optimizeText(input, mode) {
    let t = input ?? '';
    // Normalize whitespace
    t = t.replace(/[\t\v\f\r\n]+/g, ' ');
    t = t.replace(/\s{2,}/g, ' ');
    t = t.trim();
    // Simple punctuation spacing normalization
    t = t.replace(/\s+([,.;:!?])/g, '$1');
    t = t.replace(/([,.;:!?])(\S)/g, '$1 $2');
    // Limit length per mode
    const max = LIMITS[mode];
    if (t.length > max) {
        t = t.slice(0, max - 1).trimEnd() + '…';
    }
    return t;
}
export function optimizeBatch(texts, mode) {
    return texts.map((t) => optimizeText(t, mode));
}
