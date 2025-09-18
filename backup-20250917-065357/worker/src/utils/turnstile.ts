const VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

type TurnstileResponse = {
  success: boolean
  'error-codes'?: string[]
}

export type TurnstileVerification = {
  success: boolean
  errors: string[]
}

export async function verifyTurnstileToken(
  secret: string,
  token: string,
  remoteIp?: string
): Promise<TurnstileVerification> {
  if (!secret) {
    return { success: false, errors: ['missing_secret'] }
  }
  if (!token) {
    return { success: false, errors: ['missing_token'] }
  }
  try {
    const form = new URLSearchParams()
    form.append('secret', secret)
    form.append('response', token)
    if (remoteIp) form.append('remoteip', remoteIp)

    const res = await fetch(VERIFY_ENDPOINT, {
      method: 'POST',
      body: form,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    if (!res.ok) {
      return { success: false, errors: [`http_${res.status}`] }
    }
    const data = (await res.json()) as TurnstileResponse
    if (data.success) {
      return { success: true, errors: [] }
    }
    return {
      success: false,
      errors: Array.isArray(data['error-codes']) ? data['error-codes'] : ['unknown'],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    return { success: false, errors: [`exception:${message}`] }
  }
}
