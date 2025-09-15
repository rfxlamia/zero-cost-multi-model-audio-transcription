export function transformersEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_ENABLE_TRANSFORMERS
  if (v == null) return false
  return String(v).toLowerCase() === 'true' || String(v) === '1'
}

