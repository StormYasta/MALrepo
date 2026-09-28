import { useEffect, useMemo, useState } from 'react'
import { Ban, Brain, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Eye, Lightbulb, LoaderCircle, Plus, RefreshCw, Sparkles, Trophy, XCircle } from 'lucide-react'
import { buildTasteProfile, fetchDiscoveryAnime, type DiscoveryAnime, type TasteProfile } from '../anilistApi'
import { getBlacklist, getDiscoveryQueue, loadGuessStats, saveGuessStats, toggleBlacklist, toggleDiscoveryQueue, type GuessStats } from '../storage'
import type { AnimeItem } from '../types'

type Props = {
  anime: AnimeItem[]
  username: string
}

type GuessMode = 'history' | 'queue' | 'discovery'
type GuessResult = 'correct' | 'revealed' | null
type Attempt = { text: string; correct: boolean }

type GuessTarget = {
  key: string
  title: string
  aliases: string[]
  image: string
  year: number | null
  episodes: number | null
  genres: string[]
  tags: string[]
  score: number | null
  userScore: number | null
  description: string
  studio: string | null
  url: string
  match: number | null
  source: GuessMode
}

function normalizeGuess(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function randomOne<T extends { key: string }>(items: T[], except?: string): T | null {
  const pool = except ? items.filter((item) => item.key !== except) : items
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null
}

function animeToGuess(item: AnimeItem, source: GuessMode): GuessTarget {
  return {
    key: `mal-${item.id}`,
    title: item.title,
    aliases: [item.title],
    image: item.image,
    year: item.year,
    episodes: item.episodes,
    genres: item.genres,
    tags: item.themes,
    score: item.meanScore,
    userScore: item.userScore,
    description: '',
    studio: null,
    url: item.url,
    match: null,
    source,
  }
}

function discoveryToGuess(item: DiscoveryAnime): GuessTarget {
  return {
    key: `anilist-${item.anilistId}`,
    title: item.title,
    aliases: item.aliases,
    image: item.image,
    year: item.year,
    episodes: item.episodes,
    genres: item.genres,
    tags: item.tags,
    score: item.averageScore !== null ? item.averageScore / 10 : null,
    userScore: null,
    description: item.description,
    studio: item.studio,
    url: `https://myanimelist.net/anime/${item.idMal}`,
    match: item.match,
    source: 'discovery',
  }
}

export function DiscoveryLab({ anime, username }: Props) {
  const animeKey = useMemo(() => anime.map((item) => `${item.id}:${item.userScore ?? 0}:${item.status}`).join(','), [anime])
  const [discoveries, setDiscoveries] = useState<DiscoveryAnime[]>([])
  const [profile, setProfile] = useState<TasteProfile>(() => buildTasteProfile(anime))
  const [loading, setLoading] = useState(false)
  const [discoveryError, setDiscoveryError] = useState('')
  const [discoveryOpen, setDiscoveryOpen] = useState(false)
  const [queue, setQueue] = useState(() => getDiscoveryQueue())
  const [blacklist, setBlacklist] = useState(() => getBlacklist())

  const [mode, setMode] = useState<GuessMode>('history')
  const [target, setTarget] = useState<GuessTarget | null>(null)
  const [clueLevel, setClueLevel] = useState(0)
  const [guess, setGuess] = useState('')
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [result, setResult] = useState<GuessResult>(null)
  const [roundPoints, setRoundPoints] = useState(0)
  const [sessionScore, setSessionScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [message, setMessage] = useState('')
  const [stats, setStats] = useState<GuessStats>(() => loadGuessStats())

  const historyPool = useMemo(() => anime.filter((item) => item.status !== 'plan_to_watch').map((item) => animeToGuess(item, 'history')), [animeKey])
  const queuePool = useMemo(() => anime.filter((item) => item.status === 'plan_to_watch').map((item) => animeToGuess(item, 'queue')), [animeKey])
  const discoveryPool = useMemo(() => discoveries.filter((item) => !blacklist.has(item.idMal)).map(discoveryToGuess), [discoveries, blacklist])
  const visibleDiscoveries = useMemo(() => discoveries.filter((item) => !blacklist.has(item.idMal)).slice(0, 8), [discoveries, blacklist])

  const activePool = mode === 'history' ? historyPool : mode === 'queue' ? queuePool : discoveryPool

  const suggestions = useMemo(() => {
    const query = normalizeGuess(guess)
    if (!query || result) return []

    const seen = new Set<string>()
    const ranked = activePool.flatMap((item) => item.aliases.map((alias) => ({ item, alias, normalized: normalizeGuess(alias) })))
      .filter(({ normalized }) => normalized.includes(query))
      .sort((a, b) => {
        const aStarts = a.normalized.startsWith(query) ? 0 : 1
        const bStarts = b.normalized.startsWith(query) ? 0 : 1
        return aStarts - bStarts || a.alias.length - b.alias.length
      })
      .filter(({ item }) => {
        if (seen.has(item.key)) return false
        seen.add(item.key)
        return true
      })
      .slice(0, 6)

    return ranked
  }, [guess, result, activePool])

  useEffect(() => {
    void loadDiscovery(false)
    // Discovery is cached, so bootstrapping it does not spam the API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeKey, username])

  useEffect(() => {
    startRound(mode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, animeKey, discoveries.length])

  async function loadDiscovery(force: boolean) {
    if (!anime.length || loading) return
    setLoading(true)
    setDiscoveryError('')
    try {
      const response = await fetchDiscoveryAnime(anime, username || 'guest', force)
      setDiscoveries(response.items)
      setProfile(response.profile)
    } catch (error) {
      setDiscoveryError(error instanceof Error ? error.message : 'Não foi possível buscar recomendações agora.')
    } finally {
      setLoading(false)
    }
  }

  function poolFor(selectedMode: GuessMode) {
    if (selectedMode === 'history') return historyPool
    if (selectedMode === 'queue') return queuePool
    return discoveryPool
  }

  function startRound(selectedMode = mode) {
    const next = randomOne(poolFor(selectedMode), target?.key)
    setTarget(next)
    setClueLevel(0)
    setGuess('')
    setAttempts([])
    setResult(null)
    setRoundPoints(0)
    setMessage('')
  }

  function selectMode(next: GuessMode) {
    setMode(next)
    setMessage('')
  }

  function submitGuess() {
    if (!target || result || !guess.trim()) return
    const typed = guess.trim()
    const normalized = normalizeGuess(typed)

    if (attempts.some((attempt) => normalizeGuess(attempt.text) === normalized)) {
      setMessage('Você já tentou esse título nesta rodada.')
      return
    }

    const correct = target.aliases.some((alias) => normalizeGuess(alias) === normalized)
    const nextAttempts = [...attempts, { text: typed, correct }]
    setAttempts(nextAttempts)

    if (correct) {
      const wrongAttempts = nextAttempts.filter((attempt) => !attempt.correct).length
      const points = Math.max(100, 1000 - clueLevel * 130 - wrongAttempts * 90)
      const nextStreak = streak + 1
      const nextStats: GuessStats = {
        bestStreak: Math.max(stats.bestStreak, nextStreak),
        bestRoundScore: Math.max(stats.bestRoundScore, points),
        totalScore: stats.totalScore + points,
        correct: stats.correct + 1,
        rounds: stats.rounds + 1,
      }
      setRoundPoints(points)
      setSessionScore((value) => value + points)
      setStreak(nextStreak)
      setStats(nextStats)
      saveGuessStats(nextStats)
      setResult('correct')
      setMessage(`Acertou! +${points} pontos.`)
      return
    }

    setGuess('')
    setMessage('Não foi esse. Tente outra opção ou libere mais uma pista.')
  }

  function giveUp() {
    if (!target || result) return
    const nextStats = { ...stats, rounds: stats.rounds + 1 }
    setStats(nextStats)
    saveGuessStats(nextStats)
    setStreak(0)
    setResult('revealed')
    setMessage(`Era ${target.title}.`)
  }

  function revealClue() {
    if (!target || result) return
    setClueLevel((value) => Math.min(5, value + 1))
    setMessage('')
  }

  const topTaste = profile.topGenres.slice(0, 4)
  const wrongAttempts = attempts.filter((attempt) => !attempt.correct).length

  return <section className="discovery-lab">
    <section className={`discovery-accordion ${discoveryOpen ? 'open' : ''}`}>
      <button className="discovery-toggle" onClick={() => setDiscoveryOpen((value) => !value)} aria-expanded={discoveryOpen}>
        <div><span className="eyebrow">FORA DA SUA LISTA</span><h2>Descoberta personalizada</h2><p>Recomendações novas com match calculado a partir do seu histórico.</p></div>
        <div className="discovery-toggle-meta"><span>{discoveries.length ? `${discoveries.length} candidatos` : loading ? 'carregando...' : 'abrir'}</span>{discoveryOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</div>
      </button>

      {discoveryOpen && <div className="discovery-accordion-body">
        <div className="discovery-toolbar">
          <div className="taste-strip">
            <div><Brain size={18}/><span>Seu perfil</span></div>
            {topTaste.map((genre) => <b key={genre.name}>{genre.name}</b>)}
            {profile.averageEpisodes && <small>~{Math.round(profile.averageEpisodes)} eps</small>}
            {profile.averageYear && <small>centro em {Math.round(profile.averageYear)}</small>}
          </div>
          <button className="secondary" onClick={() => loadDiscovery(true)} disabled={loading}>{loading ? <LoaderCircle className="spin" size={15}/> : <RefreshCw size={15}/>} {loading ? 'Buscando...' : 'Atualizar'}</button>
        </div>

        {discoveryError && <div className="error discovery-error">{discoveryError}</div>}

        <div className="discovery-grid">
          {visibleDiscoveries.map((item) => <article className="discovery-card" key={item.anilistId}>
            <div className="discovery-poster"><img src={item.image} alt=""/><strong>{item.match}% match</strong></div>
            <div className="discovery-body">
              <span className="discovery-kicker">{item.year ?? '—'} · {item.episodes ?? '?'} eps · {item.format?.replaceAll('_', ' ') ?? 'Anime'}</span>
              <h3>{item.title}</h3>
              <div className="tags">{item.genres.slice(0,3).map((genre) => <span key={genre}>{genre}</span>)}</div>
              <ul>{item.reasons.slice(0,3).map((reason) => <li key={reason}>{reason}</li>)}</ul>
              <div className="discovery-meta"><span>★ {item.averageScore ? (item.averageScore / 10).toFixed(1) : '—'}</span>{item.studio && <span>{item.studio}</span>}</div>
              <div className="discovery-actions">
                <button className={queue.has(item.idMal) ? 'queued' : ''} onClick={() => setQueue(new Set(toggleDiscoveryQueue(item.idMal)))}><Plus size={14}/>{queue.has(item.idMal) ? 'Na fila local' : 'Fila local'}</button>
                <a href={`https://myanimelist.net/anime/${item.idMal}`} target="_blank" rel="noreferrer">MAL <ExternalLink size={12}/></a>
                <button className="hide-rec" title="Não recomendar novamente" onClick={() => setBlacklist(new Set(toggleBlacklist(item.idMal)))}><Ban size={14}/></button>
              </div>
            </div>
          </article>)}
          {!loading && !visibleDiscoveries.length && !discoveryError && <div className="discovery-empty">Ainda não há sugestões para mostrar.</div>}
          {loading && !discoveries.length && <div className="discovery-loading"><LoaderCircle className="spin" size={22}/><span>Procurando animes fora da lista...</span></div>}
        </div>
      </div>}
    </section>

    <div className="section-heading guess-heading">
      <div><span className="eyebrow">ANIGUESSR</span><h2>Adivinhe usando sua própria lista</h2><p className="section-copy">As sugestões do campo respeitam o modo atual. Cada erro e cada pista reduzem a pontuação da rodada.</p></div>
      <div className="guess-stats"><span>Streak <b>{streak}</b></span><span>Sessão <b>{sessionScore.toLocaleString('pt-BR')}</b></span><span>Recorde <b>{stats.bestStreak}</b></span></div>
    </div>

    <div className="guess-mode-tabs">
      <button className={mode === 'history' ? 'active' : ''} onClick={() => selectMode('history')}>✅ Meu histórico <span>{historyPool.length}</span></button>
      <button className={mode === 'queue' ? 'active' : ''} onClick={() => selectMode('queue')}>🧭 Minha fila <span>{queuePool.length}</span></button>
      <button className={mode === 'discovery' ? 'active' : ''} onClick={() => selectMode('discovery')}>✨ Descoberta <span>{discoveryPool.length}</span></button>
    </div>

    <article className="guess-game">
      {target ? <>
        <div className="guess-visual">
          <div className={`guess-cover clue-${clueLevel} ${result ? 'revealed' : ''}`}><img src={target.image} alt="Anime misterioso"/></div>
          <div className="guess-score-badge"><Trophy size={15}/><span>até</span><b>{Math.max(100, 1000 - clueLevel * 130 - wrongAttempts * 90)}</b><span>pts</span></div>
        </div>

        <div className="guess-panel">
          <div className="clue-list">
            <Clue unlocked={clueLevel >= 1 || Boolean(result)} label="Ano" value={target.year?.toString() ?? 'desconhecido'}/>
            <Clue unlocked={clueLevel >= 2 || Boolean(result)} label="Episódios" value={target.episodes?.toString() ?? 'desconhecido'}/>
            <Clue unlocked={clueLevel >= 3 || Boolean(result)} label="Gêneros" value={target.genres.slice(0,4).join(' · ') || 'sem dados'}/>
            <Clue unlocked={clueLevel >= 4 || Boolean(result)} label={target.source === 'discovery' ? 'Estúdio / tags' : 'Notas'} value={target.source === 'discovery' ? [target.studio, ...target.tags.slice(0,2)].filter(Boolean).join(' · ') || 'sem dados' : `MAL ${target.score?.toFixed(1) ?? '—'} · sua ${target.userScore ?? '—'}`}/>
            <Clue unlocked={clueLevel >= 5 || Boolean(result)} label={target.source === 'discovery' ? 'Última pista' : 'Origem'} value={target.source === 'discovery' ? target.description.slice(0,180) || `${target.match ?? '—'}% de compatibilidade` : target.source === 'queue' ? 'Está no seu Plan to Watch' : 'Faz parte do seu histórico'}/>
          </div>

          {result ? <div className={`guess-result ${result}`}><span>{result === 'correct' ? '🎯 ACERTOU' : '👀 REVELADO'}</span><h3>{target.title}</h3>{target.match !== null && <p>{target.match}% de compatibilidade com seu histórico.</p>}<div><a href={target.url} target="_blank" rel="noreferrer">Abrir no MAL <ExternalLink size={13}/></a><button className="primary compact" onClick={() => startRound()}>Próxima rodada</button></div>{roundPoints > 0 && <strong>+${roundPoints} pontos</strong>}</div> :
          <>
            <label className="guess-input-label">Qual é o anime?</label>
            <div className="guess-input-wrap">
              <div className="guess-input-row"><input value={guess} onChange={(e) => setGuess(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitGuess()} placeholder="Comece a digitar o título..." autoComplete="off"/><button className="primary compact" onClick={submitGuess}>Responder</button></div>
              {suggestions.length > 0 && <div className="guess-suggestions">{suggestions.map(({item,alias}) => <button key={item.key} onMouseDown={(e) => e.preventDefault()} onClick={() => setGuess(item.title)}><img src={item.image} alt=""/><div><b>{item.title}</b>{alias !== item.title && <small>{alias}</small>}</div></button>)}</div>}
            </div>
            {attempts.length > 0 && <div className="guess-attempts"><span>Tentativas</span><div>{attempts.map((attempt,index) => <span key={`${attempt.text}-${index}`} className={attempt.correct ? 'attempt-correct' : 'attempt-wrong'}>{attempt.correct ? <CheckCircle2 size={13}/> : <XCircle size={13}/>} {attempt.text}</span>)}</div></div>}
            {message && <div className="guess-message">{message}</div>}
            <div className="guess-tools"><button className="secondary" onClick={revealClue} disabled={clueLevel >= 5}><Lightbulb size={14}/> Liberar pista ({clueLevel}/5)</button><button className="secondary" onClick={giveUp}><Eye size={14}/> Revelar resposta</button><button className="secondary" onClick={() => startRound()}><RefreshCw size={14}/> Pular</button></div>
          </>}
        </div>
      </> : <div className="guess-empty"><Sparkles size={24}/><h3>Sem títulos neste modo</h3><p>{mode === 'discovery' ? 'Aguarde as recomendações ou atualize a descoberta personalizada.' : mode === 'queue' ? 'Sua lista não possui títulos no Plan to Watch.' : 'Seu histórico ainda não possui títulos suficientes.'}</p>{mode === 'discovery' && <button className="primary compact" onClick={() => { setDiscoveryOpen(true); void loadDiscovery(true) }} disabled={loading}>Buscar descobertas</button>}<small>{activePool.length} candidatos disponíveis</small></div>}
    </article>
  </section>
}

function Clue({ unlocked, label, value }: { unlocked: boolean; label: string; value: string }) {
  return <div className={`clue ${unlocked ? 'unlocked' : ''}`}><span>{label}</span><b>{unlocked ? value : '••••••••'}</b></div>
}
