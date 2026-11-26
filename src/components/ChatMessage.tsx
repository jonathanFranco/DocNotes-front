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
        className="ml-0.5 inline-block rounded bg-pen-wash px-1.5 align-baseline font-sans text-xs font-medium text-pen"
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
        <p className="max-w-[85%] rounded-lg rounded-br-sm bg-ink px-4 py-2.5 text-white">{message.text}</p>
      </div>
    )
  }

  if (message.role === 'error') {
    return (
      <p role="alert" className="border-l-2 border-danger pl-4 text-sm text-danger">
        {message.text}
      </p>
    )
  }

  return (
    <article className="max-w-prose">
      <p className={`font-serif text-lg leading-relaxed ${message.found ? 'text-ink' : 'text-graphite'}`}>
        {withCitations(message.text)}
      </p>
      {message.sources.length > 0 && (
        <details className="group mt-3" open>
          <summary className="cursor-pointer text-sm text-graphite select-none hover:text-ink">
            {message.sources.length === 1 ? 'Trecho usado na resposta' : `${message.sources.length} trechos usados na resposta`}
          </summary>
          <ul className="mt-3 space-y-3">
            {message.sources.map((source, i) => (
              <SourceReference key={i} source={source} />
            ))}
          </ul>
        </details>
      )}
    </article>
  )
}
