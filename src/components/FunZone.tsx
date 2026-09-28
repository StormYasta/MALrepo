import { useEffect, useMemo, useState } from 'react'
import { Award, Check, Download, Gamepad2, RefreshCw, Sparkles, Swords, Trophy } from 'lucide-react'
import { DiscoveryLab } from './DiscoveryLab'
import { fetchAnimeMeanScore } from '../jikanScores'
import { fetchUserAnimeList } from '../malApi'
import { getBlacklist, getFavorites, loadChallenge, saveChallenge } from '../storage'
import type { AnimeItem } from '../types'

type Props = {
  anime: AnimeItem[]
  username: string
  source: 'demo' | 'mal'
  onScore: (id: number, score: number) => void
}

type GenreStat = { name: string; count: number; avg: number }

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function randomOne<T>(items: T[]): T | null {
  return items.length ? items[Math.floor(Math.random() * items.length)] : null
}

function formatWatchTime(episodes: number) {
  const minutes = episodes * 24
  const hours = Math.round(minutes / 60)
  const days = (minutes / 1440).toFixed(1)
  return { minutes, hours, days }
}

function getGenreStats(anime: AnimeItem[]): GenreStat[] {
  const map = new Map<string, { count: number; ratings: number[] }>()
  anime.forEach((item) => item.genres.forEach((genre) => {
    const current = map.get(genre) ?? { count: 0, ratings: [] }
    current.count += 1
    if (item.userScore !== null && item.userScore > 0) current.ratings.push(item.userScore)
    map.set(genre, current)
  }))
  return [...map.entries()].map(([name, value]) => ({
    name,
    count: value.count,
    avg: value.ratings.length ? value.ratings.reduce((a, b) => a + b, 0) / value.ratings.length : 0,
  })).sort((a, b) => b.count - a.count)
}

