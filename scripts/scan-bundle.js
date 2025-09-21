#!/usr/bin/env node
import { existsSync, statSync, readdirSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

const defaultTargets = process.argv.slice(2)
const targets = defaultTargets.length > 0 ? defaultTargets : ['apps/web/.next', 'apps/web/out', 'apps/web/public']
const patterns = [/GROQ_/g, /HF_/g, /APP_SECRET/g, /TURNSTILE/g]

const walk = (root) => {
  const files = []
  const stack = [root]
  while (stack.length) {
    const current = stack.pop()
    if (!current) continue
    let stats
    try {
      stats = statSync(current)
    } catch (error) {
      continue
    }
    if (stats.isDirectory()) {
      for (const entry of readdirSync(current)) {
        stack.push(join(current, entry))
      }
    } else if (stats.isFile()) {
      files.push(current)
    }
  }
  return files
}

const matches = []

for (const target of targets) {
  const absolute = resolve(target)
  if (!existsSync(absolute)) {
    continue
  }
  for (const file of walk(absolute)) {
    const content = readFileSync(file, 'utf-8')
    for (const pattern of patterns) {
      pattern.lastIndex = 0
      if (pattern.test(content)) {
        matches.push({ file, pattern: pattern.source })
      }
    }
  }
}

if (matches.length > 0) {
  console.error('[scan:bundle] Sensitive tokens detected:')
  for (const match of matches) {
    console.error(` - ${match.pattern} in ${match.file}`)
  }
  process.exit(1)
}

console.log('[scan:bundle] No sensitive tokens found.')
