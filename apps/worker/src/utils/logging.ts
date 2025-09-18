export type AnomalyEvent =
  | 'duplicate_audio_hash'
  | 'rate_limit_near_exhaustion'
  | 'rate_limit_blocked'
  | 'missing_required_secret'
  | 'missing_optional_secret'

export function logAnomaly(event: AnomalyEvent, details: Record<string, unknown>) {
  console.warn('[anomaly]', { event, ...details })
}

export function logSecurity(event: string, details: Record<string, unknown> = {}) {
  console.info('[security]', { event, ...details })
}
