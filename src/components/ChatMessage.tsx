import type { Source } from '../services/api'
import { SourceReference } from './SourceReference'

export type Message =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; text: string; found: boolean; sources: Source[] }
  | { id: number; role: 'error'; text: string }

function withCitations(text: string) {
  return text.split(/(\(p\.\s*\d+\))/g).map((part, i) => {
    const page = part.match(/^\(p\.\s*(\d+)\)$/)?.[1]
    if (!page) return part
    return (
      <span
        key={i}
        className="ml-0.5 inline-block rounded-md bg-pen-wash px-1.5 align-baseline text-xs font-medium text-pen"
        aria-label={`página ${page}`}
      >
        p. {page}
      </span>
    )
  })
}

export function ChatMessage({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[88%] rounded-2xl rounded-br-md bg-pen px-4 py-2.5 wrap-break-word whitespace-pre-wrap text-paper sm:max-w-[75%]">
          {message.text}
        </p>
      </div>
    )
  }

  if (message.role === 'error') {
    return (
      <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        {message.text}
      </p>
    )
  }

  return (
    <article className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-pen-wash text-xs font-semibold text-pen"
      >
        AI
      </span>
      <div className="min-w-0 flex-1">
        <p className={`leading-relaxed wrap-break-word whitespace-pre-wrap ${message.found ? 'text-ink' : 'text-graphite'}`}>
          {withCitations(message.text)}
        </p>
        {message.sources.length > 0 && (
          <details className="group mt-3" open>
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-graphite select-none hover:text-ink [&::-webkit-details-marker]:hidden">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 6 6 6-6 6" />
              </svg>
              {message.sources.length === 1 ? 'Trecho usado na resposta' : `${message.sources.length} trechos usados na resposta`}
            </summary>
            <ul className="mt-3 space-y-2">
              {message.sources.map((source, i) => (
                <SourceReference key={i} source={source} />
              ))}
            </ul>
          </details>
        )}
      </div>
    </article>
  )
}
