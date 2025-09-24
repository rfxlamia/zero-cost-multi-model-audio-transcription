#!/usr/bin/env node
import { performance } from 'node:perf_hooks'
import { setTimeout as delay } from 'node:timers/promises'

const baseUrl = process.env.WORKER_URL ?? 'http://localhost:8787'
const scenarioArg = getArg('scenario') ?? 'primary'
const scenario = ['primary', 'fallback'].includes(scenarioArg) ? scenarioArg : 'primary'
const expectedProvider =
  scenario === 'fallback'
    ? process.env.FALLBACK_PROVIDER ?? 'huggingface'
    : process.env.PRIMARY_PROVIDER ?? 'groq'
const sampleText =
  process.env.CASCADE_SAMPLE_TEXT ??
  'hari ini kita menguji rantai fallback koreksi multi provider untuk memastikan tidak ada halusinasi'

function getArg(key) {
  const prefix = `--${key}=`
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length)
  }
  return null
}

const randomIp = () =>
  Array.from({ length: 4 }, () => Math.floor(Math.random() * 200) + 20).join('.')

async function fetchMetrics(label, attempt = 0, { fresh = false } = {}) {
  const url = new URL('/api/metrics', baseUrl)
  if (fresh) url.searchParams.set('fresh', '1')
  url.searchParams.set('t', Date.now().toString())
  let res
  try {
    res = await fetch(url, {
      headers: {
        'user-agent': `qa-provider-metric-${label}`,
        'cf-connecting-ip': randomIp(),
      },
    })
  } catch (error) {
    throw new Error(`Gagal mengambil metrics (${label}): ${(error && error.message) || error}`)
  }
  if (res.status === 429 && attempt < 3) {
    await delay(200 * (attempt + 1))
    return fetchMetrics(label, attempt + 1, { fresh })
  }
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Gagal mengambil metrics (${res.status}): ${body}`)
  }
  return res.json()
}

async function postCorrection(audioHash) {
  const payload = {
    segments: [
      {
        audioHash,
        text: sampleText,
        mode: 'quick',
      },
      {
        audioHash: `${audioHash}-1`,
        text: sampleText,
        mode: 'enhanced',
      },
    ],
  }

  const start = performance.now()
  let res
  try {
    res = await fetch(new URL('/api/correct/batch', baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': randomIp() },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    throw new Error(`Request gagal (fetch error): ${(error && error.message) || error}`)
  }
  const elapsed = performance.now() - start
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Request gagal (${res.status}): ${body}`)
  }
  const data = await res.json()
  if (!data?.results?.length) {
    throw new Error('Respons tidak memiliki results')
  }
  return { data, elapsed }
}

function detectProvider(before, after) {
  const providers = Object.keys(after?.providers ?? {})
  let best = { provider: 'none', delta: 0 }
  for (const name of providers) {
    const beforeSuccess = before?.providers?.[name]?.daily?.success ?? 0
    const afterSuccess = after?.providers?.[name]?.daily?.success ?? 0
    const delta = afterSuccess - beforeSuccess
    if (delta > best.delta) {
      best = { provider: name, delta }
    }
  }
  return best
}

async function ensureWorker() {
  try {
    const res = await fetch(new URL('/api/health', baseUrl), {
      headers: { 'cf-connecting-ip': randomIp() },
    })
    if (!res.ok) {
      throw new Error(`status ${res.status}`)
    }
  } catch (error) {
    throw new Error(
      `Tidak bisa menghubungi worker di ${baseUrl}. Pastikan worker dev running atau set WORKER_URL. Detail: ${(error && error.message) || error}`
    )
  }
}

async function main() {
  console.log(`▶️  Provider cascade test (${scenario}) terhadap ${baseUrl}`)
  const audioHashBase = `qa-provider-${Date.now()}`

  await ensureWorker()
  const metricsBefore = await fetchMetrics('before', 0, { fresh: true })
  const { data, elapsed } = await postCorrection(audioHashBase)
  await delay(600) // beri waktu update metrics
  const metricsAfter = await fetchMetrics('after', 0, { fresh: true })

  const diff = detectProvider(metricsBefore, metricsAfter)
  console.log('   • waktu respons:', `${elapsed.toFixed(0)} ms`)
  console.log('   • provider terdeteksi:', diff.provider, `(delta=${diff.delta})`)
  const cachedHits = data.results.filter((r) => r.cached).length
  console.log('   • segmen cached pada respons:', cachedHits)

  if (diff.provider === 'none' || diff.delta === 0) {
    throw new Error('Tidak ada provider yang tercatat pada metrics; pastikan kuota tersedia dan metrics fresh diaktifkan')
  }

  if (diff.provider !== expectedProvider) {
    throw new Error(
      `Provider terdeteksi ${diff.provider}, padahal skenario ${scenario} mengharapkan ${expectedProvider}. ` +
        'Pastikan konfigurasi DISABLE_* sesuai sebelum menjalankan fallback test.'
    )
  }

  console.log('✅ Provider sesuai ekspektasi skenario')
  console.log('   • gunakan --scenario=fallback setelah mematikan provider utama untuk menguji rantai berikutnya')
}

main().catch((error) => {
  console.error('❌ Provider cascade test gagal:', error.message)
  process.exitCode = 1
})
