export function logAnomaly(event, details) {
    console.warn('[anomaly]', { event, ...details });
}
export function logSecurity(event, details = {}) {
    console.info('[security]', { event, ...details });
}
