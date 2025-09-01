import type { NextApiRequest, NextApiResponse } from 'next'
import type { Game, SlateResponse } from '@/lib/types'

const CFBD_API_KEY = process.env.CFBD_API_KEY
const ODDS_API_KEY = process.env.ODDS_API_KEY

// Build a map of team -> AP rank (latest available)
function buildRankMap(ranksRaw:any[]): Map<string, number> {
  const m = new Map<string, number>()
  if (!Array.isArray(ranksRaw)) return m
  // Flatten all polls, grab AP entries, prefer the most recent week
  for (const wk of ranksRaw) {
    const polls = (wk && wk.polls) || []
    for (const p of polls) {
      const isAP = /AP/i.test(p.poll || '')
      if (!isAP) continue
      for (const r of (p.ranks || [])) {
        const name = (r.team || r.school || r.name || '').toString().toLowerCase()
        const rank = Number(r.rank || r.current || r.value)
        if (!name || !rank) continue
        // newer weeks overwrite older
        m.set(name, rank)
      }
    }
  }
  return m
}

// Derive a pseudo-spread/total if odds are missing, using team talent
function deriveLines(homeTalent:number, awayTalent:number) {
  const diff = Math.max(-40, Math.min(40, homeTalent - awayTalent))
  // Convert talent diff to roughly a point spread (very rough heuristic)
  const spread = Math.round((diff) / 6)  // ±6-7 points for big mismatches
  // Higher combined talent -> higher total; keep in realistic range
  const avg = (homeTalent + awayTalent) / 2
  const total = Math.max(40, Math.min(74, Math.round(46 + (avg * 0.35))))
  return { spread, total }
}
// FBS conference names (lowercased) for filtering
const FBS_CONFS = new Set([
  'sec','big ten','big 12','acc','pac-12','pac-10','pac','american athletic','aac','mountain west','sun belt','conference usa','c-usa','mid-american','mac','independent','fbs independents','notre dame'
]);

// Return true if a game is FBS vs FBS (or at least one FBS vs strong opponent)
function isFBSGame(g:any){
  const div = (g.division || g.division_name || '').toString().toLowerCase()
  if (div.includes('fbs')) return true
  const hc = (g.home_conference || g.homeConference || g.home_conf || '').toString().toLowerCase()
  const ac = (g.away_conference || g.awayConference || g.away_conf || '').toString().toLowerCase()
  const ht = (g.home_team || g.homeTeam || g.home || '').toString().toLowerCase()
  const at = (g.away_team || g.awayTeam || g.away || '').toString().toLowerCase()
  const fbsConf = (s:string)=> Array.from(FBS_CONFS).some(k=> s.includes(k))
  return fbsConf(hc) || fbsConf(ac) || ht.includes('notre dame') || at.includes('notre dame')
}


// ET window using Intl timezone (no hard-coded offsets)
function formatETDate(d: Date) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }).format(d)
}
function formatETTime(d: Date) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(d)
}

function windowFromET(d: Date): 'Noon'|'Afternoon'|'Prime'|'Late' {
  const hour24 = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }).format(d), 10)
  if (hour24 < 15) return 'Noon'
  if (hour24 < 19) return 'Afternoon'
  if (hour24 < 22) return 'Prime'
  return 'Late'
}


async function fetchJSON(url: string, init: RequestInit = {}) {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

// Very safe helpers with fallbacks
async function getCFBDGames(): Promise<any[]> {
  if (!CFBD_API_KEY) return []
  const year = new Date().getFullYear()
  // Pull a broad list && filter client-side to the next ~10 days
  const url = `https://api.collegefootballdata.com/games?year=${year}&seasonType=regular&division=fbs`
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

/* replaced by windowFromET */
function toWindow(kickoffIso: string): 'Noon'|'Afternoon'|'Prime'|'Late' {
  const d = new Date(kickoffIso)
  const hours = d.getUTCHours() - 4
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
    let rankMap = buildRankMap(ranksRaw as any[])

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
    const upcoming = (gamesRaw || []).filter((g:any)=>{
      const d = new Date(g.start_date || g.startDate || g.start_time || g.startTime || g.start || g.start_time_tbd)
      return d.toString() !== 'Invalid Date' && d < cutoff && d > now && isFBSGame(g)
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
        const derived = deriveLines(homeTalent, awayTalent);
        const pre = computeScores({ spread: typeof g.spread==='number'? g.spread : derived.spread, total: typeof g.total==='number'? g.total : derived.total, importance: (rkH && rkA) ? 95 : (rkH || rkA) ? 80 : 65, prospectDensity: pd })
        const kickoff = new Date(kickIso).toISOString()
        const w = windowFromET(new Date(kickoff))
        return {
          id: g.id || `${idx}-${home}-${away}`,
          window: w,
          kickoffET: formatETTime(new Date(kickoff)),
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
          kickoffDate: formatETDate(new Date(kickoff)),
          kickoffISO: kickoff,
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
