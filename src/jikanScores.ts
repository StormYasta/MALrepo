const API = 'https://api.jikan.moe/v4'
const CACHE_PREFIX = 'mal-sheet-score:'
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const REQUEST_INTERVAL = 1100

type CacheEntry = {
  score: number
  savedAt: number
}

type JikanAnimeResponse = {
  data?: {
    score?: number | null
  }
}

const pending = new Map<number, Promise<number | null>>()
let queue: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function readCache(id: number): number | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${id}`)
    if (!raw) return null

    const entry = JSON.parse(raw) as CacheEntry
    if (!Number.isFinite(entry.score) || Date.now() - entry.savedAt > CACHE_TTL) {
      localStorage.removeItem(`${CACHE_PREFIX}${id}`)
      return null
    }

    return entry.score
  } catch {
    return null
  }
}

function writeCache(id: number, score: number) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${id}`, JSON.stringify({ score, savedAt: Date.now() } satisfies CacheEntry))
  } catch {
    // Cache is optional; private browsing/storage restrictions should not break the app.
  }
}

function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const elapsed = Date.now() - lastRequestAt
    if (elapsed < REQUEST_INTERVAL) await sleep(REQUEST_INTERVAL - elapsed)
    lastRequestAt = Date.now()
    return task()
  })

  queue = run.then(() => undefined, () => undefined)
  return run
}

export async function fetchAnimeMeanScore(id: number): Promise<number | null> {
  const cached = readCache(id)
  if (cached !== null) return cached

  const existing = pending.get(id)
  if (existing) return existing

  const request = schedule(async () => {
    const response = await fetch(`${API}/anime/${id}`)
    if (!response.ok) return null

    const payload = (await response.json()) as JikanAnimeResponse
    const score = payload.data?.score

    if (typeof score === 'number' && Number.isFinite(score)) {
      writeCache(id, score)
      return score
    }

    return null
  }).finally(() => pending.delete(id))

  pending.set(id, request)
  return request
}
