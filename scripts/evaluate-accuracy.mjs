#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const transcriptsDir = resolve('tests/fixtures/audio/gold/transcripts')

const tokenize = (text = '') =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/g)
    .filter(Boolean)

const levenshtein = (sourceTokens, targetTokens) => {
  const rows = sourceTokens.length + 1
  const cols = targetTokens.length + 1
  const dp = Array.from({ length: rows }, () => new Array(cols).fill(0))
  for (let i = 0; i < rows; i += 1) dp[i][0] = i
  for (let j = 0; j < cols; j += 1) dp[0][j] = j
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = sourceTokens[i - 1] === targetTokens[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }
  return dp[rows - 1][cols - 1]
}

const punctuationCounts = (text = '') => {
  const counts = new Map()
  for (const char of text) {
    if (',.;:!?'.includes(char)) {
      counts.set(char, (counts.get(char) || 0) + 1)
    }
  }
  return counts
}

const f1Score = (reference, candidate) => {
  let tp = 0
  let refTotal = 0
  let candTotal = 0
  for (const [char, count] of reference.entries()) {
    refTotal += count
    if (candidate.has(char)) {
      tp += Math.min(count, candidate.get(char))
    }
  }
  for (const count of candidate.values()) candTotal += count
  if (refTotal === 0 && candTotal === 0) return 1
  if (tp === 0) return 0
  const precision = tp / candTotal
  const recall = tp / refTotal
  if (precision === 0 || recall === 0) return 0
  return (2 * precision * recall) / (precision + recall)
}

const loadTranscripts = async () => {
  const files = await readdir(transcriptsDir)
  return files.filter((file) => file.endsWith('.json'))
}

const evaluateCandidate = (referenceText, candidateText) => {
  const refTokens = tokenize(referenceText)
  const hypTokens = tokenize(candidateText)
  const errors = levenshtein(refTokens, hypTokens)
  const wer = refTokens.length ? errors / refTokens.length : 0
  const refs = punctuationCounts(referenceText)
  const cands = punctuationCounts(candidateText)
  const punctF1 = f1Score(refs, cands)
  return { wer, punctF1 }
}

const aggregateMetrics = (records) => {
  const summary = new Map()
  for (const record of records) {
    for (const [variant, metrics] of Object.entries(record.metrics)) {
      if (!summary.has(variant)) {
        summary.set(variant, { wer: [], punctF1: [] })
      }
      summary.get(variant).wer.push(metrics.wer)
      summary.get(variant).punctF1.push(metrics.punctF1)
    }
  }
  const average = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0)
  return Array.from(summary.entries()).map(([variant, values]) => ({
    variant,
    avgWer: average(values.wer),
    avgPunctF1: average(values.punctF1),
  }))
}

const main = async () => {
  const files = await loadTranscripts()
  if (!files.length) {
    console.warn('[accuracy] No transcript files found in', transcriptsDir)
    process.exit(0)
  }

  const records = []
  for (const file of files) {
    const payload = JSON.parse(await readFile(resolve(transcriptsDir, file), 'utf-8'))
    const reference = payload.reference || payload.target || ''
    if (!reference) {
      console.warn(`[accuracy] ${file} missing reference text, skipping`)
      continue
    }
    const variants = payload.candidates || payload.hypotheses || {}
    const metricsObj = {}
    for (const [variant, text] of Object.entries(variants)) {
      if (typeof text !== 'string' || !text.trim()) continue
      metricsObj[variant] = evaluateCandidate(reference, text)
    }
    records.push({ id: payload.id || file.replace(/\.json$/, ''), metrics: metricsObj })
  }

  const aggregates = aggregateMetrics(records)
  console.log('\nAccuracy Metrics (averages):')
  console.table(
    aggregates.map((row) => ({
      variant: row.variant,
      wer: row.avgWer.toFixed(3),
      punctuationF1: row.avgPunctF1.toFixed(3),
    }))
  )

  const enhanced = aggregates.find((row) => row.variant === 'enhanced')
  const quick = aggregates.find((row) => row.variant === 'quick')

  const passesWer = enhanced ? enhanced.avgWer <= 0.2 : false
  const passesPunct = enhanced ? enhanced.avgPunctF1 >= 0.8 : false
  const quickWithinTarget = quick ? quick.avgWer <= 0.2 : false

  console.log('\nGo/No-Go Evaluation:')
  console.log(` - Enhanced WER <= 0.20: ${passesWer ? '✅' : '❌'}`)
  console.log(` - Enhanced punctuation F1 >= 0.80: ${passesPunct ? '✅' : '❌'}`)
  console.log(` - Quick WER <= 0.20 target: ${quickWithinTarget ? '✅' : '❌'}`)

  if (!passesWer || !passesPunct || !quickWithinTarget) {
    process.exitCode = 1
  }
}

await main().catch((error) => {
  console.error('[accuracy] Evaluation failed:', error)
  process.exit(1)
})
