#!/usr/bin/env node
import { performance } from 'node:perf_hooks'
import { setTimeout as delay } from 'node:timers/promises'

const baseUrl = process.env.WORKER_URL ?? 'http://localhost:8787'
const concurrency = Number(process.env.QA_CONCURRENCY ?? 10)
const preferMode = process.env.QA_CONCURRENCY_MODE === 'enhanced' ? 'enhanced' : 'quick'
const shareHash = process.env.QA_CONCURRENCY_SHARE_HASH !== 'false'
const baseHash = process.env.QA_CONCURRENCY_KEY ?? `qa-concurrency-${Date.now()}`
const sampleText =
  process.env.CONCURRENCY_SAMPLE_TEXT ??
  'pengujian konkuren memastikan antrian batching dan router mampu menangani banyak permintaan'

async function runSingle(index) {
  const payload = {
    segments: [
      {
        audioHash: shareHash ? baseHash : `${baseHash}-${index}`,
        text: sampleText,
        mode: preferMode,
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
    throw new Error(`Request ${index} gagal (${res.status}): ${body}`)
  }
  const data = await res.json()
  if (!data?.results?.length) throw new Error(`Respons ${index} kosong`)
  return { elapsed, provider: data.provider, cached: data.results.some((r) => r.cached) }
}

async function main() {
  console.log(`▶️  Concurrency test ${concurrency} permintaan paralel terhadap ${baseUrl}`)
  // Warm cache dengan satu permintaan agar respons cepat dan mengisi batching
  try {
    const warm = await runSingle('warmup')
    console.log('   • warmup selesai dalam', `${warm.elapsed.toFixed(0)} ms`, 'provider', warm.provider)
  } catch (error) {
    console.warn('   • warmup gagal, tetap melanjutkan:', (error && error.message) || error)
  }
  const warmDelay = Number(process.env.QA_CONCURRENCY_WARM_DELAY ?? 300)
  if (warmDelay > 0) {
    await delay(warmDelay)
  }
  const tasks = Array.from({ length: concurrency }, (_, idx) => runSingle(idx))
  const results = await Promise.all(tasks)

  const durations = results.map((r) => r.elapsed)
  const total = durations.reduce((acc, val) => acc + val, 0)
  const avg = total / durations.length
  const max = Math.max(...durations)
  const min = Math.min(...durations)

  console.log('   • rata-rata:', `${avg.toFixed(0)} ms`)
  console.log('   • min / max:', `${min.toFixed(0)} ms / ${max.toFixed(0)} ms`)
  const cacheHits = results.filter((r) => r.cached).length
  console.log('   • respons cache di batch ini:', cacheHits)
  console.log('✅ Seluruh permintaan berhasil tanpa error HTTP')
}

main().catch((error) => {
  console.error('❌ Concurrency test gagal:', error.message)
  process.exitCode = 1
})
