import type { AnimeItem } from './types'

const API = 'https://graphql.anilist.co'
const CACHE_PREFIX = 'mal-sheet:discovery:'
const CACHE_TTL = 6 * 60 * 60 * 1000
const TITLE_CACHE_PREFIX = 'mal-sheet:title-aliases:'
const TITLE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000
const TITLE_IDS_PER_PAGE = 50
const TITLE_PAGES_PER_REQUEST = 8

export type DiscoveryAnime = {
  anilistId: number
  idMal: number
  title: string
  aliases: string[]
  image: string
  banner: string | null
  year: number | null
  episodes: number | null
  duration: number | null
  genres: string[]
  tags: string[]
  averageScore: number | null
  popularity: number
  format: string | null
  status: string | null
  description: string
  siteUrl: string
  studio: string | null
  match: number
  reasons: string[]
}

type AniListMedia = {
  id: number
  idMal?: number | null
  title?: { romaji?: string | null; english?: string | null; native?: string | null }
  coverImage?: { extraLarge?: string | null; large?: string | null }
  bannerImage?: string | null
  description?: string | null
  episodes?: number | null
  duration?: number | null
  genres?: string[] | null
  tags?: Array<{ name?: string | null; rank?: number | null; isMediaSpoiler?: boolean | null }> | null
  averageScore?: number | null
  popularity?: number | null
  seasonYear?: number | null
  format?: string | null
  status?: string | null
  siteUrl?: string | null
  studios?: { nodes?: Array<{ name?: string | null }> | null } | null
}

type GraphqlResponse = {
  data?: { Page?: { media?: AniListMedia[] | null } | null }
  errors?: Array<{ message?: string; status?: number }>
}

type TitleMedia = {
  idMal?: number | null
  title?: { romaji?: string | null; english?: string | null; native?: string | null }
}

type TitleQueryResponse = {
  data?: Record<string, { media?: TitleMedia[] | null } | null>
  errors?: Array<{ message?: string; status?: number }>
}

export type TasteProfile = {
  topGenres: Array<{ name: string; weight: number }>
  averageYear: number | null
  averageEpisodes: number | null
  favoriteTitles: string[]
}