export function FunZone({ anime, username, source, onScore }: Props) {
  const [rouletteGenre, setRouletteGenre] = useState('all')
  const [rouletteMax, setRouletteMax] = useState('24')
  const [roulette, setRoulette] = useState<AnimeItem | null>(null)
  const [surprise, setSurprise] = useState<AnimeItem | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [battlePool, setBattlePool] = useState<AnimeItem[]>(() => shuffle(anime.filter((a) => a.status === 'completed' && a.userScore !== null)).slice(0, 12))
  const [battleChampion, setBattleChampion] = useState<AnimeItem | null>(() => battlePool[0] ?? null)
  const [battleIndex, setBattleIndex] = useState(1)
  const [battleWins, setBattleWins] = useState(0)
  const [compareInput, setCompareInput] = useState('')
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareResult, setCompareResult] = useState<{ user: string; common: number; rated: number; avgDiff: number; compatibility: number; uniqueForThem: AnimeItem[] } | null>(null)
  const [compareError, setCompareError] = useState('')
  const [enriching, setEnriching] = useState(false)
  const [bingoMarked, setBingoMarked] = useState<Set<number>>(() => new Set())
  const [challenge, setChallenge] = useState(() => loadChallenge())
  const animeKey = useMemo(() => anime.map((item) => item.id).join(','), [anime])

  useEffect(() => {
    const pool = shuffle(anime.filter((a) => a.status === 'completed' && a.userScore !== null)).slice(0, 12)
    setBattlePool(pool)
    setBattleChampion(pool[0] ?? null)
    setBattleIndex(1)
    setBattleWins(0)
    setRoulette(null)
    setSurprise(null)
  }, [animeKey])

  const favorites = useMemo(() => getFavorites(), [anime])
  const blacklist = useMemo(() => getBlacklist(), [anime])
  const genres = useMemo(() => [...new Set(anime.flatMap((item) => item.genres))].sort(), [anime])
  const genreStats = useMemo(() => getGenreStats(anime), [anime])
  const completed = useMemo(() => anime.filter((item) => item.status === 'completed'), [anime])
  const planned = useMemo(() => anime.filter((item) => item.status === 'plan_to_watch' && !blacklist.has(item.id)), [anime, blacklist])
  const rated = useMemo(() => anime.filter((item) => item.userScore !== null && item.userScore > 0), [anime])
  const scoredBoth = useMemo(() => anime.filter((item) => item.userScore !== null && item.userScore > 0 && item.meanScore !== null), [anime])

  const watchedEpisodes = useMemo(() => anime.reduce((sum, item) => sum + item.watchedEpisodes, 0), [anime])
  const watchTime = useMemo(() => formatWatchTime(watchedEpisodes), [watchedEpisodes])
  const avgUser = rated.length ? rated.reduce((sum, item) => sum + (item.userScore ?? 0), 0) / rated.length : 0
  const mainstream = scoredBoth.length ? Math.max(0, Math.round(100 - (scoredBoth.reduce((sum, item) => sum + Math.abs((item.userScore ?? 0) - (item.meanScore ?? 0)), 0) / scoredBoth.length) * 10)) : null

  const decades = useMemo(() => {
    const counts = new Map<number, number>()
    completed.forEach((item) => {
      if (!item.year) return
      const decade = Math.floor(item.year / 10) * 10
      counts.set(decade, (counts.get(decade) ?? 0) + 1)
    })
    return [...counts.entries()].sort((a, b) => a[0] - b[0])
  }, [completed])
  const maxDecade = Math.max(1, ...decades.map(([, count]) => count))

  const deltas = useMemo(() => scoredBoth.map((item) => ({ item, delta: (item.userScore ?? 0) - (item.meanScore ?? 0) })), [scoredBoth])
  const hotTakes = useMemo(() => [...deltas].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5), [deltas])
  const hiddenGems = useMemo(() => [...deltas].filter(({ item, delta }) => (item.userScore ?? 0) >= 8 && (delta >= 1 || (item.meanScore ?? 10) < 7.5)).sort((a, b) => b.delta - a.delta).slice(0, 5), [deltas])
  const hallFame = useMemo(() => [...rated].sort((a, b) => (b.userScore ?? 0) - (a.userScore ?? 0) || (b.meanScore ?? 0) - (a.meanScore ?? 0)).slice(0, 6), [rated])
  const hallShame = useMemo(() => anime.filter((item) => item.status === 'dropped').sort((a, b) => (b.meanScore ?? 0) - (a.meanScore ?? 0)).slice(0, 5), [anime])

  const affinity = useMemo(() => {
    const map = new Map<string, number[]>()
    rated.filter((item) => (item.userScore ?? 0) >= 7).forEach((item) => item.genres.forEach((g) => map.set(g, [...(map.get(g) ?? []), item.userScore ?? 0])))
    return new Map([...map.entries()].map(([g, scores]) => [g, scores.reduce((a, b) => a + b, 0) / scores.length]))
  }, [rated])

  const recommendation = useMemo(() => {
    const candidates = planned.map((item) => ({
      item,
      score: item.genres.reduce((sum, genre) => sum + (affinity.get(genre) ?? 5), 0) / Math.max(1, item.genres.length) + ((item.meanScore ?? 0) / 5),
    })).sort((a, b) => b.score - a.score)
    return randomOne(candidates.slice(0, Math.min(5, candidates.length)))?.item ?? null
  }, [planned, affinity])

  const featured = roulette ?? surprise ?? recommendation ?? hallFame[0] ?? anime[0] ?? null
  const radar = genreStats.slice(0, 6)
  const radarPoints = radar.map((stat, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, radar.length)
    const radius = 42 * (stat.count / Math.max(1, radar[0]?.count ?? 1))
    return `${50 + Math.cos(angle) * radius},${50 + Math.sin(angle) * radius}`
  }).join(' ')

  const longestCompleted = [...completed].filter((a) => a.episodes).sort((a, b) => (b.episodes ?? 0) - (a.episodes ?? 0))[0]
  const lowestFinished = [...completed].filter((a) => a.userScore !== null).sort((a, b) => (a.userScore ?? 99) - (b.userScore ?? 99))[0]
  const peakDecade = [...decades].sort((a, b) => b[1] - a[1])[0]

  const achievements = [
    { emoji: '🏁', name: 'Primeiros 50', unlocked: completed.length >= 50, detail: `${completed.length}/50 completos` },
    { emoji: '💯', name: 'Centenário', unlocked: completed.length >= 100, detail: `${completed.length}/100 completos` },
    { emoji: '📺', name: 'Mil episódios', unlocked: watchedEpisodes >= 1000, detail: `${watchedEpisodes.toLocaleString('pt-BR')} episódios` },
    { emoji: '🧭', name: 'Explorador de gêneros', unlocked: genreStats.length >= 15, detail: `${genreStats.length} gêneros` },
    { emoji: '🕰️', name: 'Viajante do tempo', unlocked: decades.length >= 4, detail: `${decades.length} décadas` },
    { emoji: '💔', name: 'Sem piedade', unlocked: anime.filter((a) => a.status === 'dropped').length >= 10, detail: `${anime.filter((a) => a.status === 'dropped').length} drops` },
  ]

  const bingo = useMemo(() => [
    'Anime dos anos 90 ou antes', 'Até 12 episódios', 'Nota pessoal 9 ou 10',
    'Fantasia ou aventura', 'Sci-Fi ou mecha', 'Anime que você dropou',
    'Mais de 50 episódios', 'Está no Plan to Watch', 'Gênero que você quase não vê',
  ], [])

  function spinRoulette() {
    const pool = planned.filter((item) => (rouletteGenre === 'all' || item.genres.includes(rouletteGenre)) && (!rouletteMax || item.episodes === null || item.episodes <= Number(rouletteMax)))
    setRoulette(randomOne(pool))
  }

  function nextSurprise() {
    setSurprise(randomOne(planned)); setRevealed(false)
  }

  function resetBattle() {
    const pool = shuffle(anime.filter((a) => a.status === 'completed' && a.userScore !== null)).slice(0, 12)
    setBattlePool(pool); setBattleChampion(pool[0] ?? null); setBattleIndex(1); setBattleWins(0)
  }

  function pickBattle(winner: AnimeItem) {
    const nextIndex = battleIndex + 1
    setBattleChampion(winner)
    setBattleWins((wins) => wins + 1)
    setBattleIndex(nextIndex)
  }

  async function compareUser() {
    setCompareLoading(true); setCompareError(''); setCompareResult(null)
    try {
      const other = await fetchUserAnimeList(compareInput)
      const mine = new Map(anime.map((item) => [item.id, item]))
      const common = other.items.filter((item) => mine.has(item.id))
      const ratedCommon = common.filter((item) => item.userScore !== null && (mine.get(item.id)?.userScore ?? null) !== null)
      const avgDiff = ratedCommon.length ? ratedCommon.reduce((sum, item) => sum + Math.abs((item.userScore ?? 0) - (mine.get(item.id)?.userScore ?? 0)), 0) / ratedCommon.length : 0
      const compatibility = ratedCommon.length ? Math.max(0, Math.round(100 - avgDiff * 10)) : 0
      const uniqueForThem = other.items.filter((item) => !mine.has(item.id) && (item.userScore ?? 0) >= 8).slice(0, 5)
      setCompareResult({ user: other.username, common: common.length, rated: ratedCommon.length, avgDiff, compatibility, uniqueForThem })
    } catch (error) {
      setCompareError(error instanceof Error ? error.message : 'Não foi possível comparar as listas.')
    } finally { setCompareLoading(false) }
  }

  async function enrichAnalysis() {
    if (enriching) return
    setEnriching(true)
    const candidates = rated.filter((item) => item.meanScore === null).slice(0, 20)
    for (const item of candidates) {
      const score = await fetchAnimeMeanScore(item.id)
      if (score !== null) onScore(item.id, score)
    }
    setEnriching(false)
  }

  function newChallenge() {
    const pool = planned.length >= 9 ? planned : anime.filter((a) => a.status !== 'dropped')
    const state = { ids: shuffle(pool).slice(0, 9).map((item) => item.id), done: [] as number[] }
    setChallenge(state); saveChallenge(state)
  }

  function toggleChallenge(id: number) {
    if (!challenge) return
    const done = challenge.done.includes(id) ? challenge.done.filter((value) => value !== id) : [...challenge.done, id]
    const next = { ...challenge, done }
    setChallenge(next); saveChallenge(next)
  }

  function downloadDnaCard() {
    const canvas = document.createElement('canvas')
    canvas.width = 1080; canvas.height = 1080
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1080)
    gradient.addColorStop(0, '#172554'); gradient.addColorStop(1, '#2e51a2')
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1080)
    ctx.fillStyle = '#fff'; ctx.font = '700 70px Arial'; ctx.fillText('Meu Anime DNA', 80, 130)
    ctx.font = '400 32px Arial'; ctx.fillStyle = '#dbeafe'; ctx.fillText(username || 'MAL Sheet', 80, 185)
    ctx.font = '700 56px Arial'; ctx.fillStyle = '#fff'; ctx.fillText(`${completed.length}`, 80, 320)
    ctx.font = '400 25px Arial'; ctx.fillStyle = '#bfdbfe'; ctx.fillText('animes completos', 80, 360)
    ctx.font = '700 56px Arial'; ctx.fillStyle = '#fff'; ctx.fillText(`${watchTime.days} dias`, 560, 320)
    ctx.font = '400 25px Arial'; ctx.fillStyle = '#bfdbfe'; ctx.fillText('estimados assistindo', 560, 360)
    ctx.font = '700 36px Arial'; ctx.fillStyle = '#fff'; ctx.fillText('Top gêneros', 80, 480)
    genreStats.slice(0, 5).forEach((stat, index) => {
      ctx.font = '600 30px Arial'; ctx.fillStyle = '#e0e7ff'; ctx.fillText(`${index + 1}. ${stat.name} — ${stat.count}`, 95, 540 + index * 58)
    })
    ctx.font = '700 36px Arial'; ctx.fillStyle = '#fff'; ctx.fillText(`Média pessoal: ${avgUser ? avgUser.toFixed(2) : '—'}`, 80, 880)
    ctx.font = '400 24px Arial'; ctx.fillStyle = '#bfdbfe'; ctx.fillText('Gerado por MAL Sheet', 80, 990)
    const link = document.createElement('a')
    link.download = `mal-sheet-${username || 'anime-dna'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const challengeItems = (challenge?.ids ?? []).map((id) => anime.find((item) => item.id === id)).filter((item): item is AnimeItem => Boolean(item))
  const battleChallenger = battlePool[battleIndex] ?? null

  return <div className="fun-zone">
    <section className="fun-hero" style={featured?.image ? { backgroundImage: `linear-gradient(90deg, rgba(10,18,40,.96), rgba(18,35,72,.82)), url(${featured.image})` } : undefined}>
      <div><span className="eyebrow light">MAL SHEET · DIVERSÃO · {source === 'demo' ? 'DEMO' : username}</span><h2>Transforme sua lista em um playground.</h2><p>Estatísticas, decisões impossíveis, desafios e opiniões questionáveis — tudo calculado localmente no seu navegador.</p></div>
      <div className="hero-stats"><div><b>{completed.length}</b><span>completos</span></div><div><b>{watchTime.days}</b><span>dias estimados</span></div><div><b>{avgUser ? avgUser.toFixed(1) : '—'}</b><span>sua média</span></div><div><b>{favorites.size}</b><span>favoritos locais</span></div></div>
    </section>

    <DiscoveryLab anime={anime} username={username}/>

    <section className="fun-section">
      <div className="section-heading"><div><span className="eyebrow">COMECE POR AQUI</span><h2>Decida o que assistir</h2></div></div>
      <div className="fun-grid three">
        <article className="fun-card accent"><div className="card-icon">🎲</div><h3>Roleta do próximo anime</h3><p>Sorteia apenas dentro do seu Plan to Watch e respeita seus filtros.</p><div className="inline-controls"><select value={rouletteGenre} onChange={(e) => setRouletteGenre(e.target.value)}><option value="all">Qualquer gênero</option>{genres.map((g) => <option key={g}>{g}</option>)}</select><select value={rouletteMax} onChange={(e) => setRouletteMax(e.target.value)}><option value="">Qualquer duração</option><option value="12">Até 12 eps</option><option value="24">Até 24 eps</option><option value="50">Até 50 eps</option></select></div><button className="primary compact" onClick={spinRoulette}><RefreshCw size={16}/> Girar roleta</button>{roulette && <MiniAnime item={roulette} label="A roleta escolheu"/>}</article>

        <article className="fun-card"><div className="card-icon">🧠</div><h3>Recomendação pela sua própria lista</h3><p>Prioriza gêneros que você costuma avaliar bem e ignora sua blacklist local.</p>{recommendation ? <MiniAnime item={recommendation} label="Match de gosto"/> : <EmptySmall text="Adicione títulos ao Plan to Watch para usar."/>}</article>

        <article className="fun-card"><div className="card-icon">🎭</div><h3>Modo surpresa</h3><p>Escolha sem julgar pela capa ou pelo título.</p><button className="secondary" onClick={nextSurprise}>Nova surpresa</button>{surprise && <div className="surprise-card"><img className={revealed ? '' : 'blurred'} src={surprise.image} alt=""/><div><span>{surprise.episodes ?? '?'} eps · {surprise.genres.slice(0,2).join(' · ')}</span><strong>{revealed ? surprise.title : '???'}</strong><button className="text-button" onClick={() => setRevealed((v) => !v)}>{revealed ? 'Esconder' : 'Revelar anime'}</button></div></div>}</article>
      </div>
    </section>

    <section className="fun-section">
      <div className="section-heading"><div><span className="eyebrow">SEU PERFIL</span><h2>Anime DNA</h2></div><div className="heading-actions"><button className="secondary" onClick={enrichAnalysis} disabled={enriching}><Sparkles size={15}/>{enriching ? ' Analisando...' : ' Completar notas MAL'}</button><button className="secondary" onClick={downloadDnaCard}><Download size={15}/> Baixar card</button></div></div>
      <div className="dna-grid">
        <article className="fun-card radar-card"><h3>Radar de gêneros</h3>{radar.length >= 3 ? <div className="radar-wrap"><svg viewBox="0 0 100 100" role="img" aria-label="Radar dos gêneros mais assistidos"><polygon className="radar-bg" points="50,7 87,28 87,72 50,93 13,72 13,28"/><polygon className="radar-data" points={radarPoints}/>{radar.map((stat, i) => { const angle = -Math.PI/2 + (Math.PI*2*i)/radar.length; return <text key={stat.name} x={50+Math.cos(angle)*48} y={50+Math.sin(angle)*48} textAnchor="middle">{stat.name.slice(0,10)}</text> })}</svg></div> : <EmptySmall text="Poucos gêneros para montar o radar."/>}</article>
        <article className="fun-card"><h3>Assinatura do gosto</h3><div className="dna-list">{genreStats.slice(0,6).map((stat, index) => <div key={stat.name}><span>{index+1}. {stat.name}</span><b>{stat.count} títulos · {stat.avg ? `★ ${stat.avg.toFixed(1)}` : 'sem notas'}</b></div>)}</div></article>
        <article className="fun-card meter-card"><h3>Mainstream meter</h3><div className="meter"><div style={{width:`${mainstream ?? 0}%`}}/></div><strong>{mainstream === null ? '—' : `${mainstream}%`}</strong><p>{mainstream === null ? 'A Nota MAL ainda está sendo enriquecida.' : mainstream >= 80 ? 'Seu gosto acompanha bastante o consenso.' : mainstream >= 60 ? 'Você alterna entre consenso e hot takes.' : 'Você definitivamente tem opiniões próprias.'}</p><small>Indicador recreativo baseado na diferença entre suas notas e a média MAL ({scoredBoth.length} títulos comparáveis).</small></article>
      </div>
    </section>

    <section className="fun-section">
      <div className="section-heading"><div><span className="eyebrow">EU × MAL</span><h2>Opiniões fortes</h2></div></div>
      <div className="fun-grid three"><RankingCard title="🔥 Hot Takes" items={hotTakes.map(({item,delta}) => ({item, meta:`${delta >= 0 ? '+' : ''}${delta.toFixed(2)} vs MAL`}))}/><RankingCard title="💎 Hidden Gems" items={hiddenGems.map(({item,delta}) => ({item, meta:`Você +${delta.toFixed(2)}`}))}/><RankingCard title="🏆 Hall da Fama" items={hallFame.map((item) => ({item, meta:`Sua nota ${item.userScore ?? '—'}`}))}/></div>
      <div className="fun-grid two lower-grid"><RankingCard title="🙈 Hall da Vergonha" subtitle="Boas notas MAL que você abandonou" items={hallShame.map((item) => ({item, meta:`MAL ${item.meanScore?.toFixed(2) ?? '…'}`}))}/><article className="fun-card"><h3>Estatísticas estranhamente específicas</h3><div className="weird-stats"><div><span>Maior anime concluído</span><b>{longestCompleted ? `${longestCompleted.title} · ${longestCompleted.episodes} eps` : '—'}</b></div><div><span>Menor nota que você terminou</span><b>{lowestFinished ? `${lowestFinished.title} · ${lowestFinished.userScore}/10` : '—'}</b></div><div><span>Década dominante</span><b>{peakDecade ? `${peakDecade[0]}s · ${peakDecade[1]} títulos` : '—'}</b></div><div><span>Tempo aproximado</span><b>{watchTime.hours.toLocaleString('pt-BR')} horas</b></div></div></article></div>
    </section>

    <section className="fun-section">
      <div className="section-heading"><div><span className="eyebrow">LINHA DO TEMPO</span><h2>Mapa por décadas</h2></div></div>
      <article className="fun-card decade-card">{decades.map(([decade,count]) => <div className="decade-row" key={decade}><span>{decade}s</span><div><i style={{width:`${Math.max(4,(count/maxDecade)*100)}%`}}/></div><b>{count}</b></div>)}</article>
    </section>

    <section className="fun-section">
      <div className="section-heading"><div><span className="eyebrow">MODO INDECISO</span><h2>Batalha de animes</h2></div><button className="secondary" onClick={resetBattle}><RefreshCw size={15}/> Reiniciar chave</button></div>
      <article className="battle-card">{battleChampion && battleChallenger ? <><BattleChoice item={battleChampion} tag="Campeão atual" onPick={() => pickBattle(battleChampion)}/><div className="versus"><Swords size={24}/><b>VS</b><span>{battleIndex}/{battlePool.length-1}</span></div><BattleChoice item={battleChallenger} tag="Desafiante" onPick={() => pickBattle(battleChallenger)}/></> : battleChampion ? <div className="battle-winner"><Trophy size={34}/><span>Seu campeão desta rodada</span><h3>{battleChampion.title}</h3><p>{battleWins} escolhas feitas</p></div> : <EmptySmall text="Você precisa de pelo menos dois animes concluídos e avaliados."/>}</article>
    </section>

    <section className="fun-section">
      <div className="section-heading"><div><span className="eyebrow">SOCIAL</span><h2>Taste Twins</h2></div></div>
      <article className="compare-card"><div><h3>Compare sua lista com outra pessoa</h3><p>Usa duas listas públicas, cruza títulos e compara apenas notas em comum. O percentual é recreativo, não científico.</p><div className="compare-input"><input value={compareInput} onChange={(e)=>setCompareInput(e.target.value)} placeholder="Username ou link do MAL" onKeyDown={(e)=>e.key==='Enter'&&compareUser()}/><button className="primary compact" onClick={compareUser} disabled={compareLoading}>{compareLoading?'Comparando...':'Comparar'}</button></div>{compareError&&<div className="error">{compareError}</div>}</div>{compareResult&&<div className="compare-result"><div className="compatibility"><strong>{compareResult.compatibility}%</strong><span>compatibilidade</span></div><div><b>{compareResult.common}</b><span>animes em comum</span></div><div><b>{compareResult.rated}</b><span>notas comparáveis</span></div><div><b>{compareResult.avgDiff.toFixed(2)}</b><span>diferença média</span></div>{compareResult.uniqueForThem.length>0&&<div className="compare-recs"><span>O que {compareResult.user} gostou e você ainda não viu:</span><b>{compareResult.uniqueForThem.map((a)=>a.title).join(' · ')}</b></div>}</div>}</article>
    </section>

    <section className="fun-section">
      <div className="section-heading"><div><span className="eyebrow">DESAFIOS</span><h2>Bingo + 3×3</h2></div></div>
      <div className="fun-grid two"><article className="fun-card"><h3>Anime Bingo</h3><p>Clique para marcar quando cumprir um desafio.</p><div className="bingo-grid">{bingo.map((text,index)=><button key={text} className={bingoMarked.has(index)?'marked':''} onClick={()=>setBingoMarked((current)=>{const next=new Set(current); next.has(index)?next.delete(index):next.add(index); return next})}>{bingoMarked.has(index)&&<Check size={18}/>}<span>{text}</span></button>)}</div></article><article className="fun-card"><div className="card-title-row"><div><h3>Desafio 3×3</h3><p>Nove títulos para sair da fila. O progresso fica salvo neste navegador.</p></div><button className="secondary icon-only" onClick={newChallenge} title="Gerar novo desafio"><RefreshCw size={16}/></button></div>{challengeItems.length ? <div className="challenge-grid">{challengeItems.map((item)=><button key={item.id} className={challenge?.done.includes(item.id)?'done':''} onClick={()=>toggleChallenge(item.id)} style={{backgroundImage:`linear-gradient(rgba(10,20,40,.25),rgba(10,20,40,.85)),url(${item.image})`}}><span>{challenge?.done.includes(item.id)?'✓ ':''}{item.title}</span></button>)}</div> : <button className="primary compact" onClick={newChallenge}>Gerar meu 3×3</button>}</article></div>
    </section>

    <section className="fun-section">
      <div className="section-heading"><div><span className="eyebrow">CONQUISTAS</span><h2>Seu mural local</h2></div></div>
      <div className="achievement-grid">{achievements.map((achievement)=><article key={achievement.name} className={`achievement ${achievement.unlocked?'unlocked':''}`}><span>{achievement.emoji}</span><div><b>{achievement.name}</b><small>{achievement.detail}</small></div>{achievement.unlocked&&<Award size={18}/>}</article>)}</div>
    </section>

    <section className="fun-footer-note"><Gamepad2 size={18}/><span>Todo o estado de favoritos, blacklist, bingo e 3×3 fica apenas no seu navegador. Nenhum banco foi adicionado.</span></section>
  </div>
}

function MiniAnime({ item, label }: { item: AnimeItem; label: string }) {
  return <a className="mini-anime" href={item.url} target="_blank" rel="noreferrer"><img src={item.image} alt=""/><div><span>{label}</span><strong>{item.title}</strong><small>{item.episodes ?? '?'} eps · {item.genres.slice(0,2).join(' · ') || 'Sem gênero'}</small></div></a>
}

function RankingCard({ title, subtitle, items }: { title: string; subtitle?: string; items: Array<{ item: AnimeItem; meta: string }> }) {
  return <article className="fun-card"><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}<div className="ranking-list">{items.length ? items.map(({item,meta},index)=><a href={item.url} target="_blank" rel="noreferrer" key={item.id}><span>{index+1}</span><img src={item.image} alt=""/><div><b>{item.title}</b><small>{meta}</small></div></a>) : <EmptySmall text="Precisamos de mais notas MAL carregadas para montar este ranking."/>}</div></article>
}

function BattleChoice({ item, tag, onPick }: { item: AnimeItem; tag: string; onPick: () => void }) {
  return <button className="battle-choice" onClick={onPick}><img src={item.image} alt=""/><span>{tag}</span><strong>{item.title}</strong><small>Sua nota: {item.userScore ?? '—'}</small><em>Escolher</em></button>
}

function EmptySmall({ text }: { text: string }) { return <div className="empty-small">{text}</div> }
