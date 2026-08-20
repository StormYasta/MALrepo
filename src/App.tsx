import { useMemo, useState } from 'react'
import { ArrowDownUp, ExternalLink, Filter, Github, LoaderCircle, Search, SlidersHorizontal, Star, X } from 'lucide-react'
import { fetchUserAnimeList } from './malApi'
import { mockAnime } from './mockData'
import type { AnimeItem, SortDirection, SortKey, WatchStatus } from './types'

const statusLabels: Record<WatchStatus, string> = {
  watching: 'Assistindo', completed: 'Completo', on_hold: 'Em espera', dropped: 'Abandonado', plan_to_watch: 'Planejo assistir',
}

function App() {
  const [anime, setAnime] = useState<AnimeItem[]>(mockAnime)
  const [username, setUsername] = useState('')
  const [clientId, setClientId] = useState(localStorage.getItem('mal-client-id') ?? '')
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('all')
  const [status, setStatus] = useState<'all' | WatchStatus>('all')
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [episodesMax, setEpisodesMax] = useState('')
  const [scoreMin, setScoreMin] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('userScore')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState<'demo' | 'mal'>('demo')

  const genres = useMemo(() => [...new Set(anime.flatMap((item) => item.genres))].sort(), [anime])

  const filtered = useMemo(() => {
    const result = anime.filter((item) => {
      const text = `${item.title} ${item.genres.join(' ')} ${item.themes.join(' ')}`.toLowerCase()
      if (search && !text.includes(search.toLowerCase())) return false
      if (genre !== 'all' && !item.genres.includes(genre)) return false
      if (status !== 'all' && item.status !== status) return false
      if (yearFrom && (item.year ?? 0) < Number(yearFrom)) return false
      if (yearTo && (item.year ?? 9999) > Number(yearTo)) return false
      if (episodesMax && item.episodes !== null && item.episodes > Number(episodesMax)) return false
      if (scoreMin && (item.userScore ?? 0) < Number(scoreMin)) return false
      return true
    })

    return result.sort((a, b) => {
      const getValue = (item: AnimeItem): string | number => {
        if (sortKey === 'progress') return item.episodes ? item.watchedEpisodes / item.episodes : item.watchedEpisodes
        return item[sortKey] ?? (sortDirection === 'asc' ? Number.MAX_SAFE_INTEGER : -1)
      }
      const av = getValue(a), bv = getValue(b)
      const comparison = typeof av === 'string' ? av.localeCompare(String(bv)) : Number(av) - Number(bv)
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [anime, search, genre, status, yearFrom, yearTo, episodesMax, scoreMin, sortKey, sortDirection])

  async function loadList() {
    setLoading(true); setError('')
    try {
      const data = await fetchUserAnimeList(username, clientId)
      localStorage.setItem('mal-client-id', clientId)
      setAnime(data); setSource('mal')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a lista.')
    } finally { setLoading(false) }
  }

  function clearFilters() {
    setSearch(''); setGenre('all'); setStatus('all'); setYearFrom(''); setYearTo(''); setEpisodesMax(''); setScoreMin('')
  }

  function changeSort(key: SortKey) {
    if (sortKey === key) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDirection(key === 'title' ? 'asc' : 'desc') }
  }

  return <div className="app">
    <header>
      <div className="brand"><div className="logo">M</div><div><strong>MAL Sheet</strong><span>Sua lista, do seu jeito.</span></div></div>
      <a className="github" href="https://github.com/StormYasta/MALrepo" target="_blank" rel="noreferrer"><Github size={18}/> GitHub</a>
    </header>

    <main>
      <section className="hero">
        <div><span className="eyebrow">MYANIMELIST EXPLORER</span><h1>Encontre o próximo anime<br/><em>sem perder tempo.</em></h1><p>Transforme sua lista do MyAnimeList em uma tabela poderosa, pesquisável e filtrável.</p></div>
        <div className="connect-card">
          <label>Usuário do MyAnimeList</label><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex: StormYasta" onKeyDown={(e) => e.key === 'Enter' && loadList()}/>
          <label>MAL Client ID <small>(fica somente neste navegador)</small></label><input type="password" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Cole seu Client ID" onKeyDown={(e) => e.key === 'Enter' && loadList()}/>
          <button className="primary" onClick={loadList} disabled={loading}>{loading ? <LoaderCircle className="spin" size={18}/> : null}{loading ? 'Carregando...' : 'Carregar minha lista'}</button>
          {error && <div className="error">{error}</div>}
          <p className="hint">O MVP começa com dados de demonstração. Para usar a API oficial, informe um Client ID do MAL.</p>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-title"><div><h2>Minha lista</h2><span><b>{filtered.length}</b> de {anime.length} títulos · {source === 'demo' ? 'Modo demonstração' : `Lista de ${username}`}</span></div><button className="clear" onClick={clearFilters}><X size={15}/> Limpar filtros</button></div>
        <div className="toolbar">
          <div className="search"><Search size={18}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar título, gênero ou tema..."/></div>
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
          <th>Anime</th><SortHead label="Ano" value="year" current={sortKey} onClick={changeSort}/><SortHead label="Episódios" value="episodes" current={sortKey} onClick={changeSort}/><th>Gêneros / temas</th><SortHead label="Nota MAL" value="meanScore" current={sortKey} onClick={changeSort}/><SortHead label="Minha nota" value="userScore" current={sortKey} onClick={changeSort}/><SortHead label="Progresso" value="progress" current={sortKey} onClick={changeSort}/><th>Status</th><th></th>
        </tr></thead><tbody>{filtered.map((item) => <tr key={item.id}>
          <td><div className="anime-cell">{item.image ? <img src={item.image} alt=""/> : <div className="poster-placeholder"/>}<div><strong>{item.title}</strong><small>{item.startDate ?? 'Data desconhecida'}</small></div></div></td>
          <td>{item.year ?? '—'}</td><td>{item.episodes ?? '—'}</td><td><div className="tags">{item.genres.slice(0,3).map((g) => <span key={g}>{g}</span>)}{item.themes.slice(0,1).map((t) => <span className="theme" key={t}>{t}</span>)}</div></td>
          <td><span className="score"><Star size={14} fill="currentColor"/>{item.meanScore?.toFixed(2) ?? '—'}</span></td><td><b className="user-score">{item.userScore || '—'}</b></td><td><span className="progress">{item.watchedEpisodes}/{item.episodes ?? '?'}</span></td><td><span className={`status ${item.status}`}>{statusLabels[item.status]}</span></td><td><a href={item.url} target="_blank" rel="noreferrer" className="open"><ExternalLink size={16}/></a></td>
        </tr>)}{filtered.length === 0 && <tr><td colSpan={9} className="empty">Nenhum anime encontrado com esses filtros.</td></tr>}</tbody></table></div>
      </section>
    </main>
    <footer>MAL Sheet · MVP client-side para GitHub Pages · Dados pertencem ao MyAnimeList.</footer>
  </div>
}

function SortHead({ label, value, current, onClick }: { label: string; value: SortKey; current: SortKey; onClick: (key: SortKey) => void }) {
  return <th><button className={current === value ? 'sort active' : 'sort'} onClick={() => onClick(value)}>{label}<ArrowDownUp size={13}/></button></th>
}

export default App