function fingerprint(items: AnimeItem[]) {
  let hash = 2166136261
  const input = items.map((item) => `${item.id}:${item.userScore ?? 0}:${item.status}`).join('|')
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function itemTasteWeight(item: AnimeItem) {
  let weight = 0
  if (item.userScore !== null && item.userScore > 0) {
    weight = (item.userScore - 5) / 2.5
  } else if (item.status === 'completed') {
    weight = 0.35
  } else if (item.status === 'watching') {
    weight = 0.2
  }

  if (item.status === 'dropped') weight -= 1.25
  if (item.status === 'completed') weight *= 1.1
  return weight
}

export function buildTasteProfile(items: AnimeItem[]): TasteProfile {
  const genreWeights = new Map<string, number>()
  const weightedYears: Array<{ value: number; weight: number }> = []
  const weightedEpisodes: Array<{ value: number; weight: number }> = []

  items.forEach((item) => {
    const weight = itemTasteWeight(item)
    item.genres.forEach((genre) => genreWeights.set(genre, (genreWeights.get(genre) ?? 0) + weight))
    const positiveWeight = Math.max(0, weight)
    if (item.year && positiveWeight > 0) weightedYears.push({ value: item.year, weight: positiveWeight })
    if (item.episodes && item.episodes > 0 && item.episodes < 500 && positiveWeight > 0) {
      weightedEpisodes.push({ value: item.episodes, weight: positiveWeight })
    }
  })

  const topGenres = [...genreWeights.entries()]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([name, weight]) => ({ name, weight }))

  const weightedAverage = (values: Array<{ value: number; weight: number }>) => {
    const totalWeight = values.reduce((sum, item) => sum + item.weight, 0)
    if (!totalWeight) return null
    return values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight
  }

  const favoriteTitles = [...items]
    .filter((item) => (item.userScore ?? 0) >= 8 && item.status !== 'dropped')
    .sort((a, b) => (b.userScore ?? 0) - (a.userScore ?? 0))
    .slice(0, 8)
    .map((item) => item.title)

  return {
    topGenres,
    averageYear: weightedAverage(weightedYears),
    averageEpisodes: weightedAverage(weightedEpisodes),
    favoriteTitles,
  }
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function candidateScore(media: AniListMedia, profile: TasteProfile) {
  const mediaGenres = new Set(media.genres ?? [])
  const totalGenreWeight = Math.max(1, profile.topGenres.reduce((sum, genre) => sum + genre.weight, 0))
  const matched = profile.topGenres.filter((genre) => mediaGenres.has(genre.name))
  const genreScore = matched.reduce((sum, genre) => sum + genre.weight, 0) / totalGenreWeight

  const qualityScore = Math.max(0, Math.min(1, (media.averageScore ?? 60) / 100))
  const popularityScore = Math.max(0, Math.min(1, Math.log10(Math.max(10, media.popularity ?? 10)) / 6))

  let yearScore = 0.55
  if (profile.averageYear && media.seasonYear) {
    yearScore = Math.max(0, 1 - Math.abs(profile.averageYear - media.seasonYear) / 30)
  }

  let episodeScore = 0.55
  if (profile.averageEpisodes && media.episodes && media.episodes < 500) {
    episodeScore = Math.max(0, 1 - Math.abs(profile.averageEpisodes - media.episodes) / Math.max(24, profile.averageEpisodes * 1.5))
  }

  const raw = genreScore * 0.55 + qualityScore * 0.2 + yearScore * 0.1 + episodeScore * 0.1 + popularityScore * 0.05
  const match = Math.max(35, Math.min(99, Math.round(raw * 100)))

  const reasons: string[] = []
  if (matched.length) reasons.push(`Combina com ${matched.slice(0, 2).map((genre) => genre.name).join(' + ')}`)
  if ((media.averageScore ?? 0) >= 80) reasons.push(`AniList ${((media.averageScore ?? 0) / 10).toFixed(1)}/10`)
  if (media.episodes && profile.averageEpisodes && Math.abs(media.episodes - profile.averageEpisodes) <= 12) {
    reasons.push(`${media.episodes} eps, perto do seu padrão`)
  }
  if (media.seasonYear && profile.averageYear && Math.abs(media.seasonYear - profile.averageYear) <= 6) {
    reasons.push(`Época próxima do seu histórico`)
  }
  if (!reasons.length) reasons.push('Boa combinação geral com seu histórico')

  return { match, reasons }
}

function normalize(media: AniListMedia, profile: TasteProfile): DiscoveryAnime | null {
  if (!media.idMal) return null
  const title = media.title?.english || media.title?.romaji || media.title?.native
  if (!title) return null
  const aliases = [media.title?.english, media.title?.romaji, media.title?.native]
    .filter((value): value is string => Boolean(value))
  const { match, reasons } = candidateScore(media, profile)

  return {
    anilistId: media.id,
    idMal: media.idMal,
    title,
    aliases: [...new Set(aliases)],
    image: media.coverImage?.extraLarge || media.coverImage?.large || '',
    banner: media.bannerImage ?? null,
    year: media.seasonYear ?? null,
    episodes: media.episodes ?? null,
    duration: media.duration ?? null,
    genres: media.genres ?? [],
    tags: (media.tags ?? [])
      .filter((tag) => !tag.isMediaSpoiler && (tag.rank ?? 0) >= 60 && Boolean(tag.name))
      .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
      .slice(0, 6)
      .map((tag) => tag.name as string),
    averageScore: media.averageScore ?? null,
    popularity: media.popularity ?? 0,
    format: media.format ?? null,
    status: media.status ?? null,
    description: normalizeText(media.description).slice(0, 700),
    siteUrl: media.siteUrl || `https://anilist.co/anime/${media.id}`,
    studio: media.studios?.nodes?.find((studio) => studio.name)?.name ?? null,
    match,
    reasons,
  }
}

function readCache(key: string): DiscoveryAnime[] | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { savedAt: number; items: DiscoveryAnime[] }
    if (!Array.isArray(parsed.items) || Date.now() - parsed.savedAt > CACHE_TTL) {
      localStorage.removeItem(key)
      return null
    }
    return parsed.items
  } catch {
    return null
  }
}

function writeCache(key: string, items: DiscoveryAnime[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), items }))
  } catch {
    // Discovery cache is optional.
  }
}

