// Type definitions for external API responses
// Type guard functions
export function isGroqResponse(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'choices' in data &&
        Array.isArray(data.choices));
}
export function isHuggingFaceResponse(data) {
    return (typeof data === 'object' &&
        data !== null &&
        ('generated_text' in data || (Array.isArray(data) && data.length > 0)));
}
