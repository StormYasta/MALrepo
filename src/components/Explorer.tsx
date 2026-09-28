import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownUp, Ban, Bookmark, Check, Copy, ExternalLink, Filter, Search, SlidersHorizontal, Star, X } from 'lucide-react'
import { fetchAnimeMeanScore } from '../jikanScores'
import { animeSearchText, normalizeSearchText } from '../search'
import { getBlacklist, getFavorites, toggleBlacklist, toggleFavorite } from '../storage'
import type { AnimeItem, SortDirection, SortKey, WatchStatus } from '../types'

const statusLabels: Record<WatchStatus, string> = {
  watching: 'Assistindo', completed: 'Completo', on_hold: 'Em espera', dropped: 'Abandonado', plan_to_watch: 'Planejo assistir',
}

type Props = {
  anime: AnimeItem[]
  username: string
  source: 'demo' | 'mal'
  onScore: (id: number, score: number) => void
}

type Preset = 'short' | 'great' | 'classic' | 'plan'

export function Explorer({ anime, username, source, onScore }: Props) {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [genre, setGenre] = useState(params.get('genre') ?? 'all')
  const [status, setStatus] = useState<'all' | WatchStatus>((params.get('status') as WatchStatus | null) ?? 'all')
  const [yearFrom, setYearFrom] = useState(params.get('from') ?? '')
  const [yearTo, setYearTo] = useState(params.get('to') ?? '')
  const [episodesMax, setEpisodesMax] = useState(params.get('eps') ?? '')
  const [scoreMin, setScoreMin] = useState(params.get('score') ?? '')
  const [sortKey, setSortKey] = useState<SortKey>('userScore')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [favorites, setFavorites] = useState(() => getFavorites())
  const [blacklist, setBlacklist] = useState(() => getBlacklist())
  const [copied, setCopied] = useState(false)

  const genres = useMemo(() => [...new Set(anime.flatMap((item) => item.genres))].sort(), [anime])

  const filtered = useMemo(() => {
    const query = normalizeSearchText(search)
    const result = anime.filter((item) => {
      const text = animeSearchText(item)
      if (query && !text.includes(query)) return false
      if (genre !== 'all' && !item.genres.includes(genre)) return false
      if (status !== 'all' && item.status !== status) return false
      if (yearFrom && (item.year ?? 0) < Number(yearFrom)) return false
      if (yearTo && (item.year ?? 9999) > Number(yearTo)) return false
      if (episodesMax && item.episodes !== null && item.episodes > Number(episodesMax)) return false
      if (scoreMin && (item.userScore ?? 0) < Number(scoreMin)) return false
      return true
    })

    return [...result].sort((a, b) => {
      const value = (item: AnimeItem): string | number => {
        if (sortKey === 'progress') return item.episodes ? item.watchedEpisodes / item.episodes : item.watchedEpisodes
        if (sortKey === 'delta') return item.userScore !== null && item.meanScore !== null ? item.userScore - item.meanScore : (sortDirection === 'asc' ? 999 : -999)
        return item[sortKey] ?? (sortDirection === 'asc' ? Number.MAX_SAFE_INTEGER : -1)
      }
      const av = value(a), bv = value(b)
      const comparison = typeof av === 'string' ? av.localeCompare(String(bv)) : Number(av) - Number(bv)
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [anime, search, genre, status, yearFrom, yearTo, episodesMax, scoreMin, sortKey, sortDirection])

  useEffect(() => {
    const next = new URLSearchParams(window.location.search)
    const set = (key: string, value: string, fallback = '') => value && value !== fallback ? next.set(key, value) : next.delete(key)
    set('q', search)
    set('genre', genre, 'all')
    set('status', status, 'all')
    set('from', yearFrom)
    set('to', yearTo)
    set('eps', episodesMax)
    set('score', scoreMin)
    const query = next.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
  }, [search, genre, status, yearFrom, yearTo, episodesMax, scoreMin])

  function clearFilters() {
    setSearch(''); setGenre('all'); setStatus('all'); setYearFrom(''); setYearTo(''); setEpisodesMax(''); setScoreMin('')
  }

  function applyPreset(preset: Preset) {
    clearFilters()
    if (preset === 'short') { setStatus('plan_to_watch'); setEpisodesMax('24') }
    if (preset === 'great') { setScoreMin('8') }
    if (preset === 'classic') setYearTo('2009')
    if (preset === 'plan') setStatus('plan_to_watch')
  }

  function changeSort(key: SortKey) {
    if (sortKey === key) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDirection(key === 'title' ? 'asc' : 'desc') }
  }

  async function shareFilters() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard can be unavailable on some browsers; the URL is already updated.
    }
  }

  return <section className="workspace explorer-workspace">
    <div className="workspace-title">
      <div><h2>Explorer</h2><span><b>{filtered.length}</b> de {anime.length} títulos · {source === 'demo' ? 'Modo demonstração' : `Lista de ${username}`}</span></div>
      <div className="workspace-actions"><button className="clear" onClick={shareFilters}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'Copiado' : 'Compartilhar visão'}</button><button className="clear" onClick={clearFilters}><X size={15}/> Limpar filtros</button></div>
    </div>

    <div className="preset-row">
      <span>Atalhos</span>
      <button onClick={() => applyPreset('short')}>🍿 Curto pra hoje</button>
      <button onClick={() => applyPreset('great')}>🔥 Só pedrada</button>
      <button onClick={() => applyPreset('classic')}>📼 Clássicos</button>
      <button onClick={() => applyPreset('plan')}>🧭 Minha fila</button>
    </div>

    <div className="toolbar">
      <div className="search"><Search size={18}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar em inglês, japonês, gênero ou tag..."/></div>
      <div className="filter-label"><SlidersHorizontal size={17}/> Filtros</div>
      <select value={genre} onChange={(e) => setGenre(e.target.value)}><option value="all">Todos os gêneros</option>{genres.map((g) => <option key={g}>{g}</option>)}</select>
      <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | WatchStatus)}><option value="all">Todos os status</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
    </div>

    <div className="advanced">
      <Filter size={15}/><span>Ano</span><input inputMode="numeric" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} placeholder="De"/><span>—</span><input inputMode="numeric" value={yearTo} onChange={(e) => setYearTo(e.target.value)} placeholder="Até"/>
      <span>Máx. episódios</span><input inputMode="numeric" value={episodesMax} onChange={(e) => setEpisodesMax(e.target.value)} placeholder="Ex: 24"/>
      <span>Minha nota mínima</span><select value={scoreMin} onChange={(e) => setScoreMin(e.target.value)}><option value="">Qualquer</option>{[10,9,8,7,6,5,4,3,2,1].map((n) => <option key={n} value={n}>{n}+</option>)}</select>
    </div>

    <div className="table-wrap"><table><thead><tr>
      <th>Anime</th><SortHead label="Ano" value="year" current={sortKey} onClick={changeSort}/><SortHead label="Episódios" value="episodes" current={sortKey} onClick={changeSort}/><th>Gêneros / tags</th><SortHead label="Nota MAL" value="meanScore" current={sortKey} onClick={changeSort}/><SortHead label="Minha nota" value="userScore" current={sortKey} onClick={changeSort}/><SortHead label="Δ" value="delta" current={sortKey} onClick={changeSort}/><SortHead label="Progresso" value="progress" current={sortKey} onClick={changeSort}/><th>Status</th><th>Meu</th><th></th>
    </tr></thead><tbody>{filtered.map((item) => {
      const delta = item.userScore !== null && item.meanScore !== null ? item.userScore - item.meanScore : null
      return <tr key={item.id} className={blacklist.has(item.id) ? 'row-muted' : ''}>
        <td><div className="anime-cell">{item.image ? <img src={item.image} alt=""/> : <div className="poster-placeholder"/>}<div><strong>{item.title}</strong><small>{item.startDate ?? 'Data desconhecida'}</small></div></div></td>
        <td>{item.year ?? '—'}</td><td>{item.episodes ?? '—'}</td><td><div className="tags">{item.genres.slice(0,3).map((g) => <span key={g}>{g}</span>)}{item.themes.slice(0,2).map((t) => <span className="theme" key={t}>{t}</span>)}</div></td>
        <td><MalScoreCell item={item} onScore={onScore}/></td><td><b className="user-score">{item.userScore ?? '—'}</b></td><td><span className={`delta ${delta === null ? '' : delta >= 0 ? 'positive' : 'negative'}`}>{delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`}</span></td><td><span className="progress">{item.watchedEpisodes}/{item.episodes ?? '?'}</span></td><td><span className={`status ${item.status}`}>{statusLabels[item.status]}</span></td>
        <td><div className="local-actions"><button title="Favorito local" className={favorites.has(item.id) ? 'local-on' : ''} onClick={() => setFavorites(new Set(toggleFavorite(item.id)))}><Bookmark size={14} fill={favorites.has(item.id) ? 'currentColor' : 'none'}/></button><button title="Não recomendar" className={blacklist.has(item.id) ? 'local-on danger' : ''} onClick={() => setBlacklist(new Set(toggleBlacklist(item.id)))}><Ban size={14}/></button></div></td>
        <td><a href={item.url} target="_blank" rel="noreferrer" className="open"><ExternalLink size={16}/></a></td>
      </tr>
    })}{filtered.length === 0 && <tr><td colSpan={11} className="empty">Nenhum anime encontrado com esses filtros.</td></tr>}</tbody></table></div>
  </section>
}

function MalScoreCell({ item, onScore }: { item: AnimeItem; onScore: (id: number, score: number) => void }) {
  const ref = useRef<HTMLSpanElement>(null)
  const requested = useRef(false)

  useEffect(() => {
    if (item.meanScore !== null || requested.current) return
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect(); requested.current = true
      void fetchAnimeMeanScore(item.id).then((score) => { if (score !== null) onScore(item.id, score) })
    }, { rootMargin: '300px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [item.id, item.meanScore, onScore])

  return <span ref={ref} className="score"><Star size={14} fill="currentColor"/>{item.meanScore?.toFixed(2) ?? '…'}</span>
}

function SortHead({ label, value, current, onClick }: { label: string; value: SortKey; current: SortKey; onClick: (key: SortKey) => void }) {
  return <th><button className={current === value ? 'sort active' : 'sort'} onClick={() => onClick(value)}>{label}<ArrowDownUp size={13}/></button></th>
}
