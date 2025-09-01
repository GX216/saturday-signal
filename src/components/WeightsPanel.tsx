import { useState, useEffect } from 'react'

export default function WeightsPanel({ onChange }:{ onChange:(w:{importance:number; prospect:number; watchability:number; drama:number})=>void }) {
  const [w, setW] = useState({ importance: 35, prospect: 30, watchability: 20, drama: 15 })

  useEffect(()=>{
    onChange(w)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w])

  function slider(key: keyof typeof w, label: string) {
    return (
      <div className='space-y-1'>
        <div className='flex justify-between text-xs'><span>{label}</span><span>{w[key]}%</span></div>
        <input type='range' min={0} max={100} value={w[key]} onChange={(e)=>{
          const v = parseInt(e.target.value,10)
          setW(prev => ({ ...prev, [key]: v }))
        }} className='w-full' />
      </div>
    )
  }

  return (
    <div className='card p-4 space-y-3'>
      <div className='font-semibold'>Scoring Weights</div>
      {slider('importance','Importance')}
      {slider('prospect','Prospect Density')}
      {slider('watchability','Watchability')}
      {slider('drama','Drama')}
      <div className='text-xs text-slate-300'>Weights auto-normalize; list re-ranks live.</div>
    </div>
  )
}
