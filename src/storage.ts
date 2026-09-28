const FAVORITES_KEY = 'mal-sheet:favorites'
const BLACKLIST_KEY = 'mal-sheet:blacklist'
const CHALLENGE_KEY = 'mal-sheet:challenge-3x3'

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
