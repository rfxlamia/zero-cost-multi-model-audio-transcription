export type FaithfulnessOptions = {
  minSharedRatio?: number
  maxNovelSequence?: number
}

export type FaithfulnessReport = {
  score: number
  accepted: boolean
  novelPhrases: string[]
}

const tokenize = (input: string): string[] => {
  if (!input) return []
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/g)
    .filter(Boolean)
}

const collectNovelPhrases = (
  words: string[],
  originalSet: Set<string>,
  maxNovelSequence: number
): string[] => {
  const phrases: string[] = []
  let buffer: string[] = []
  for (const word of words) {
    if (originalSet.has(word)) {
      if (buffer.length >= maxNovelSequence) {
        phrases.push(buffer.join(' '))
      }
      buffer = []
      continue
    }
    buffer.push(word)
  }
  if (buffer.length >= maxNovelSequence) {
    phrases.push(buffer.join(' '))
  }
  return phrases
}

export function evaluateFaithfulness(
  original: string,
  corrected: string,
  options: FaithfulnessOptions = {}
): FaithfulnessReport {
  const minSharedRatio = options.minSharedRatio ?? 0.9
  const maxNovelSequence = options.maxNovelSequence ?? 5

  const originalWords = tokenize(original)
  const correctedWords = tokenize(corrected)

  if (!correctedWords.length) {
    return { score: 1, accepted: true, novelPhrases: [] }
  }

  if (!originalWords.length) {
    // Nothing to compare against; treat as neutral and rely on downstream moderation.
    return { score: 0, accepted: false, novelPhrases: [correctedWords.join(' ')] }
  }

  const originalSet = new Set(originalWords)
  let overlap = 0
  for (const word of correctedWords) {
    if (originalSet.has(word)) overlap += 1
  }

  const score = overlap / correctedWords.length
  const novelPhrases = collectNovelPhrases(correctedWords, originalSet, maxNovelSequence)
  const accepted = score >= minSharedRatio && novelPhrases.length === 0

  return {
    score: Number(score.toFixed(4)),
    accepted,
    novelPhrases,
  }
}
