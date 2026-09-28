const FAVORITES_KEY = 'mal-sheet:favorites'
const BLACKLIST_KEY = 'mal-sheet:blacklist'
const CHALLENGE_KEY = 'mal-sheet:challenge-3x3'
const DISCOVERY_QUEUE_KEY = 'mal-sheet:discovery-queue'
const LAST_USER_KEY = 'mal-sheet:last-user'
const GUESS_STATS_KEY = 'mal-sheet:aniguessr-stats'

function readNumberSet(key: string): Set<number> {
  try {
    const raw = localStorage.getItem(key)
    const values = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(values) ? values.filter((v) => Number.isFinite(v)).map(Number) : [])
  } catch {
    return new Set()
  }
}

function writeNumberSet(key: string, values: Set<number>) {
  try {
    localStorage.setItem(key, JSON.stringify([...values]))
  } catch {
    // Local preferences are optional.
  }
}

export function getFavorites() { return readNumberSet(FAVORITES_KEY) }
export function getBlacklist() { return readNumberSet(BLACKLIST_KEY) }
export function getDiscoveryQueue() { return readNumberSet(DISCOVERY_QUEUE_KEY) }

export function toggleFavorite(id: number): Set<number> {
  const values = getFavorites()
  values.has(id) ? values.delete(id) : values.add(id)
  writeNumberSet(FAVORITES_KEY, values)
  return values
}

export function toggleBlacklist(id: number): Set<number> {
  const values = getBlacklist()
  values.has(id) ? values.delete(id) : values.add(id)
  writeNumberSet(BLACKLIST_KEY, values)
  return values
}

export function toggleDiscoveryQueue(id: number): Set<number> {
  const values = getDiscoveryQueue()
  values.has(id) ? values.delete(id) : values.add(id)
  writeNumberSet(DISCOVERY_QUEUE_KEY, values)
  return values
}

export function getLastUser(): string {
  try { return localStorage.getItem(LAST_USER_KEY)?.trim() ?? '' } catch { return '' }
}

export function setLastUser(username: string) {
  try {
    if (username.trim()) localStorage.setItem(LAST_USER_KEY, username.trim())
    else localStorage.removeItem(LAST_USER_KEY)
  } catch {
    // Remembering the user is optional.
  }
}

export type GuessStats = {
  bestStreak: number
  bestRoundScore: number
  totalScore: number
  correct: number
  rounds: number
}

export function loadGuessStats(): GuessStats {
  const fallback: GuessStats = { bestStreak: 0, bestRoundScore: 0, totalScore: 0, correct: 0, rounds: 0 }
  try {
    const raw = localStorage.getItem(GUESS_STATS_KEY)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as Partial<GuessStats>) }
  } catch {
    return fallback
  }
}

export function saveGuessStats(stats: GuessStats) {
  try { localStorage.setItem(GUESS_STATS_KEY, JSON.stringify(stats)) } catch { /* optional */ }
}

export type ChallengeState = { ids: number[]; done: number[] }

export function loadChallenge(): ChallengeState | null {
  try {
    const raw = localStorage.getItem(CHALLENGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ChallengeState
    return Array.isArray(parsed.ids) && Array.isArray(parsed.done) ? parsed : null
  } catch {
    return null
  }
}

export function saveChallenge(state: ChallengeState) {
  try { localStorage.setItem(CHALLENGE_KEY, JSON.stringify(state)) } catch { /* optional */ }
}
