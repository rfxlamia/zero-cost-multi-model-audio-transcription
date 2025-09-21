#!/usr/bin/env node
import { performance } from 'node:perf_hooks'
import { setTimeout as delay } from 'node:timers/promises'

const baseUrl = process.env.WORKER_URL ?? 'http://localhost:8787'
const targetMs = Number(process.env.CACHE_TARGET_MS ?? 500)
const audioHash = process.env.CACHE_AUDIO_HASH ?? `qa-cache-${Date.now()}`
const sampleText =
  process.env.CACHE_SAMPLE_TEXT ??
  'ini adalah pengujian performa cache untuk memastikan panggilan kedua lebih cepat'

async function postCorrection(label) {
  const payload = {
    segments: [
      {
        audioHash,
        text: sampleText,
        mode: 'quick',
      },
    ],
  }

  const start = performance.now()
  const res = await fetch(new URL('/api/correct/batch', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const elapsed = performance.now() - start
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`[${label}] Request gagal (${res.status}): ${body}`)
  }
  const data = await res.json()
  if (!data?.results?.length) throw new Error(`[${label}] Respons tanpa segmen`)
  return { elapsed, data }
}

async function main() {
  console.log(`▶️  Cache performance test menuju ${baseUrl} (target <= ${targetMs} ms)`) 
  const first = await postCorrection('prime')
  console.log('   • durasi panggilan pertama:', `${first.elapsed.toFixed(0)} ms`)
  await delay(400)
  const second = await postCorrection('cached')
  console.log('   • durasi panggilan kedua:', `${second.elapsed.toFixed(0)} ms`)

  const cachedSegments = second.data.results.filter((seg) => seg.cached || seg.provider === 'cache').length
  if (cachedSegments === 0) {
    throw new Error('Tidak ada segmen yang ditandai sebagai cache pada panggilan kedua; cek konfigurasi RESPONSE_CACHE')
  }

  if (second.elapsed > targetMs) {
    throw new Error(
      `Panggilan kedua (${second.elapsed.toFixed(0)} ms) melebihi target ${targetMs} ms; evaluasi performa KV/community cache`
    )
  }

  console.log('✅ Cache memenuhi target, segmen dari cache:', cachedSegments)
}

main().catch((error) => {
  console.error('❌ Cache performance test gagal:', error.message)
  process.exitCode = 1
})
