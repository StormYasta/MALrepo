import type { AnimeItem, WatchStatus } from './types'

const PAGE_SIZE = 300

type MalNamedResource = { name?: string }
type MalSeason = { year?: number | string }

type MalListEntry = {
  status?: number
  score?: number
  tags?: unknown
  num_watched_episodes?: number
  anime_title?: string
  anime_num_episodes?: number
  anime_id?: number
  anime_image_path?: string
  anime_url?: string
  anime_start_date_string?: string | null
  anime_season?: MalSeason | null
  genres?: unknown
}

const statusByNumber: Record<number, WatchStatus> = {
  1: 'watching',
  2: 'completed',
  3: 'on_hold',
  4: 'dropped',
  6: 'plan_to_watch',
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function normalizeNames(value: unknown): string[] {
  if (!value) return []

  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((item) => {
      if (typeof item === 'string') return [item.trim()]
      if (item && typeof item === 'object' && 'name' in item) {
        const name = (item as MalNamedResource).name
        return name ? [name.trim()] : []
      }
      return []
    }).filter(Boolean))]
  }

  if (typeof value === 'string') {
    return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]
  }

  return []
}

function parseTags(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value.split(',').map((tag) => tag.trim()).filter(Boolean)
}

function parseYear(entry: MalListEntry): number | null {
  const seasonYear = Number(entry.anime_season?.year)
  if (Number.isFinite(seasonYear) && seasonYear > 1900) return seasonYear

  const date = entry.anime_start_date_string
  if (!date) return null

  const fullYear = date.match(/(?:19|20)\d{2}/)?.[0]
  if (fullYear) return Number(fullYear)

  const match = date.match(/(\d{2})$/)
  if (!match) return null

  const shortYear = Number(match[1])
  return shortYear < 50 ? 2000 + shortYear : 1900 + shortYear
}

function normalize(entry: MalListEntry): AnimeItem | null {
  if (!entry.anime_id || !entry.anime_title) return null

  return {
    id: entry.anime_id,
    title: entry.anime_title,
    image: entry.anime_image_path ?? '',
    startDate: entry.anime_start_date_string ?? null,
    year: parseYear(entry),
    episodes: entry.anime_num_episodes || null,
    genres: normalizeNames(entry.genres),
    themes: parseTags(entry.tags),
    meanScore: null,
    userScore: entry.score && entry.score > 0 ? entry.score : null,
    status: statusByNumber[entry.status ?? 6] ?? 'plan_to_watch',
    watchedEpisodes: entry.num_watched_episodes ?? 0,
    url: entry.anime_url
      ? (entry.anime_url.startsWith('http') ? entry.anime_url : `https://myanimelist.net${entry.anime_url}`)
      : `https://myanimelist.net/anime/${entry.anime_id}`,
  }
}

function proxyUrls(targetUrl: string): string[] {
  return [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    `https://proxy.cors.sh/${targetUrl}`,
  ]
}

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

async function fetchMalPage(targetUrl: string): Promise<MalListEntry[]> {
  let lastStatus = 0

  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const proxyUrl of proxyUrls(targetUrl)) {
      try {
        const response = await fetchWithTimeout(proxyUrl)
        lastStatus = response.status

        if (response.ok) {
          const data = await response.json()
          if (!Array.isArray(data)) continue
          return data as MalListEntry[]
        }

        // A proxy can reject a target that another proxy accepts, so try the next provider.
        if (response.status === 403 || response.status === 429 || response.status >= 500) continue
      } catch {
        // Certificate, DNS, timeout and CORS failures are provider-specific. Try the fallback.
        continue
      }
    }

    await sleep(1000 * 2 ** attempt)
  }

  if (lastStatus === 404) throw new Error('Usuário não encontrado ou lista indisponível.')
  if (lastStatus === 403) throw new Error('A lista não pôde ser acessada. Confirme se ela está pública.')
  if (lastStatus === 429) throw new Error('Muitas consultas em sequência. Aguarde alguns segundos e tente novamente.')
  throw new Error('Não foi possível acessar a lista pública do MyAnimeList pelos proxies disponíveis. Tente novamente em alguns segundos.')
}

export function extractMalUsername(input: string): string {
  const value = input.trim()
  if (!value) return ''

  try {
    const url = new URL(value)
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[0] === 'animelist' && parts[1]) return decodeURIComponent(parts[1])
    if (parts[0] === 'profile' && parts[1]) return decodeURIComponent(parts[1])
  } catch {
    // Not a URL; treat the value as a username.
  }

  return value.replace(/^@/, '').trim()
}

export async function fetchUserAnimeList(input: string): Promise<{ username: string; items: AnimeItem[] }> {
  const username = extractMalUsername(input)
  if (!username) throw new Error('Informe o usuário ou cole o link da sua lista do MyAnimeList.')

  const items: AnimeItem[] = []
  let offset = 0

  for (let page = 0; page < 20; page += 1) {
    const target = `https://myanimelist.net/animelist/${encodeURIComponent(username)}/load.json?offset=${offset}&status=7`
    const data = await fetchMalPage(target)

    for (const entry of data) {
      const normalized = normalize(entry)
      if (normalized) items.push(normalized)
    }

    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
    await sleep(900)
  }

  if (items.length === 0) {
    throw new Error('A lista está vazia, privada ou o usuário não foi encontrado.')
  }

  return { username, items }
}
