import { Game } from '@/lib/types'
import SourceBadge from './SourceBadge'

function Bar({label, value}:{label:string; value:number}) {
  return (
    <div>
      <div className='flex justify-between text-xs text-slate-300'><span>{label}</span><span>{value}</span></div>
      <div className='h-2 w-full bg-white/10 rounded-full'>
        <div className='h-2 bg-white/70 rounded-full' style={{width:`${value}%`}} />
      </div>
    </div>
  )
}

export default function GameCard({ g, score }: { g: Game; score: number }) {
  return (
    <div className='card p-4'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <div className='text-lg font-semibold'>
            {g.teamA}{g.rankA ? ` (#${g.rankA})` : ''} vs {g.teamB}{g.rankB ? ` (#${g.rankB})` : ''}
          </div>
          <div className='text-sm text-slate-300 mt-0.5'>
            {g.window} • {g.kickoffET} ET{g.network ? ` • ${g.network}` : ''} • Updated {g.lastUpdated ? new Date(g.lastUpdated).toLocaleTimeString() : 'n/a'}
          </div>
        </div>
        <span className='badge'>WatchScore {score}</span>
      </div>

      {g.why && <p className='text-sm text-slate-200 mt-2'>{g.why}</p>}

      <div className='grid grid-cols-2 md:grid-cols-4 gap-3 mt-3'>
        <div><Bar label='Importance' value={g.importance} /><div className='mt-1'><SourceBadge tag={g.importanceSrc}/></div></div>
        <div><Bar label='Prospects' value={g.prospectDensity} /><div className='mt-1'><SourceBadge tag={g.prospectDensitySrc}/></div></div>
        <div><Bar label='Watchability' value={g.watchability} /><div className='mt-1'><SourceBadge tag={g.watchabilitySrc}/></div></div>
        <div><Bar label='Drama' value={g.drama} /><div className='mt-1'><SourceBadge tag={g.dramaSrc}/></div></div>
      </div>
    </div>
  )
}
