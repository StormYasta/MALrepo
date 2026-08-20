import type { AnimeItem, WatchStatus } from './types'

const API = 'https://api.myanimelist.net/v2'
const fields = 'id,title,main_picture,start_date,num_episodes,genres,mean,my_list_status'

type MalNode = {
  id: number
  title: string
  main_picture?: { medium?: string; large?: string }
  start_date?: string
  num_episodes?: number
  genres?: Array<{ id: number; name: string }>
  mean?: number
  my_list_status?: { status: WatchStatus; score: number; num_episodes_watched: number }
}

type MalListResponse = {
  data: Array<{ node: MalNode }>
  paging?: { next?: string }
}

function normalize(node: MalNode): AnimeItem {
  return {
    id: node.id,
    title: node.title,
    image: node.main_picture?.large ?? node.main_picture?.medium ?? '',
    startDate: node.start_date ?? null,
    year: node.start_date ? Number(node.start_date.slice(0, 4)) : null,
    episodes: node.num_episodes || null,
    genres: node.genres?.map((genre) => genre.name) ?? [],
    themes: [],
    meanScore: node.mean ?? null,
    userScore: node.my_list_status?.score ?? null,
    status: node.my_list_status?.status ?? 'plan_to_watch',
    watchedEpisodes: node.my_list_status?.num_episodes_watched ?? 0,
    url: `https://myanimelist.net/anime/${node.id}`,
  }
}

export async function fetchUserAnimeList(username: string, clientId: string): Promise<AnimeItem[]> {
  if (!username.trim()) throw new Error('Informe um usuário do MyAnimeList.')
  if (!clientId.trim()) throw new Error('Informe seu MAL Client ID.')

  let url: string | undefined = `${API}/users/${encodeURIComponent(username.trim())}/animelist?limit=1000&fields=${encodeURIComponent(fields)}`
  const result: AnimeItem[] = []

  while (url) {
    const response = await fetch(url, { headers: { 'X-MAL-CLIENT-ID': clientId.trim() } })
    if (!response.ok) {
      if (response.status === 404) throw new Error('Usuário não encontrado ou lista indisponível.')
      if (response.status === 401 || response.status === 403) throw new Error('Client ID inválido ou acesso não autorizado.')
      throw new Error(`A API do MyAnimeList respondeu com erro ${response.status}.`)
    }

    const page = (await response.json()) as MalListResponse
    result.push(...page.data.map(({ node }) => normalize(node)))
    url = page.paging?.next
  }

  return result
}
