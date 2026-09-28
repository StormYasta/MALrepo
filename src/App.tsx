import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Check, Compass, Download, Gamepad2, Link2, LoaderCircle } from 'lucide-react'
import { fetchAnimeTitleAliases } from './anilistApi'
import { Explorer } from './components/Explorer'
import { GamesZone } from './components/GamesZone'
import { StatsZone } from './components/StatsZone'
import { readCachedMeanScore } from './jikanScores'
import { fetchUserAnimeList } from './malApi'
import { mockAnime } from './mockData'
import { getLastUser, setLastUser } from './storage'
import type { AnimeItem, AppTab } from './types'

function hydrateCachedScores(items: AnimeItem[]) {
  return items.map((item) => ({ ...item, meanScore: item.meanScore ?? readCachedMeanScore(item.id) }))
}

function getUrlUser() {
  return new URLSearchParams(window.location.search).get('user')?.trim() ?? ''
}

function getHashTab(): AppTab {
  if (window.location.hash === '#estatisticas') return 'stats'
  if (window.location.hash === '#jogos' || window.location.hash === '#diversao') return 'games'
  return 'explorer'
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function App() {
  const initialUser = getUrlUser() || getLastUser()
  const [anime, setAnime] = useState<AnimeItem[]>(() => hydrateCachedScores(mockAnime))
  const [listInput, setListInput] = useState(initialUser)
  const [loadedUsername, setLoadedUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState<'demo' | 'mal'>('demo')
  const [tab, setTab] = useState<AppTab>(getHashTab)
  const [linkCopied, setLinkCopied] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches)
  const initialLoadStarted = useRef(false)

  const loadedLabel = useMemo(() => source === 'demo' ? 'Demonstração' : loadedUsername, [source, loadedUsername])

  const updateMeanScore = useCallback((id: number, meanScore: number) => {
    setAnime((current) => current.map((item) => item.id === id ? { ...item, meanScore } : item))
  }, [])

  const enrichTitles = useCallback(async (items: AnimeItem[]) => {
    try {
      const aliases = await fetchAnimeTitleAliases(items)
      setAnime((current) => current.map((item) => {
        const itemAliases = aliases.get(item.id)
        return itemAliases ? { ...item, aliases: itemAliases } : item
      }))
    } catch {
      // Alternative titles are an enhancement; the MAL list remains usable without them.
    }
  }, [])

  useEffect(() => {
    void enrichTitles(mockAnime)
  }, [enrichTitles])

  useEffect(() => {
    if (initialLoadStarted.current) return
    initialLoadStarted.current = true
    const user = getUrlUser() || getLastUser()
    if (user) void loadList(user)
    // This is intentionally a one-time profile bootstrap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const syncHash = () => setTab(getHashTab())
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  useEffect(() => {
    const onInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function canonicalUrl(username: string, nextTab = tab) {
    const url = new URL(window.location.href)
    url.searchParams.set('user', username)
    url.hash = nextTab === 'stats' ? 'estatisticas' : nextTab === 'games' ? 'jogos' : 'explorer'
    return url
  }

  function changeTab(next: AppTab) {
    setTab(next)
    const url = new URL(window.location.href)
    if (loadedUsername) url.searchParams.set('user', loadedUsername)
    url.hash = next === 'stats' ? 'estatisticas' : next === 'games' ? 'jogos' : 'explorer'
    window.history.replaceState({}, '', url)
  }

  async function loadList(inputOverride?: string) {
    const target = inputOverride ?? listInput
    if (!target.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      const { username, items } = await fetchUserAnimeList(target)
      setAnime(hydrateCachedScores(items))
      void enrichTitles(items)
      setLoadedUsername(username)
      setSource('mal')
      setListInput(username)
      setLastUser(username)

      const url = new URL(window.location.href)
      url.searchParams.set('user', username)
      if (!url.hash) url.hash = tab === 'stats' ? 'estatisticas' : tab === 'games' ? 'jogos' : 'explorer'
      window.history.replaceState({}, '', url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a lista.')
    } finally {
      setLoading(false)
    }
  }

  async function installApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstalled(true)
      setInstallPrompt(null)
    }
  }

  async function copyProfileUrl() {
    if (!loadedUsername) return
    const url = canonicalUrl(loadedUsername)
    try {
      await navigator.clipboard.writeText(url.toString())
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 1600)
    } catch {
      window.history.replaceState({}, '', url)
    }
  }

  return <div className="app">
    <header className="app-header">
      <div className="brand"><div className="logo">M</div><div><strong>MAL Sheet</strong><span>Sua lista, do seu jeito.</span></div></div>
      <nav className="main-tabs" aria-label="Áreas do MAL Sheet">
        <button className={tab === 'explorer' ? 'active' : ''} onClick={() => changeTab('explorer')}><Compass size={16}/> Explorer</button>
        <button className={tab === 'stats' ? 'active' : ''} onClick={() => changeTab('stats')}><BarChart3 size={16}/> Estatísticas</button>
        <button className={tab === 'games' ? 'active' : ''} onClick={() => changeTab('games')}><Gamepad2 size={16}/> Jogos</button>
      </nav>
      <div className="header-actions">
        {!installed && installPrompt && <button className="install-app" onClick={installApp}><Download size={15}/> Instalar app</button>}
        {installed && <span className="installed-badge"><Check size={13}/> Instalado</span>}
        <span className="project-badge">Open source</span>
      </div>
    </header>

    <main>
      <section className="load-strip">
        <div><span className="eyebrow">LISTA ATIVA</span><strong>{loadedLabel}</strong><small>{anime.length} títulos carregados</small>{source === 'mal' && <span className="url-profile-badge">URL vinculada</span>}</div>
        <div className="load-form">
          <input value={listInput} onChange={(e) => setListInput(e.target.value)} placeholder="animefan ou link da lista do MyAnimeList" onKeyDown={(e) => e.key === 'Enter' && loadList()}/>
          <button className="primary compact" onClick={() => loadList()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={17}/> : null}{loading ? 'Carregando...' : 'Carregar lista'}</button>
          {source === 'mal' && <button className="secondary profile-link" onClick={copyProfileUrl}>{linkCopied ? <Check size={15}/> : <Link2 size={15}/>} {linkCopied ? 'Copiado' : 'Minha URL'}</button>}
        </div>
        {error && <div className="error load-error">{error}</div>}
        {source === 'mal' && <div className="profile-hint">Ao abrir esta URL novamente, <b>{loadedUsername}</b> é carregado automaticamente. Neste navegador, o último usuário também fica lembrado localmente.</div>}
      </section>

      {tab === 'explorer' && <Explorer anime={anime} username={loadedUsername} source={source} onScore={updateMeanScore}/>}
      {tab === 'stats' && <StatsZone anime={anime} username={loadedUsername || 'Minha lista'} source={source} onScore={updateMeanScore}/>}
      {tab === 'games' && <GamesZone anime={anime} username={loadedUsername || 'Minha lista'} source={source}/>}

    </main>

    <footer>MAL Sheet · GitHub Pages + Cloudflare Worker · sem conta própria e sem banco de dados.</footer>
  </div>
}

export default App
