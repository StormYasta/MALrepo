export type WatchStatus = 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch'

export interface AnimeItem {
  id: number
  title: string
  image: string
  startDate: string | null
  year: number | null
  episodes: number | null
  genres: string[]
  themes: string[]
  meanScore: number | null
  userScore: number | null
  status: WatchStatus
  watchedEpisodes: number
  url: string
}

export type SortKey = 'title' | 'year' | 'episodes' | 'meanScore' | 'userScore' | 'progress'
export type SortDirection = 'asc' | 'desc'
