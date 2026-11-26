import { useEffect, useState, type ReactNode } from 'react'
import { Dialog } from './components/Dialog'
import { FileUpload } from './components/FileUpload'
import { Dots, Summary } from './components/Summary'
import {
  ApiError,
  deleteDocument,
  errorText,
  getCurrentDocument,
  getHealth,
  uploadDocument,
  type DocumentInfo,
  type HealthResponse,
} from './services/api'

type DialogState = { kind: 'confirm-remove' } | { kind: 'remove-error'; message: string } | null

type Phase =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'uploading'; filename: string }
  | { kind: 'ready'; document: DocumentInfo }

function healthWarning(health: HealthResponse | null): string | null {
  if (!health || health.status === 'ok') return null
  const { ollama } = health
  if (!ollama.reachable) return 'O Ollama não está respondendo. Inicie-o com "ollama serve" para gerar resumos.'
  const missing = [ollama.llm, ollama.embedding].filter((m) => !m.available).map((m) => m.name)
  return `Modelo não instalado no Ollama: ${missing.join(', ')}. Rode "ollama pull ${missing[0]}".`
}

export default function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)

  useEffect(() => {
    Promise.all([getHealth(), getCurrentDocument()])
      .then(([healthResponse, document]) => {
        setHealth(healthResponse)
        setPhase(document ? { kind: 'ready', document } : { kind: 'empty' })
      })
      .catch((error: unknown) => setFatal(errorText(error)))
  }, [])

  async function handleFile(file: File) {
    setUploadError(null)
    setPhase({ kind: 'uploading', filename: file.name })
    try {
      const { document } = await uploadDocument(file)
      setPhase({ kind: 'ready', document })
    } catch (error) {
      setUploadError(errorText(error))
      setPhase({ kind: 'empty' })
    }
  }

  function closeDialog(kind: NonNullable<DialogState>['kind']) {
    setDialog((current) => (current?.kind === kind ? null : current))
  }

  async function removeDocument() {
    setDialog(null)
    try {
      await deleteDocument()
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) {
        setDialog({ kind: 'remove-error', message: errorText(error) })
        return
      }
    }
    setPhase({ kind: 'empty' })
  }

  const warning = healthWarning(health)

  return (
    <div className="flex min-h-dvh flex-col">
      {warning && (
        <p role="status" className="border-b border-marker/20 bg-marker/10 px-4 py-2.5 text-center text-sm text-marker">
          {warning}
        </p>
      )}
      {fatal ? (
        <Centered>
          <Wordmark />
          <p role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {fatal}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl border border-rule bg-sheet px-4 py-2 text-sm transition-colors hover:border-graphite/50 hover:bg-raised"
          >
            Tentar novamente
          </button>
        </Centered>
      ) : phase.kind === 'loading' ? (
        <Centered>
          <Dots label="Carregando" />
        </Centered>
      ) : phase.kind === 'ready' ? (
        <DocumentView key={phase.document.document_id} document={phase.document} onRemove={() => setDialog({ kind: 'confirm-remove' })} />
      ) : (
        <Centered>
          <Wordmark />
          <h1 className="mt-8 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Resuma seus PDFs ponto a ponto.
          </h1>
          <p className="mt-3 max-w-[52ch] leading-relaxed text-graphite">
            Envie um PDF e o DocNotes escreve um resumo dos pontos principais, na ordem do documento e com a página de
            cada informação. Tudo roda no seu computador.
          </p>
          <div className="mt-8 sm:mt-10">
            {phase.kind === 'uploading' ? (
              <Processing filename={phase.filename} />
            ) : (
              <FileUpload onFile={handleFile} error={uploadError} />
            )}
          </div>
        </Centered>
      )}
      <Dialog
        open={dialog?.kind === 'confirm-remove'}
        title="Remover documento?"
        tone="danger"
        confirmLabel="Remover"
        onConfirm={removeDocument}
        onClose={() => closeDialog('confirm-remove')}
      >
        O documento atual e o resumo serão apagados.
      </Dialog>
      <Dialog
        open={dialog?.kind === 'remove-error'}
        title="Não foi possível remover"
        onClose={() => closeDialog('remove-error')}
      >
        {dialog?.kind === 'remove-error' && dialog.message}
      </Dialog>
    </div>
  )
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-ink">
      <span aria-hidden="true" className="grid size-7 place-items-center rounded-lg bg-pen text-paper">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.25">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9 13h6M9 17h4" />
        </svg>
      </span>
      <span className={compact ? 'hidden sm:inline' : ''}>DocNotes</span>
    </span>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12 sm:py-24">{children}</main>
}

function Processing({ filename }: { filename: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-5 rounded-2xl border border-rule bg-sheet p-6 sm:p-8">
      <div>
        <p className="text-lg font-medium wrap-break-word text-ink">{filename}</p>
        <p className="mt-1 text-sm text-graphite">
          Enviando e extraindo o texto do PDF. O resumo começa logo em seguida.
        </p>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        <div className="h-full w-2/5 rounded-full bg-pen [animation:reading_1.4s_ease-in-out_infinite]" />
      </div>
    </div>
  )
}

function DocumentView({ document, onRemove }: { document: DocumentInfo; onRemove: () => void }) {
  const pages = document.page_count === 1 ? '1 página' : `${document.page_count} páginas`

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-rule/70 bg-paper/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:gap-4">
          <Wordmark compact />
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-rule bg-sheet px-3 py-1.5">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0 text-pen" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5" />
            </svg>
            <p className="min-w-0 truncate text-sm font-medium" title={document.filename}>
              {document.filename}
            </p>
            <span className="shrink-0 text-xs text-graphite">· {pages}</span>
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover documento"
            title="Remover documento"
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-rule bg-sheet text-graphite transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
            </svg>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
        <Summary documentId={document.document_id} />
      </main>
    </>
  )
}
