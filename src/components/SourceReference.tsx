import type { Source } from '../services/api'

export function SourceReference({ source }: { source: Source }) {
  return (
    <li className="grid grid-cols-[3.5rem_1fr] gap-3">
      <span className="pt-0.5 text-right text-xs font-medium text-graphite tabular-nums">p. {source.page}</span>
      <blockquote className="font-serif text-[0.95rem] leading-relaxed text-ink">
        <mark className="bg-marker/70 [box-decoration-break:clone] px-0.5 text-ink">{source.excerpt}</mark>
      </blockquote>
    </li>
  )
}
