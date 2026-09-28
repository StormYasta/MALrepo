import { useMemo, useState } from 'react'
import { Award, Download, Sparkles } from 'lucide-react'
import { fetchAnimeMeanScore } from '../jikanScores'
import { fetchUserAnimeList } from '../malApi'
import { getFavorites } from '../storage'
import type { AnimeItem } from '../types'

type Props = {
  anime: AnimeItem[]
  username: string
  source: 'demo' | 'mal'
  onScore: (id: number, score: number) => void
}

type GenreStat = { name: string; count: number; avg: number }

function formatWatchTime(episodes: number) {
  const minutes = episodes * 24
  return { hours: Math.round(minutes / 60), days: (minutes / 1440).toFixed(1) }
}

function getGenreStats(items: AnimeItem[]): GenreStat[] {
  const map = new Map<string, { count: number; ratings: number[] }>()
  items.forEach((item) => item.genres.forEach((genre) => {
    const current = map.get(genre) ?? { count: 0, ratings: [] }
    current.count += 1
    if ((item.userScore ?? 0) > 0) current.ratings.push(item.userScore as number)
    map.set(genre, current)
  }))

  return [...map.entries()].map(([name, value]) => ({
    name,
    count: value.count,
    avg: value.ratings.length ? value.ratings.reduce((a, b) => a + b, 0) / value.ratings.length : 0,
  })).sort((a, b) => b.count - a.count)
}

