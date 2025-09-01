import { Game } from '@/lib/types'

export default function Planner({ games }: { games: Game[] }) {
  const windows: Array<'Noon'|'Afternoon'|'Prime'|'Late'> = ['Noon','Afternoon','Prime','Late']
  const by: Record<string, Game[]> = { Noon: [], Afternoon: [], Prime: [], Late: [] }
  games.forEach(g => { (by[g.window] ||= []).push(g) })
  return (
    <div className='card p-4'>
      <div className='font-semibold mb-2'>Time‑boxed Viewing (best per window)</div>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
        {windows.map(w => {
          const list = (by[w]||[]).slice(0,2)
          const [primary, alt] = list
          return (
            <div key={w} className='card p-3'>
              <div className='flex items-center justify-between mb-2'>
                <div className='font-medium'>{w}</div>
                <span className='badge'>Recommended</span>
              </div>
              {!primary ? <div className='text-sm text-slate-300'>No games in this window.</div> : (
                <div className='text-sm space-y-1'>
                  <div className='font-semibold'>{primary.teamA} vs {primary.teamB}</div>
                  <div className='text-slate-300'>Kick {primary.kickoffET} ET • Score {primary.__score ?? '—'}</div>
                  {alt && <div className='text-slate-300 mt-2'>Alt: {alt.teamA} vs {alt.teamB} • Score {alt.__score ?? '—'}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
