import { useEffect, useMemo, useState } from 'react'
import type { Game, SlateResponse } from '@/lib/types'
import GameCard from '@/components/GameCard'
import WeightsPanel from '@/components/WeightsPanel'
import Planner from '@/components/Planner'

function normalizeWeights(w:{importance:number; prospect:number; watchability:number; drama:number}) {
  const sum = w.importance + w.prospect + w.watchability + w.drama
  const n = (v:number)=> v/(sum||1)
  return { wi:n(w.importance), wp:n(w.prospect), ww:n(w.watchability), wd:n(w.drama) }
}
function calcScore(g: Game, w:{importance:number; prospect:number; watchability:number; drama:number}) {
  const nw = normalizeWeights(w)
  return Math.round(
    g.importance*nw.wi + g.prospectDensity*nw.wp + g.watchability*nw.ww + g.drama*nw.wd
  )
}

export default function Home() {
  const [weights, setWeights] = useState({ importance:35, prospect:30, watchability:20, drama:15 })
  const [data, setData] = useState<SlateResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    fetch('/api/slate').then(r=>r.json()).then((j:SlateResponse)=>{
      setData(j); setLoading(false)
    }).catch(()=> setLoading(false))
  }, [])

  const games = useMemo(()=>{
    if (!data) return []
    return data.games.map(g => ({...g, __score: calcScore(g, weights)}))
      .sort((a,b)=> (b.__score||0)-(a.__score||0))
  }, [data, weights])

  const byWindow = useMemo(()=>{
    const map: Record<'Noon'|'Afternoon'|'Prime'|'Late', Game[]> = { Noon:[],Afternoon:[],Prime:[],Late:[] }
    games.forEach(g=>{ (map[g.window] ||= []).push(g) })
    return map
  }, [games])

  return (
    <div className='max-w-6xl mx-auto px-4 py-6 space-y-6'>
      <header className='flex items-start md:items-center justify-between gap-3 flex-col md:flex-row'>
        <div>
          <h1 className='text-2xl md:text-3xl font-bold'>Saturday Signal</h1>
          <p className='text-slate-300'>Draft‑centric CFB watch guide — ranked games, prospect overlays, and an optimized Saturday plan.</p>
        </div>
        <div className='flex items-center gap-2'>
          {data?.demo && <span className='badge'>Demo Mode</span>}
          <a className='btn-ghost' href='https://collegefootballdata.com' target='_blank' rel='noreferrer'>Data sources</a>
        </div>
      </header>

      <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
        <aside className='space-y-6 lg:col-span-1'>
          <WeightsPanel onChange={setWeights} />
          <div className='card p-4 text-sm text-slate-300'>
            <div><b>Last updated:</b> {data ? new Date(data.updatedAt).toLocaleTimeString() : '—'}</div>
            {loading && <div className='mt-1'>Loading…</div>}
          </div>
        </aside>

        <main className='space-y-6 lg:col-span-3'>
          {(['Noon','Afternoon','Prime','Late'] as const).map(w => (
            <section key={w} className='space-y-3'>
              <div className='flex items-center justify-between'>
                <h2 className='text-xl font-semibold'>{w} Window</h2>
                <div className='text-sm text-slate-300'>Top ranked by your weights</div>
              </div>
              <div className='grid grid-cols-1 gap-4'>
                {byWindow[w].length === 0 && <div className='text-slate-300 text-sm'>No games found.</div>}
                {byWindow[w].map(g => <GameCard key={g.id} g={g} score={g.__score || 0} />)}
              </div>
            </section>
          ))}

          <section className='space-y-3'>
            <h2 className='text-xl font-semibold'>Planner</h2>
            <Planner games={games} />
          </section>
        </main>
      </div>

      <footer className='text-xs text-slate-400 pt-6'>
        © {new Date().getFullYear()} Saturday Signal — Sources: CFBD, optional Odds
      </footer>
    </div>
  )
}