export function StatsZone({ anime, username, source, onScore }: Props) {
  const [enriching, setEnriching] = useState(false)
  const [compareInput, setCompareInput] = useState('')
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError] = useState('')
  const [compareResult, setCompareResult] = useState<{ user: string; common: number; rated: number; avgDiff: number; compatibility: number; uniqueForThem: AnimeItem[] } | null>(null)

  const history = useMemo(() => anime.filter((item) => item.status !== 'plan_to_watch'), [anime])
  const completed = useMemo(() => history.filter((item) => item.status === 'completed'), [history])
  const rated = useMemo(() => history.filter((item) => (item.userScore ?? 0) > 0), [history])
  const scoredBoth = useMemo(() => rated.filter((item) => item.meanScore !== null), [rated])
  const genreStats = useMemo(() => getGenreStats(history), [history])
  const watchedEpisodes = useMemo(() => history.reduce((sum, item) => sum + item.watchedEpisodes, 0), [history])
  const watchTime = useMemo(() => formatWatchTime(watchedEpisodes), [watchedEpisodes])
  const favorites = useMemo(() => getFavorites(), [anime])
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
  const hallShame = useMemo(() => history.filter((item) => item.status === 'dropped').sort((a, b) => (b.meanScore ?? 0) - (a.meanScore ?? 0)).slice(0, 5), [history])

  const radar = genreStats.slice(0, 6)
  const radarPoints = radar.map((stat, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, radar.length)
    const radius = 42 * (stat.count / Math.max(1, radar[0]?.count ?? 1))
    return `${50 + Math.cos(angle) * radius},${50 + Math.sin(angle) * radius}`
  }).join(' ')

  const longestCompleted = [...completed].filter((item) => item.episodes).sort((a, b) => (b.episodes ?? 0) - (a.episodes ?? 0))[0]
  const lowestFinished = [...completed].filter((item) => item.userScore !== null).sort((a, b) => (a.userScore ?? 99) - (b.userScore ?? 99))[0]
  const peakDecade = [...decades].sort((a, b) => b[1] - a[1])[0]

  const achievements = [
    { emoji: '🏁', name: 'Primeiros 50', unlocked: completed.length >= 50, detail: `${completed.length}/50 completos` },
    { emoji: '💯', name: 'Centenário', unlocked: completed.length >= 100, detail: `${completed.length}/100 completos` },
    { emoji: '📺', name: 'Mil episódios', unlocked: watchedEpisodes >= 1000, detail: `${watchedEpisodes.toLocaleString('pt-BR')} episódios` },
    { emoji: '🧭', name: 'Explorador de gêneros', unlocked: genreStats.length >= 15, detail: `${genreStats.length} gêneros no histórico` },
    { emoji: '🕰️', name: 'Viajante do tempo', unlocked: decades.length >= 4, detail: `${decades.length} décadas` },
    { emoji: '💔', name: 'Sem piedade', unlocked: history.filter((item) => item.status === 'dropped').length >= 10, detail: `${history.filter((item) => item.status === 'dropped').length} drops` },
  ]

  async function enrichAnalysis() {
    if (enriching) return
    setEnriching(true)
    for (const item of rated.filter((item) => item.meanScore === null).slice(0, 20)) {
      const score = await fetchAnimeMeanScore(item.id)
      if (score !== null) onScore(item.id, score)
    }
    setEnriching(false)
  }

  async function compareUser() {
    setCompareLoading(true)
    setCompareError('')
    setCompareResult(null)
    try {
      const other = await fetchUserAnimeList(compareInput)
      const mine = new Map(history.map((item) => [item.id, item]))
      const otherHistory = other.items.filter((item) => item.status !== 'plan_to_watch')
      const common = otherHistory.filter((item) => mine.has(item.id))
      const ratedCommon = common.filter((item) => item.userScore !== null && (mine.get(item.id)?.userScore ?? null) !== null)
      const avgDiff = ratedCommon.length ? ratedCommon.reduce((sum, item) => sum + Math.abs((item.userScore ?? 0) - (mine.get(item.id)?.userScore ?? 0)), 0) / ratedCommon.length : 0
      const compatibility = ratedCommon.length ? Math.max(0, Math.round(100 - avgDiff * 10)) : 0
      const uniqueForThem = otherHistory.filter((item) => !mine.has(item.id) && (item.userScore ?? 0) >= 8).slice(0, 5)
      setCompareResult({ user: other.username, common: common.length, rated: ratedCommon.length, avgDiff, compatibility, uniqueForThem })
    } catch (error) {
      setCompareError(error instanceof Error ? error.message : 'Não foi possível comparar as listas.')
    } finally {
      setCompareLoading(false)
    }
  }

  function downloadDnaCard() {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1080
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1080)
    gradient.addColorStop(0, '#172554')
    gradient.addColorStop(1, '#2e51a2')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 1080, 1080)
    ctx.fillStyle = '#fff'
    ctx.font = '700 70px Arial'
    ctx.fillText('Meu Anime DNA', 80, 130)
    ctx.font = '400 32px Arial'
    ctx.fillStyle = '#dbeafe'
    ctx.fillText(username || 'MAL Sheet', 80, 185)
    ctx.font = '700 56px Arial'
    ctx.fillStyle = '#fff'
    ctx.fillText(`${completed.length}`, 80, 320)
    ctx.font = '400 25px Arial'
    ctx.fillStyle = '#bfdbfe'
    ctx.fillText('animes completos', 80, 360)
    ctx.font = '700 56px Arial'
    ctx.fillStyle = '#fff'
    ctx.fillText(`${watchTime.days} dias`, 560, 320)
    ctx.font = '400 25px Arial'
    ctx.fillStyle = '#bfdbfe'
    ctx.fillText('estimados assistindo', 560, 360)
    ctx.font = '700 36px Arial'
    ctx.fillStyle = '#fff'
    ctx.fillText('Top gêneros', 80, 480)
    genreStats.slice(0, 5).forEach((stat, index) => {
      ctx.font = '600 30px Arial'
      ctx.fillStyle = '#e0e7ff'
      ctx.fillText(`${index + 1}. ${stat.name} — ${stat.count}`, 95, 540 + index * 58)
    })
    ctx.font = '700 36px Arial'
    ctx.fillStyle = '#fff'
    ctx.fillText(`Média pessoal: ${avgUser ? avgUser.toFixed(2) : '—'}`, 80, 880)
    ctx.font = '400 24px Arial'
    ctx.fillStyle = '#bfdbfe'
    ctx.fillText('Gerado por MAL Sheet', 80, 990)
    const link = document.createElement('a')
    link.download = `mal-sheet-${username || 'anime-dna'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const featured = hallFame[0] ?? completed[0] ?? history[0] ?? null

  return <div className="fun-zone stats-zone">
    <section className="fun-hero stats-hero" style={featured?.image ? { backgroundImage: `linear-gradient(90deg, rgba(10,18,40,.96), rgba(18,35,72,.82)), url(${featured.image})` } : undefined}>
      <div><span className="eyebrow light">MAL SHEET · ESTATÍSTICAS · {source === 'demo' ? 'DEMO' : username}</span><h2>Seu histórico, sem a fila distorcendo os números.</h2><p>Títulos em Plan to Watch não entram no Anime DNA nem nas métricas desta página.</p></div>
      <div className="hero-stats"><div><b>{history.length}</b><span>no histórico</span></div><div><b>{completed.length}</b><span>completos</span></div><div><b>{watchTime.days}</b><span>dias estimados</span></div><div><b>{favorites.size}</b><span>favoritos locais</span></div></div>
    </section>

    <section className="fun-section">
      <div className="section-heading"><div><span className="eyebrow">SEU PERFIL</span><h2>Anime DNA</h2></div><div className="heading-actions"><button className="secondary" onClick={enrichAnalysis} disabled={enriching}><Sparkles size={15}/>{enriching ? ' Analisando...' : ' Completar notas MAL'}</button><button className="secondary" onClick={downloadDnaCard}><Download size={15}/> Baixar card</button></div></div>
      <div className="dna-grid">
        <article className="fun-card radar-card"><h3>Radar de gêneros</h3>{radar.length >= 3 ? <div className="radar-wrap"><svg viewBox="0 0 100 100"><polygon className="radar-bg" points="50,7 87,28 87,72 50,93 13,72 13,28"/><polygon className="radar-data" points={radarPoints}/>{radar.map((stat, i) => { const angle = -Math.PI/2 + (Math.PI*2*i)/radar.length; return <text key={stat.name} x={50+Math.cos(angle)*48} y={50+Math.sin(angle)*48} textAnchor="middle">{stat.name.slice(0,10)}</text> })}</svg></div> : <EmptySmall text="Poucos gêneros no histórico para montar o radar."/>}</article>
        <article className="fun-card"><h3>Assinatura do gosto</h3><div className="dna-list">{genreStats.slice(0,6).map((stat, index) => <div key={stat.name}><span>{index+1}. {stat.name}</span><b>{stat.count} títulos · {stat.avg ? `★ ${stat.avg.toFixed(1)}` : 'sem notas'}</b></div>)}</div></article>
        <article className="fun-card meter-card"><h3>Mainstream meter</h3><div className="meter"><div style={{width:`${mainstream ?? 0}%`}}/></div><strong>{mainstream === null ? '—' : `${mainstream}%`}</strong><p>{mainstream === null ? 'A Nota MAL ainda está sendo enriquecida.' : mainstream >= 80 ? 'Seu gosto acompanha bastante o consenso.' : mainstream >= 60 ? 'Você alterna entre consenso e hot takes.' : 'Você definitivamente tem opiniões próprias.'}</p><small>Baseado somente em títulos do seu histórico que têm sua nota e Nota MAL.</small></article>
      </div>
    </section>

    <section className="fun-section">
      <div className="section-heading"><div><span className="eyebrow">EU × MAL</span><h2>Opiniões fortes</h2><p className="section-copy">Comparamos a sua nota com a média pública do MAL. Hot Takes mostram as maiores divergências; Hidden Gems são títulos que você valorizou mais; Hall da Fama prioriza suas maiores notas; Hall da Vergonha destaca títulos bem avaliados pelo público que você abandonou.</p></div></div>
      <div className="fun-grid three"><RankingCard title="🔥 Hot Takes" items={hotTakes.map(({item,delta}) => ({item, meta:`${delta >= 0 ? '+' : ''}${delta.toFixed(2)} vs MAL`}))}/><RankingCard title="💎 Hidden Gems" items={hiddenGems.map(({item,delta}) => ({item, meta:`Você +${delta.toFixed(2)}`}))}/><RankingCard title="🏆 Hall da Fama" items={hallFame.map((item) => ({item, meta:`Sua nota ${item.userScore ?? '—'}`}))}/></div>
      <div className="fun-grid two lower-grid"><RankingCard title="🙈 Hall da Vergonha" subtitle="Boa média MAL, mas você abandonou." items={hallShame.map((item) => ({item, meta:`MAL ${item.meanScore?.toFixed(2) ?? '…'}`}))}/><article className="fun-card"><h3>Estatísticas estranhamente específicas</h3><div className="weird-stats"><div><span>Maior anime concluído</span><b>{longestCompleted ? `${longestCompleted.title} · ${longestCompleted.episodes} eps` : '—'}</b></div><div><span>Menor nota que você terminou</span><b>{lowestFinished ? `${lowestFinished.title} · ${lowestFinished.userScore}/10` : '—'}</b></div><div><span>Década dominante</span><b>{peakDecade ? `${peakDecade[0]}s · ${peakDecade[1]} títulos` : '—'}</b></div><div><span>Tempo aproximado</span><b>{watchTime.hours.toLocaleString('pt-BR')} horas</b></div></div></article></div>
    </section>

    <section className="fun-section">
      <div className="section-heading"><div><span className="eyebrow">LINHA DO TEMPO</span><h2>Mapa por décadas</h2></div></div>
      <article className="fun-card decade-card">{decades.map(([decade,count]) => <div className="decade-row" key={decade}><span>{decade}s</span><div><i style={{width:`${Math.max(4,(count/maxDecade)*100)}%`}}/></div><b>{count}</b></div>)}</article>
    </section>

    <section className="fun-section">
      <div className="section-heading"><div><span className="eyebrow">SOCIAL</span><h2>Taste Twins</h2></div></div>
      <article className="compare-card"><div><h3>Compare seu histórico com outra pessoa</h3><p>Plan to Watch é ignorado na comparação. Cruzamos títulos que ambos realmente começaram/concluíram e comparamos as notas em comum.</p><div className="compare-input"><input value={compareInput} onChange={(e)=>setCompareInput(e.target.value)} placeholder="Username ou link do MAL" onKeyDown={(e)=>e.key==='Enter'&&compareUser()}/><button className="primary compact" onClick={compareUser} disabled={compareLoading}>{compareLoading?'Comparando...':'Comparar'}</button></div>{compareError&&<div className="error">{compareError}</div>}</div>{compareResult&&<div className="compare-result"><div className="compatibility"><strong>{compareResult.compatibility}%</strong><span>compatibilidade</span></div><div><b>{compareResult.common}</b><span>animes em comum</span></div><div><b>{compareResult.rated}</b><span>notas comparáveis</span></div><div><b>{compareResult.avgDiff.toFixed(2)}</b><span>diferença média</span></div>{compareResult.uniqueForThem.length>0&&<div className="compare-recs"><span>O que {compareResult.user} gostou e você ainda não viu:</span><b>{compareResult.uniqueForThem.map((item)=>item.title).join(' · ')}</b></div>}</div>}</article>
    </section>

    <section className="fun-section">
      <div className="section-heading"><div><span className="eyebrow">CONQUISTAS</span><h2>Seu mural</h2></div></div>
      <div className="achievement-grid">{achievements.map((achievement)=><article key={achievement.name} className={`achievement ${achievement.unlocked?'unlocked':''}`}><span>{achievement.emoji}</span><div><b>{achievement.name}</b><small>{achievement.detail}</small></div>{achievement.unlocked&&<Award size={18}/>}</article>)}</div>
    </section>
  </div>
}

function RankingCard({ title, subtitle, items }: { title: string; subtitle?: string; items: Array<{ item: AnimeItem; meta: string }> }) {
  return <article className="fun-card"><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}<div className="ranking-list">{items.length ? items.map(({item,meta},index)=><a href={item.url} target="_blank" rel="noreferrer" key={item.id}><span>{index+1}</span><img src={item.image} alt=""/><div><b>{item.title}</b><small>{meta}</small></div></a>) : <EmptySmall text="Precisamos de mais dados comparáveis para montar este ranking."/>}</div></article>
}

function EmptySmall({ text }: { text: string }) {
  return <div className="empty-small">{text}</div>
}
