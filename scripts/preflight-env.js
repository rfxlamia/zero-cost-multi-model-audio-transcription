#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, statSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REQUIRED_SECRETS = ['APP_SECRET', 'GROQ_API_KEY', 'HF_API_TOKEN', 'TURNSTILE_SECRET']

const log = (...args) => console.log('[preflight]', ...args)
const fail = (message) => {
  console.error('[preflight:error]', message)
  process.exit(1)
}

log('Checking wrangler secrets...')
const wrangler = spawnSync('wrangler', ['secret', 'list', '--config', 'apps/worker/wrangler.toml'], {
  encoding: 'utf-8',
  stdio: ['ignore', 'pipe', 'pipe']
})

if (wrangler.status !== 0) {
  fail(`wrangler secret list failed. stderr: ${wrangler.stderr.trim()}`)
}

const secretReport = `${wrangler.stdout}\n${wrangler.stderr}`
const missingSecrets = REQUIRED_SECRETS.filter((secret) => !secretReport.includes(secret))
if (missingSecrets.length > 0) {
  fail(`Missing secrets: ${missingSecrets.join(', ')}. Ensure they are set via wrangler secret put.`)
}

log('Validating built artifacts are free from secrets...')
const scanRoots = ['apps/web/.next', 'apps/web/out']
const secretValues = REQUIRED_SECRETS.map((key) => process.env[key]).filter(
  (value) => typeof value === 'string' && value.trim().length >= 6
)
const bannedTokens = REQUIRED_SECRETS.concat(secretValues)

const walkFiles = (root) => {
  const files = []
  const stack = [root]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    let stats
    try {
      stats = statSync(current)
    } catch (error) {
      continue
    }
    if (stats.isDirectory()) {
      const entries = readdirSync(current)
      for (const entry of entries) {
        stack.push(join(current, entry))
      }
    } else if (stats.isFile()) {
      files.push(current)
    }
  }
  return files
}

for (const root of scanRoots) {
  const resolved = resolve(root)
  if (!existsSync(resolved)) {
    continue
  }
  const files = walkFiles(resolved)
  for (const file of files) {
    if (file.includes(`${resolve('apps/web/.next')}/cache/webpack/`)) continue
    if (file.includes('client-development/') || file.includes('server-development/')) continue
    if (file.endsWith('.gz') || file.endsWith('.br') || file.endsWith('.map')) continue
    const content = readFileSync(file, 'utf-8')
    for (const token of bannedTokens) {
      if (content.includes(token)) {
        fail(`Sensitive token ${token} found in ${file}`)
      }
    }
  }
}

log('All checks passed')
