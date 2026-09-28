import { useEffect, useMemo, useState } from 'react'
import { Check, Gamepad2, RefreshCw, Swords, Trophy } from 'lucide-react'
import { DiscoveryLab } from './DiscoveryLab'
import { getBlacklist, loadChallenge, saveChallenge } from '../storage'
import type { AnimeItem } from '../types'

type Props = {
  anime: AnimeItem[]
  username: string
  source: 'demo' | 'mal'
}

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

export function GamesZone({ anime, username, source }: Props) {
  const blacklist = useMemo(() => getBlacklist(), [anime])
  const history = useMemo(() => anime.filter((item) => item.status !== 'plan_to_watch'), [anime])
  const planned = useMemo(() => anime.filter((item) => item.status === 'plan_to_watch' && !blacklist.has(item.id)), [anime, blacklist])
  const rated = useMemo(() => history.filter((item) => (item.userScore ?? 0) > 0), [history])
  const genres = useMemo(() => [...new Set(planned.flatMap((item) => item.genres))].sort(), [planned])

  const [rouletteGenre, setRouletteGenre] = useState('all')
  const [rouletteMax, setRouletteMax] = useState('24')
  const [roulette, setRoulette] = useState<AnimeItem | null>(null)
  const [surprise, setSurprise] = useState<AnimeItem | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [battlePool, setBattlePool] = useState<AnimeItem[]>(() => shuffle(history.filter((item) => item.status === 'completed' && item.userScore !== null)).slice(0, 12))
  const [battleChampion, setBattleChampion] = useState<AnimeItem | null>(() => battlePool[0] ?? null)
  const [battleIndex, setBattleIndex] = useState(1)
  const [battleWins, setBattleWins] = useState(0)
  const [bingoMarked, setBingoMarked] = useState<Set<number>>(() => new Set())
  const [challenge, setChallenge] = useState(() => loadChallenge())
  const animeKey = useMemo(() => anime.map((item) => item.id).join(','), [anime])

  useEffect(() => {
    const pool = shuffle(history.filter((item) => item.status === 'completed' && item.userScore !== null)).slice(0, 12)
    setBattlePool(pool)
    setBattleChampion(pool[0] ?? null)
    setBattleIndex(1)
    setBattleWins(0)
    setRoulette(null)
    setSurprise(null)
  }, [animeKey])

  const affinity = useMemo(() => {
    const map = new Map<string, number[]>()
    rated.filter((item) => (item.userScore ?? 0) >= 7).forEach((item) => item.genres.forEach((genre) => map.set(genre, [...(map.get(genre) ?? []), item.userScore ?? 0])))
    return new Map([...map.entries()].map(([genre, scores]) => [genre, scores.reduce((a, b) => a + b, 0) / scores.length]))
  }, [rated])

  const recommendation = useMemo(() => {
    const candidates = planned.map((item) => ({
      item,
      score: item.genres.reduce((sum, genre) => sum + (affinity.get(genre) ?? 5), 0) / Math.max(1, item.genres.length) + ((item.meanScore ?? 0) / 5),
    })).sort((a, b) => b.score - a.score)
    return randomOne(candidates.slice(0, Math.min(5, candidates.length)))?.item ?? null
  }, [planned, affinity])

  const featured = roulette ?? surprise ?? recommendation ?? history[0] ?? null
  const battleChallenger = battlePool[battleIndex] ?? null
  const challengeItems = (challenge?.ids ?? []).map((id) => anime.find((item) => item.id === id)).filter((item): item is AnimeItem => Boolean(item))

  const bingo = [
    'Anime dos anos 90 ou antes', 'Até 12 episódios', 'Nota pessoal 9 ou 10',
    'Fantasia ou aventura', 'Sci-Fi ou mecha', 'Anime que você dropou',
    'Mais de 50 episódios', 'Está no Plan to Watch', 'Gênero que você quase não vê',
  ]

  function spinRoulette() {
    const pool = planned.filter((item) => (rouletteGenre === 'all' || item.genres.includes(rouletteGenre)) && (!rouletteMax || item.episodes === null || item.episodes <= Number(rouletteMax)))
    setRoulette(randomOne(pool))
  }

  function nextSurprise() {
    setSurprise(randomOne(planned))
    setRevealed(false)
  }

  function resetBattle() {
    const pool = shuffle(history.filter((item) => item.status === 'completed' && item.userScore !== null)).slice(0, 12)
    setBattlePool(pool)
    setBattleChampion(pool[0] ?? null)
    setBattleIndex(1)
    setBattleWins(0)
  }

  function pickBattle(winner: AnimeItem) {
    setBattleChampion(winner)
    setBattleWins((wins) => wins + 1)
    setBattleIndex((index) => index + 1)
  }

  function newChallenge() {
    const pool = planned.length >= 9 ? planned : history.filter((item) => item.status !== 'dropped')
    const state = { ids: shuffle(pool).slice(0, 9).map((item) => item.id), done: [] as number[] }
    setChallenge(state)
    saveChallenge(state)
  }

  function toggleChallenge(id: number) {
    if (!challenge) return
    const done = challenge.done.includes(id) ? challenge.done.filter((value) => value !== id) : [...challenge.done, id]
    const next = { ...challenge, done }
    setChallenge(next)
    saveChallenge(next)
  }

  return <div className="fun-zone games-zone">
    <section className="fun-hero games-hero" style={featured?.image ? { backgroundImage: `linear-gradient(90deg, rgba(10,18,40,.96), rgba(18,35,72,.82)), url(${featured.image})` } : undefined}>
      <div><span className="eyebrow light">MAL SHEET · JOGOS · {source === 'demo' ? 'DEMO' : username}</span><h2>Escolha, descubra e teste sua memória.</h2><p>A fila entra nos jogos quando faz sentido; as estatísticas ficaram separadas para não misturar intenção de assistir com histórico real.</p></div>
      <div className="hero-stats"><div><b>{history.length}</b><span>no histórico</span></div><div><b>{planned.length}</b><span>na fila</span></div><div><b>{battlePool.length}</b><span>na batalha</span></div><div><b>{challengeItems.length}</b><span>no 3×3</span></div></div>
    </section>

    <DiscoveryLab anime={anime} username={username}/>

    <section className="fun-section">
      <div className="section-heading"><div><span className="eyebrow">ESCOLHA RÁPIDA</span><h2>O que assistir agora?</h2></div></div>
      <div className="fun-grid three">
        <article className="fun-card accent"><div className="card-icon">🎲</div><h3>Roleta</h3><p>Sorteia dentro do Plan to Watch.</p><div className="inline-controls"><select value={rouletteGenre} onChange={(e) => setRouletteGenre(e.target.value)}><option value="all">Qualquer gênero</option>{genres.map((genre) => <option key={genre}>{genre}</option>)}</select><select value={rouletteMax} onChange={(e) => setRouletteMax(e.target.value)}><option value="">Qualquer duração</option><option value="12">Até 12 eps</option><option value="24">Até 24 eps</option><option value="50">Até 50 eps</option></select></div><button className="primary compact" onClick={spinRoulette}><RefreshCw size={16}/> Girar</button>{roulette && <MiniAnime item={roulette} label="A roleta escolheu"/>}</article>
        <article className="fun-card"><div className="card-icon">🧠</div><h3>Recomendação da sua fila</h3><p>Prioriza gêneros que você costuma avaliar bem.</p>{recommendation ? <MiniAnime item={recommendation} label="Match de gosto"/> : <EmptySmall text="Adicione títulos ao Plan to Watch para usar."/>}</article>
        <article className="fun-card"><div className="card-icon">🎭</div><h3>Modo surpresa</h3><p>Escolha antes de ver o título.</p><button className="secondary" onClick={nextSurprise}>Nova surpresa</button>{surprise && <div className="surprise-card"><img className={revealed ? '' : 'blurred'} src={surprise.image} alt=""/><div><span>{surprise.episodes ?? '?'} eps · {surprise.genres.slice(0,2).join(' · ')}</span><strong>{revealed ? surprise.title : '???'}</strong><button className="text-button" onClick={() => setRevealed((value) => !value)}>{revealed ? 'Esconder' : 'Revelar anime'}</button></div></div>}</article>
      </div>
    </section>

    <section className="fun-section">
      <div className="section-heading"><div><span className="eyebrow">MODO INDECISO</span><h2>Batalha de animes</h2></div><button className="secondary" onClick={resetBattle}><RefreshCw size={15}/> Reiniciar chave</button></div>
      <article className="battle-card">{battleChampion && battleChallenger ? <><BattleChoice item={battleChampion} tag="Campeão atual" onPick={() => pickBattle(battleChampion)}/><div className="versus"><Swords size={24}/><b>VS</b><span>{battleIndex}/{battlePool.length-1}</span></div><BattleChoice item={battleChallenger} tag="Desafiante" onPick={() => pickBattle(battleChallenger)}/></> : battleChampion ? <div className="battle-winner"><Trophy size={34}/><span>Seu campeão desta rodada</span><h3>{battleChampion.title}</h3><p>{battleWins} escolhas feitas</p></div> : <EmptySmall text="Você precisa de pelo menos dois animes concluídos e avaliados."/>}</article>
    </section>

    <section className="fun-section">
      <div className="section-heading"><div><span className="eyebrow">DESAFIOS</span><h2>Bingo + 3×3</h2></div></div>
      <div className="fun-grid two">
        <article className="fun-card"><h3>Anime Bingo</h3><p>Clique para marcar quando cumprir um desafio.</p><div className="bingo-grid">{bingo.map((text,index)=><button key={text} className={bingoMarked.has(index)?'marked':''} onClick={()=>setBingoMarked((current)=>{const next=new Set(current); next.has(index)?next.delete(index):next.add(index); return next})}>{bingoMarked.has(index)&&<Check size={18}/>}<span>{text}</span></button>)}</div></article>
        <article className="fun-card"><div className="card-title-row"><div><h3>Desafio 3×3</h3><p>Nove títulos para sair da fila. O progresso fica salvo neste navegador.</p></div><button className="secondary icon-only" onClick={newChallenge}><RefreshCw size={16}/></button></div>{challengeItems.length ? <div className="challenge-grid">{challengeItems.map((item)=><button key={item.id} className={challenge?.done.includes(item.id)?'done':''} onClick={()=>toggleChallenge(item.id)} style={{backgroundImage:`linear-gradient(rgba(10,20,40,.25),rgba(10,20,40,.85)),url(${item.image})`}}><span>{challenge?.done.includes(item.id)?'✓ ':''}{item.title}</span></button>)}</div> : <button className="primary compact" onClick={newChallenge}>Gerar meu 3×3</button>}</article>
      </div>
    </section>

    <section className="fun-footer-note"><Gamepad2 size={18}/><span>Jogos, fila local e desafios continuam somente no navegador.</span></section>
  </div>
}

function MiniAnime({ item, label }: { item: AnimeItem; label: string }) {
  return <a className="mini-anime" href={item.url} target="_blank" rel="noreferrer"><img src={item.image} alt=""/><div><span>{label}</span><strong>{item.title}</strong><small>{item.episodes ?? '?'} eps · {item.genres.slice(0,2).join(' · ') || 'Sem gênero'}</small></div></a>
}

function BattleChoice({ item, tag, onPick }: { item: AnimeItem; tag: string; onPick: () => void }) {
  return <button className="battle-choice" onClick={onPick}><img src={item.image} alt=""/><span>{tag}</span><strong>{item.title}</strong><small>Sua nota: {item.userScore ?? '—'}</small><em>Escolher</em></button>
}

function EmptySmall({ text }: { text: string }) {
  return <div className="empty-small">{text}</div>
}