export async function fetchDiscoveryAnime(items: AnimeItem[], username = 'guest', force = false): Promise<{ items: DiscoveryAnime[]; profile: TasteProfile }> {
  const profile = buildTasteProfile(items)
  const excluded = [...new Set(items.map((item) => item.id))]
  const genres = profile.topGenres.map((genre) => genre.name).slice(0, 6)
  const cacheKey = `${CACHE_PREFIX}${username.toLowerCase()}:${fingerprint(items)}`

  if (!force) {
    const cached = readCache(cacheKey)
    if (cached) return { items: cached, profile }
  }

  const query = `
    query Discovery($genres: [String], $excluded: [Int]) {
      Page(page: 1, perPage: 50) {
        media(
          type: ANIME
          isAdult: false
          genre_in: $genres
          idMal_not_in: $excluded
          averageScore_greater: 60
          sort: [SCORE_DESC, POPULARITY_DESC]
        ) {
          id
          idMal
          title { romaji english native }
          coverImage { extraLarge large }
          bannerImage
          description
          episodes
          duration
          genres
          tags { name rank isMediaSpoiler }
          averageScore
          popularity
          seasonYear
          format
          status
          siteUrl
          studios(isMain: true) { nodes { name } }
        }
      }
    }
  `

  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables: { genres: genres.length ? genres : null, excluded } }),
  })

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    throw new Error(`A AniList atingiu o limite de consultas. Tente novamente${retryAfter ? ` em ${retryAfter}s` : ' em instantes'}.`)
  }

  if (!response.ok) throw new Error(`A AniList respondeu com erro ${response.status}.`)

  const payload = (await response.json()) as GraphqlResponse
  if (payload.errors?.length) throw new Error(payload.errors[0]?.message || 'A AniList retornou um erro inesperado.')

  const normalized = (payload.data?.Page?.media ?? [])
    .map((media) => normalize(media, profile))
    .filter((media): media is DiscoveryAnime => Boolean(media))
    .filter((media) => !excluded.includes(media.idMal))
    .sort((a, b) => b.match - a.match || (b.averageScore ?? 0) - (a.averageScore ?? 0))

  writeCache(cacheKey, normalized)
  return { items: normalized, profile }
}


function readTitleAliasCache(id: number): string[] | null {
  try {
    const raw = localStorage.getItem(`${TITLE_CACHE_PREFIX}${id}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { savedAt: number; aliases: string[] }
    if (!Array.isArray(parsed.aliases) || Date.now() - parsed.savedAt > TITLE_CACHE_TTL) {
      localStorage.removeItem(`${TITLE_CACHE_PREFIX}${id}`)
      return null
    }
    return parsed.aliases
  } catch {
    return null
  }
}

function writeTitleAliasCache(id: number, aliases: string[]) {
  try {
    localStorage.setItem(`${TITLE_CACHE_PREFIX}${id}`, JSON.stringify({ savedAt: Date.now(), aliases }))
  } catch {
    // Title cache is optional.
  }
}

function titleAliases(media: TitleMedia) {
  return [...new Set([
    media.title?.english,
    media.title?.romaji,
    media.title?.native,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim()))]
}

async function fetchTitleAliasPages(ids: number[]): Promise<Map<number, string[]>> {
  const pages: number[][] = []
  for (let index = 0; index < ids.length; index += TITLE_IDS_PER_PAGE) {
    pages.push(ids.slice(index, index + TITLE_IDS_PER_PAGE))
  }

  const result = new Map<number, string[]>()

  for (let groupStart = 0; groupStart < pages.length; groupStart += TITLE_PAGES_PER_REQUEST) {
    const group = pages.slice(groupStart, groupStart + TITLE_PAGES_PER_REQUEST)
    const declarations = group.map((_, index) => `$ids${index}: [Int]`).join(', ')
    const fields = group.map((_, index) => `
      p${index}: Page(page: 1, perPage: ${TITLE_IDS_PER_PAGE}) {
        media(type: ANIME, idMal_in: $ids${index}) {
          idMal
          title { romaji english native }
        }
      }
    `).join('\n')

    const query = `query TitleAliases(${declarations}) { ${fields} }`
    const variables = Object.fromEntries(group.map((pageIds, index) => [`ids${index}`, pageIds]))

    const response = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    })

    if (response.status === 429) {
      throw new Error('A AniList atingiu o limite de consultas ao carregar títulos alternativos.')
    }
    if (!response.ok) {
      throw new Error(`A AniList respondeu com erro ${response.status} ao carregar títulos alternativos.`)
    }

    const payload = (await response.json()) as TitleQueryResponse
    if (payload.errors?.length) {
      throw new Error(payload.errors[0]?.message || 'A AniList retornou um erro ao carregar títulos alternativos.')
    }

    Object.values(payload.data ?? {}).forEach((page) => {
      ;(page?.media ?? []).forEach((media) => {
        if (!media.idMal) return
        const aliases = titleAliases(media)
        if (!aliases.length) return
        result.set(media.idMal, aliases)
        writeTitleAliasCache(media.idMal, aliases)
      })
    })
  }

  return result
}

export async function fetchAnimeTitleAliases(items: AnimeItem[]): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>()
  const missing: number[] = []

  items.forEach((item) => {
    const cached = readTitleAliasCache(item.id)
    const current = [...new Set([item.title, ...(item.aliases ?? []), ...(cached ?? [])].filter(Boolean))]
    result.set(item.id, current)
    if (!cached) missing.push(item.id)
  })

  if (!missing.length) return result

  try {
    const fetched = await fetchTitleAliasPages([...new Set(missing)])
    fetched.forEach((aliases, id) => {
      const current = result.get(id) ?? []
      result.set(id, [...new Set([...current, ...aliases])])
    })
  } catch {
    // Keep MAL titles and any aliases already cached if AniList is temporarily unavailable.
  }

  return result
}
