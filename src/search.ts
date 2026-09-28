import type { AnimeItem } from './types'

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim()
}

export function animeTitleAliases(item: AnimeItem) {
  return [...new Set([item.title, ...(item.aliases ?? [])].filter(Boolean))]
}

export function animeSearchText(item: AnimeItem) {
  return normalizeSearchText([
    ...animeTitleAliases(item),
    ...item.genres,
    ...item.themes,
  ].join(' '))
}
