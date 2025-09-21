#!/usr/bin/env node
import { setTimeout as delay } from 'node:timers/promises'

const baseUrl = process.env.WORKER_URL ?? 'http://localhost:8787'
const streamTimeout = Number(process.env.NETWORK_STREAM_TIMEOUT ?? 5000)
const reconnectDelay = Number(process.env.NETWORK_RECONNECT_DELAY ?? 500)
const jobId = process.env.NETWORK_TEST_JOB_ID ?? `qa-network-${Date.now()}`

async function readChunk(reader, timeoutMs) {
  const timeout = delay(timeoutMs).then(() => ({ timeout: true }))
  const chunk = reader.read()
  const result = await Promise.race([timeout, chunk])
  if (result?.timeout) {
    throw new Error(`Stream timeout setelah ${timeoutMs} ms`)
  }
  return result
}

async function openStream(label, abortAfterFirst = false) {
  const url = new URL(`/api/transcribe/${jobId}/stream`, baseUrl)
  const controller = new AbortController()
  const res = await fetch(url, {
    headers: { accept: 'text/event-stream' },
    signal: controller.signal,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`[${label}] Gagal membuka SSE (${res.status}): ${body}`)
  }
  const reader = res.body?.getReader()
  if (!reader) throw new Error(`[${label}] Stream tidak menyediakan reader`)
  const first = await readChunk(reader, streamTimeout)
  if (first.done) throw new Error(`[${label}] Stream langsung selesai tanpa data`)
  const text = new TextDecoder().decode(first.value)
  console.log(`   • ${label}: menerima ${text.trim().split('\n')[0] || 'chunk'}`)
  if (abortAfterFirst) controller.abort()
  else await reader.cancel().catch(() => {})
}

async function main() {
  console.log(`▶️  Network resilience test untuk SSE ${baseUrl} dengan jobId ${jobId}`)
  await openStream('koneksi awal', true)
  console.log(`   • menunggu ${reconnectDelay} ms sebelum mencoba ulang`)
  await delay(reconnectDelay)
  await openStream('reconnect')
  console.log('✅ SSE berhasil reconnect setelah pemutusan paksa')
}

main().catch((error) => {
  console.error('❌ Network resilience test gagal:', error.message)
  process.exitCode = 1
})
