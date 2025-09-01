import type { NextApiRequest, NextApiResponse } from 'next'
import type { Game, SlateResponse } from '@/lib/types'

const CFBD_API_KEY = process.env.CFBD_API_KEY
const ODDS_API_KEY = process.env.ODDS_API_KEY

async function fetchJSON(url: string, init: RequestInit = {}) {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

// Very safe helpers with fallbacks
async function getCFBDGames(): Promise<any[]> {
  if (!CFBD_API_KEY) return []
  const year = new Date().getFullYear()
  // Pull a broad list and filter client-side to the next ~10 days
  const url = `https://api.collegefootballdata.com/games?year=${year}&seasonType=regular`
  return fetchJSON(url, { headers: { Authorization: `Bearer ${CFBD_API_KEY}` } })
}

async function getCFBDRankings(): Promise<any[]> {
  if (!CFBD_API_KEY) return []
  const year = new Date().getFullYear()
  const url = `https://api.collegefootballdata.com/rankings?year=${year}&seasonType=regular`
  return fetchJSON(url, { headers: { Authorization: `Bearer ${CFBD_API_KEY}` } })
}

async function getTeamTalent(): Promise<any[]> {
  if (!CFBD_API_KEY) return []
  const url = `https://api.collegefootballdata.com/talent`
  return fetchJSON(url, { headers: { Authorization: `Bearer ${CFBD_API_KEY}` } })
}

function toWindow(kickoffIso: string): 'Noon'|'Afternoon'|'Prime'|'Late' {
  const d = new Date(kickoffIso)
  const hours = d.getUTCHours() - 4 // crude ET offset; V1: use proper tz
  const h = (hours + 24) % 24
  if (h < 15) return 'Noon'
  if (h < 19) return 'Afternoon'
  if (h < 22) return 'Prime'
  return 'Late'
}

function computeScores(g: Partial<Game>) {
  const spread = Math.abs(g.spread ?? 0)
  const total = g.total ?? 50
  const importance = g.importance ?? 50
  const prospectDensity = g.prospectDensity ?? 60
  const watchability = Math.min(100, (100 - spread*8)*0.5 + Math.min(100, total*1.2)*0.5)
  const drama = 100 - spread*7
  return {
    importance: Math.max(0, Math.min(100, importance)),
    prospectDensity: Math.max(0, Math.min(100, prospectDensity)),
    watchability: Math.round(Math.max(0, Math.min(100, watchability))),
    drama: Math.round(Math.max(0, Math.min(100, drama))),
  }
}

// Demo data (used if no keys or fetch fails)
function demoSlate(): SlateResponse {
  const now = new Date().toISOString()
  const games: Game[] = [
    { id:'g1', window:'Prime', kickoffET:'7:30 PM', network:'ABC', teamA:'Texas', teamB:'Ohio State', rankA:1, rankB:3,
      spread:-2, total:59, importance:97, prospectDensity:93, watchability:88, drama:72,
      importanceSrc:'AP', prospectDensitySrc:'Computed', watchabilitySrc:'Odds', dramaSrc:'Computed', lastUpdated:now,
      why:'#1 vs #3; CFP seeding stakes.' },
    { id:'g2', window:'Afternoon', kickoffET:'3:30 PM', network:'ABC', teamA:'LSU', teamB:'Clemson', rankA:9, rankB:4,
      spread:3, total:55, importance:94, prospectDensity:95, watchability:82, drama:79,
      importanceSrc:'AP', prospectDensitySrc:'Computed', watchabilitySrc:'Odds', dramaSrc:'Computed', lastUpdated:now,
      why:'Top-10 clash with premium front-7 talent.' },
    { id:'g3', window:'Noon', kickoffET:'12:00 PM', network:'FOX', teamA:'Penn State', teamB:'Illinois', rankA:2, rankB:12,
      spread:-6, total:51, importance:91, prospectDensity:87, watchability:72, drama:58,
      importanceSrc:'AP', prospectDensitySrc:'Computed', watchabilitySrc:'Odds', dramaSrc:'Computed', lastUpdated:now,
      why:'B1G positioning; QB showcase.' },
  ]
  return { games, demo:true, updatedAt: now }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<SlateResponse>) {
  try {
    const now = new Date()
    // If no API key, serve demo
    if (!CFBD_API_KEY) return res.status(200).json(demoSlate())

    const [gamesRaw, ranksRaw, talent] = await Promise.all([
      getCFBDGames().catch(()=>[]),
      getCFBDRankings().catch(()=>[]),
      getTeamTalent().catch(()=>[]),
    ])

    // Build map of AP ranks (latest poll object)
    let rankMap = new Map<string, number>()
    if (Array.isArray(ranksRaw) && ranksRaw.length) {
      const latest = ranksRaw[ranksRaw.length - 1]
      if (latest && latest.polls) {
        const ap = latest.polls.find((p:any)=>/AP/i.test(p.poll))
        if (ap && ap.ranks) {
          ap.ranks.forEach((r:any)=> rankMap.set((r.team || r.school || '').toLowerCase(), r.rank))
        }
      }
    }

    // Build team talent map (normalize to 0-100)
    const talents = new Map<string, number>()
    if (Array.isArray(talent)) {
      let vals = talent.map((t:any)=> t.talent || t.talentComposite || t.composite || 0)
      const min = Math.min(...vals), max = Math.max(...vals)
      talent.forEach((t:any)=> {
        const name = (t.team || t.school || '').toLowerCase()
        const raw = t.talent || t.talentComposite || t.composite || 0
        const norm = max===min ? 70 : Math.round(((raw - min) / (max - min))*100)
        talents.set(name, norm)
      })
    }

    // Filter next 10 days
    const cutoff = new Date(now.getTime() + 10*24*3600*1000)
    const upcoming = (gamesRaw || []).filter((g:any)=> {
      const d = new Date(g.start_date || g.startDate || g.start_time || g.startTime || g.start || g.start_time_tbd)
      return d.toString() !== 'Invalid Date' and d < cutoff and d > now
    })

    // Map to our Game objects
    const games: Game[] = (upcoming.length ? upcoming : [])
      .slice(0, 40)
      .map((g:any, idx:number)=> {
        const home = (g.home_team || g.homeTeam || g.home || '').toString()
        const away = (g.away_team || g.awayTeam || g.away || '').toString()
        const network = g.tv || g.network || g.channel || undefined
        const kickIso = g.start_date || g.startDate || g.start_time || g.startTime || new Date().toISOString()
        const rkH = rankMap.get(home.toLowerCase())
        const rkA = rankMap.get(away.toLowerCase())
        const homeTalent = talents.get(home.toLowerCase()) ?? 70
        const awayTalent = talents.get(away.toLowerCase()) ?? 70
        const pd = Math.min(100, Math.round((homeTalent+awayTalent)/2))
        const pre = computeScores({ spread: g.spread, total: g.total, importance: (rkH && rkA) ? 95 : 70, prospectDensity: pd })
        const kickoff = new Date(kickIso).toISOString()
        const w = toWindow(kickoff)
        return {
          id: g.id || `${idx}-${home}-${away}`,
          window: w,
          kickoffET: new Date(kickoff).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour:'numeric', minute:'2-digit' }),
          network,
          teamA: home, teamB: away,
          rankA: rkH, rankB: rkA,
          spread: typeof g.spread === 'number' ? g.spread : undefined,
          total: typeof g.total === 'number' ? g.total : undefined,
          importance: pre.importance,
          importanceSrc: 'AP',
          prospectDensity: pre.prospectDensity,
          prospectDensitySrc: 'Computed',
          watchability: pre.watchability,
          watchabilitySrc: 'Computed',
          drama: pre.drama,
          dramaSrc: 'Computed',
          lastUpdated: now.toISOString(),
          why: (rkH && rkA) ? 'Ranked vs ranked; playoff seeding significance.' : 'Quality matchup with solid talent composite.'
        } as Game
      })

    if (!games.length) {
      return res.status(200).json(demoSlate())
    }

    res.status(200).json({ games, updatedAt: now.toISOString() })
  } catch (e:any) {
    // Fallback to demo on error
    return res.status(200).json(demoSlate())
  }
}
