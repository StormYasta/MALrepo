import { useCallback, useEffect, useMemo, useState } from 'react'
import { Compass, Gamepad2, LoaderCircle } from 'lucide-react'
import { Explorer } from './components/Explorer'
import { FunZone } from './components/FunZone'
import { readCachedMeanScore } from './jikanScores'
import { fetchUserAnimeList } from './malApi'
import { mockAnime } from './mockData'
import type { AnimeItem, AppTab } from './types'

function hydrateCachedScores(items: AnimeItem[]) {
  return items.map((item) => ({ ...item, meanScore: item.meanScore ?? readCachedMeanScore(item.id) }))
}

function App() {
  const [anime, setAnime] = useState<AnimeItem[]>(() => hydrateCachedScores(mockAnime))
  const [listInput, setListInput] = useState(() => new URLSearchParams(window.location.search).get('user') ?? '')
  const [loadedUsername, setLoadedUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState<'demo' | 'mal'>('demo')
  const [tab, setTab] = useState<AppTab>(() => window.location.hash === '#diversao' ? 'fun' : 'explorer')

  const loadedLabel = useMemo(() => source === 'demo' ? 'Demonstração' : loadedUsername, [source, loadedUsername])

  const updateMeanScore = useCallback((id: number, meanScore: number) => {
    setAnime((current) => current.map((item) => item.id === id ? { ...item, meanScore } : item))
  }, [])

  useEffect(() => {
    const initialUser = new URLSearchParams(window.location.search).get('user')
    if (initialUser) void loadList(initialUser)
    // Only auto-load the shared user once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function changeTab(next: AppTab) {
    setTab(next)
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}${next === 'fun' ? '#diversao' : '#explorer'}`)
  }

  async function loadList(inputOverride?: string) {
    const target = inputOverride ?? listInput
    if (!target.trim()) return
    setLoading(true)
    setError('')
    try {
      const { username, items } = await fetchUserAnimeList(target)
      setAnime(hydrateCachedScores(items))
      setLoadedUsername(username)
      setSource('mal')
      setListInput(username)
      const params = new URLSearchParams(window.location.search)
      params.set('user', username)
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}${window.location.hash || '#explorer'}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a lista.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="app">
    <header className="app-header">
      <div className="brand"><div className="logo">M</div><div><strong>MAL Sheet</strong><span>Sua lista, do seu jeito.</span></div></div>
      <nav className="main-tabs" aria-label="Áreas do MAL Sheet">
        <button className={tab === 'explorer' ? 'active' : ''} onClick={() => changeTab('explorer')}><Compass size={16}/> Explorer</button>
        <button className={tab === 'fun' ? 'active' : ''} onClick={() => changeTab('fun')}><Gamepad2 size={16}/> Diversão</button>
      </nav>
      <a className="github" href="https://github.com/StormYasta/MALrepo" target="_blank" rel="noreferrer">GitHub</a>
    </header>

    <main>
      <section className="load-strip">
        <div><span className="eyebrow">LISTA ATIVA</span><strong>{loadedLabel}</strong><small>{anime.length} títulos carregados</small></div>
        <div className="load-form"><input value={listInput} onChange={(e) => setListInput(e.target.value)} placeholder="Kerbus ou link da lista do MyAnimeList" onKeyDown={(e) => e.key === 'Enter' && loadList()}/><button className="primary compact" onClick={() => loadList()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={17}/> : null}{loading ? 'Carregando...' : 'Carregar lista'}</button></div>
        {error && <div className="error load-error">{error}</div>}
      </section>

      {tab === 'explorer'
        ? <Explorer anime={anime} username={loadedUsername} source={source} onScore={updateMeanScore}/>
        : <FunZone anime={anime} username={loadedUsername || 'Minha lista'} source={source} onScore={updateMeanScore}/>
      }
    </main>

    <footer>MAL Sheet · GitHub Pages + Cloudflare Worker · sem conta própria e sem banco de dados.</footer>
  </div>
}

export default App
