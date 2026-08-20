import type { AnimeItem, WatchStatus } from './types'

const API = 'https://api.jikan.moe/v4'

type JikanNamedResource = { mal_id?: number; name?: string }

type JikanAnime = {
  mal_id: number
  title: string
  url?: string
  images?: {
    jpg?: { image_url?: string; small_image_url?: string; large_image_url?: string }
    webp?: { image_url?: string; small_image_url?: string; large_image_url?: string }
  }
  aired?: { from?: string | null }
  year?: number | null
  episodes?: number | null
  score?: number | null
  genres?: JikanNamedResource[]
  explicit_genres?: JikanNamedResource[]
  themes?: JikanNamedResource[]
  demographics?: JikanNamedResource[]
}

type JikanListEntry = {
  watching_status?: number
  status?: string
  score?: number
  episodes_watched?: number
  anime: JikanAnime
}

type JikanResponse = {
  data: JikanListEntry[]
  pagination?: {
    has_next_page?: boolean
    current_page?: number
    last_visible_page?: number
  }
}

const statusByNumber: Record<number, WatchStatus> = {
  1: 'watching',
  2: 'completed',
  3: 'on_hold',
  4: 'dropped',
  6: 'plan_to_watch',
}

function normalizeStatus(entry: JikanListEntry): WatchStatus {
  if (entry.status === 'watching' || entry.status === 'completed' || entry.status === 'on_hold' || entry.status === 'dropped' || entry.status === 'plan_to_watch') {
    return entry.status
  }
  return statusByNumber[entry.watching_status ?? 6] ?? 'plan_to_watch'
}

function names(resources?: JikanNamedResource[]): string[] {
  return resources?.map((item) => item.name).filter((name): name is string => Boolean(name)) ?? []
}

function normalize(entry: JikanListEntry): AnimeItem {
  const anime = entry.anime
  const startDate = anime.aired?.from ?? null
  const genres = [...new Set([
    ...names(anime.genres),
    ...names(anime.explicit_genres),
    ...names(anime.demographics),
  ])]

  return {
    id: anime.mal_id,
    title: anime.title,
    image: anime.images?.webp?.large_image_url ?? anime.images?.jpg?.large_image_url ?? anime.images?.webp?.image_url ?? anime.images?.jpg?.image_url ?? '',
    startDate,
    year: anime.year ?? (startDate ? Number(startDate.slice(0, 4)) : null),
    episodes: anime.episodes ?? null,
    genres,
    themes: names(anime.themes),
    meanScore: anime.score ?? null,
    userScore: entry.score && entry.score > 0 ? entry.score : null,
    status: normalizeStatus(entry),
    watchedEpisodes: entry.episodes_watched ?? 0,
    url: anime.url ?? `https://myanimelist.net/anime/${anime.mal_id}`,
  }
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

  const result: AnimeItem[] = []
  let page = 1

  while (true) {
    const url = `${API}/users/${encodeURIComponent(username)}/animelist?page=${page}`
    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 404) throw new Error('Usuário não encontrado ou a lista não está pública.')
      if (response.status === 429) throw new Error('A Jikan atingiu o limite de requisições. Aguarde alguns segundos e tente novamente.')
      throw new Error(`A Jikan respondeu com erro ${response.status}.`)
    }

    const data = (await response.json()) as JikanResponse
    result.push(...data.data.map(normalize))

    if (!data.pagination?.has_next_page) break
    page += 1

    // Jikan allows 3 requests/second. Keep a small safety margin between pages.
    await new Promise((resolve) => window.setTimeout(resolve, 400))
  }

  return { username, items: result }
}
