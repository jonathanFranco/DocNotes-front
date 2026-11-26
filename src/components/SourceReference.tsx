import type { Source } from '../services/api'

export function SourceReference({ source }: { source: Source }) {
  return (
    <li className="flex gap-3 rounded-xl border border-rule bg-sheet p-3 sm:p-4">
      <span className="h-fit shrink-0 rounded-md bg-raised px-2 py-0.5 text-xs font-medium text-graphite tabular-nums">
        p. {source.page}
      </span>
      <blockquote className="min-w-0 text-sm leading-relaxed wrap-break-word text-ink/90">
        <mark className="bg-marker/15 [box-decoration-break:clone] px-0.5 text-marker">{source.excerpt}</mark>
      </blockquote>
    </li>
  )
}
