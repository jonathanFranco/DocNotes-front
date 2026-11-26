import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ChatMessage, type Message } from './components/ChatMessage'
import { Dialog } from './components/Dialog'
import { FileUpload } from './components/FileUpload'
import {
  ApiError,
  askQuestion,
  deleteDocument,
  getCurrentDocument,
  getHealth,
  uploadDocument,
  type DocumentInfo,
  type HealthResponse,
} from './services/api'

const MAX_QUESTION_CHARS = 1000
const NOT_FOUND_MESSAGE = 'Não encontrei essa informação no documento.'

type NewMessage = Message extends infer M ? (M extends Message ? Omit<M, 'id'> : never) : never

type DialogState = { kind: 'confirm-remove' } | { kind: 'remove-error'; message: string } | null

type Phase =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'uploading'; filename: string }
  | { kind: 'ready'; document: DocumentInfo }

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Algo deu errado. Tente novamente.'
}

function healthWarning(health: HealthResponse | null): string | null {
  if (!health || health.status === 'ok') return null
  const { ollama } = health
  if (!ollama.reachable) return 'O Ollama não está respondendo. Inicie-o com "ollama serve" para enviar documentos e fazer perguntas.'
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
        <Chat key={phase.document.document_id} document={phase.document} onRemove={() => setDialog({ kind: 'confirm-remove' })} />
      ) : (
        <Centered>
          <Wordmark />
          <h1 className="mt-8 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Converse com seus PDFs.
          </h1>
          <p className="mt-3 max-w-[52ch] leading-relaxed text-graphite">
            Envie um PDF e faça perguntas sobre ele. As respostas saem do próprio documento, com a página de cada
            informação. Tudo roda no seu computador.
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
        O documento atual e toda a conversa serão apagados.
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

function Dots({ label }: { label: string }) {
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

function Processing({ filename }: { filename: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-5 rounded-2xl border border-rule bg-sheet p-6 sm:p-8">
      <div>
        <p className="text-lg font-medium wrap-break-word text-ink">{filename}</p>
        <p className="mt-1 text-sm text-graphite">
          Lendo o texto e preparando o documento para perguntas. PDFs grandes podem levar alguns minutos.
        </p>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        <div className="h-full w-2/5 rounded-full bg-pen [animation:reading_1.4s_ease-in-out_infinite]" />
      </div>
    </div>
  )
}

function Chat({ document, onRemove }: { document: DocumentInfo; onRemove: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const nextId = useRef(0)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    endRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'end' })
  }, [messages, asking])

  function push(message: NewMessage) {
    setMessages((current) => [...current, { ...message, id: nextId.current++ } as Message])
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    const text = question.trim()
    if (!text || asking) return
    push({ role: 'user', text })
    setQuestion('')
    setAsking(true)
    try {
      const response = await askQuestion(text)
      push({
        role: 'assistant',
        text: response.found ? response.answer : NOT_FOUND_MESSAGE,
        found: response.found,
        sources: response.sources,
      })
    } catch (error) {
      push({ role: 'error', text: errorText(error) })
    } finally {
      setAsking(false)
      inputRef.current?.focus()
    }
  }

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

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-10">
        {messages.length === 0 && !asking ? (
          <div className="mx-auto max-w-md pt-10 text-center sm:pt-20">
            <span aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-2xl bg-pen-wash text-pen">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
              </svg>
            </span>
            <p className="mt-4 text-xl font-semibold tracking-tight">O documento está pronto.</p>
            <p className="mt-2 text-sm leading-relaxed text-graphite">
              Pergunte o que quiser saber sobre ele. Se a resposta não estiver no texto, o DocNotes avisa em vez de
              inventar.
            </p>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8" aria-live="polite">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {asking && <Dots label="Consultando o documento" />}
          </div>
        )}
        <div ref={endRef} />
      </main>

      <footer className="sticky bottom-0 bg-gradient-to-t from-paper via-paper/95 to-transparent pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <form
          onSubmit={submit}
          className="mx-auto flex max-w-3xl items-end gap-2 px-4"
        >
          <div className="flex flex-1 items-end gap-2 rounded-2xl border border-rule bg-sheet p-1.5 shadow-lg shadow-black/40 transition-colors focus-within:border-pen/60">
            <label htmlFor="question" className="sr-only">
              Pergunta sobre o documento
            </label>
            <textarea
              id="question"
              ref={inputRef}
              rows={1}
              autoFocus
              value={question}
              maxLength={MAX_QUESTION_CHARS}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void submit()
                }
              }}
              placeholder="Pergunte algo sobre o documento"
              className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-base placeholder:text-graphite/70 focus:outline-none sm:text-sm"
            />
            <button
              type="submit"
              disabled={asking || !question.trim()}
              aria-label="Perguntar"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-pen text-paper transition-colors hover:bg-pen-dark disabled:cursor-not-allowed disabled:bg-raised disabled:text-graphite"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.25">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </form>
        {question.length > MAX_QUESTION_CHARS * 0.8 && (
          <p className="mx-auto mt-2 max-w-3xl px-6 text-xs text-graphite">
            {question.length}/{MAX_QUESTION_CHARS} caracteres
          </p>
        )}
      </footer>
    </>
  )
}
