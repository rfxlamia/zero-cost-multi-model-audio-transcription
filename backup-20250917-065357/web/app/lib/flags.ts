export function transformersEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_ENABLE_TRANSFORMERS
  if (v === undefined) return false
  const s = v.toLowerCase()
  return s === 'true' || v === '1'
}
