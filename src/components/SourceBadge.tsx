import { SourceTag } from '@/lib/types'

export default function SourceBadge({ tag }: { tag?: SourceTag }) {
  if (!tag) return null
  const className = tag === 'Computed' ? 'badge opacity-70' : 'badge'
  return <span className={className}>{tag}</span>
}
