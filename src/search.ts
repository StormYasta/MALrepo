import type { AnimeItem } from './types'

export function normalizeSearchText(value: unknown) {
  if (typeof value !== 'string') return ''
  return value
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim()
}

export function animeTitleAliases(item: AnimeItem) {
  return [...new Set(
    [item.title, ...(Array.isArray(item.aliases) ? item.aliases : [])]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim()),
  )]
}

export function animeSearchText(item: AnimeItem) {
  return normalizeSearchText([
    ...animeTitleAliases(item),
    ...item.genres,
    ...item.themes,
  ].join(' '))
}
