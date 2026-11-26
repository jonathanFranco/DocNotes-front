import { useEffect, useState } from 'react'
import { describeError, errorText, getSummary, retrySummary, type SummaryPoint, type SummaryResponse } from '../services/api'

const POLL_MS = 1000

function withCitations(text: string) {
  return text.split(/(\(p\.\s*\d+\))/g).map((part, i) => {
    const page = part.match(/^\(p\.\s*(\d+)\)$/)?.[1]
    if (!page) return part
    return (
      <span
        key={i}
        className="ml-1 inline-block rounded-md bg-pen-wash px-1.5 align-baseline text-xs font-medium text-pen tabular-nums"
        aria-label={`página ${page}`}
      >
        p. {page}
      </span>
    )
  })
}

export function Summary({ documentId }: { documentId: string }) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    let timer: number | undefined

    async function poll() {
      try {
        const next = await getSummary()
        if (!active) return
        setSummary(next)
        setRequestError(null)
        if (next.status === 'generating') timer = window.setTimeout(poll, POLL_MS)
      } catch (error) {
        if (active) setRequestError(errorText(error))
      }
    }

    void poll()
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [documentId, attempt])

  async function retry() {
    setRequestError(null)
    if (summary?.status === 'failed') {
      try {
        setSummary(await retrySummary())
      } catch (error) {
        setRequestError(errorText(error))
        return
      }
    }
    setAttempt((n) => n + 1)
  }

  if (requestError) return <Failure message={requestError} onRetry={retry} />
  if (!summary) return <Dots label="Preparando o resumo" />
  if (summary.status === 'failed') {
    const message = summary.error ? describeError(summary.error.code, summary.error.params) : 'Algo deu errado ao gerar o resumo.'
    return <Failure message={message} onRetry={retry} />
  }
  if (summary.stage === 'reading') return <Reading progress={summary.progress} />

  const generating = summary.status === 'generating'
  const checking = summary.stage === 'checking'
  const count = summary.points.length
  const unconfirmed = summary.points.filter((point) => point.verified === false).length
  const status =
    summary.stage === 'writing'
      ? 'Escrevendo…'
      : checking
        ? `Conferindo ${Math.min((summary.progress?.done ?? 0) + 1, count)} de ${count}…`
        : `${count} ${count === 1 ? 'ponto' : 'pontos'}${unconfirmed ? ` · ${unconfirmed} não confirmado${unconfirmed > 1 ? 's' : ''}` : ''}`

  return (
    <section aria-labelledby="summary-title">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
        <h2 id="summary-title" className="text-lg font-semibold tracking-tight">
          Resumo
        </h2>
        <p role="status" className="text-sm text-graphite tabular-nums">
          {status}
        </p>
      </div>
      <ol className="mt-2 divide-y divide-rule/60" aria-busy={generating}>
        {summary.points.map((point, i) => (
          <Point key={i} number={i + 1} point={point} />
        ))}
      </ol>
      {generating && (
        <div className="py-4 pl-10">
          <Dots label={checking ? 'Conferindo cada ponto no documento' : 'Escrevendo o resumo'} />
        </div>
      )}
      {!generating && (
        <p className="mt-4 text-xs leading-relaxed text-graphite">
          Resumo gerado por IA. Cada ponto foi conferido no texto do PDF: os confirmados mostram o trecho de origem; os
          marcados como não confirmados podem estar errados.
        </p>
      )}
    </section>
  )
}

function Point({ number, point }: { number: number; point: SummaryPoint }) {
  return (
    <li className="flex gap-4 py-4">
      <span aria-hidden="true" className="w-6 shrink-0 pt-0.5 text-right text-sm font-medium text-graphite tabular-nums">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`leading-relaxed wrap-break-word ${point.verified === false ? 'text-graphite' : 'text-ink'}`}>
          {withCitations(point.text)}
        </p>
        {point.verified === false && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-marker/10 px-2 py-0.5 text-xs font-medium text-marker">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.25">
              <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
            Não confirmado no documento
          </p>
        )}
        {point.evidence && (
          <details className="mt-2">
            <summary className="w-fit text-xs text-graphite select-none hover:text-ink">
              {point.verified === false ? 'Trecho mais próximo' : 'Trecho de origem'} · p. {point.evidence.page}
            </summary>
            <blockquote className="mt-2 rounded-xl border border-rule bg-sheet p-3 text-sm leading-relaxed wrap-break-word">
              <mark className="bg-marker/15 [box-decoration-break:clone] px-0.5 text-marker">{point.evidence.excerpt}</mark>
            </blockquote>
          </details>
        )}
      </div>
    </li>
  )
}

function Reading({ progress }: { progress: SummaryResponse['progress'] }) {
  const done = progress?.done ?? 0
  const total = progress?.total ?? 0
  const percent = total ? Math.round((done / total) * 100) : 0
  return (
    <div role="status" aria-live="polite" className="rounded-2xl border border-rule bg-sheet p-6 sm:p-8">
      <p className="text-lg font-medium">Lendo o documento</p>
      <p className="mt-1 text-sm text-graphite">
        {total > 1 ? `Parte ${Math.min(done + 1, total)} de ${total}. ` : ''}
        Os pontos do resumo aparecem aqui assim que a leitura terminar.
      </p>
      <div
        className="mt-5 h-1 overflow-hidden rounded-full bg-raised"
        role="progressbar"
        aria-label="Progresso da leitura"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        {total > 1 ? (
          <div className="h-full rounded-full bg-pen transition-[width] duration-500" style={{ width: `${Math.max(percent, 4)}%` }} />
        ) : (
          <div className="h-full w-2/5 rounded-full bg-pen [animation:reading_1.4s_ease-in-out_infinite]" />
        )}
      </div>
    </div>
  )
}

function Failure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-danger/30 bg-danger/10 p-5">
      <p role="alert" className="text-sm text-danger">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-xl border border-rule bg-sheet px-4 py-2 text-sm transition-colors hover:border-graphite/50 hover:bg-raised"
      >
        Tentar novamente
      </button>
    </div>
  )
}

export function Dots({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-graphite">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-pen [animation:pulse-dot_1.2s_ease-in-out_infinite]"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      {label}…
    </p>
  )
}
