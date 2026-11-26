import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ChatMessage, type Message } from './components/ChatMessage'
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

type NewMessage = Message extends infer M ? (M extends Message ? Omit<M, 'id'> : never) : never

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

  async function handleRemove() {
    if (!window.confirm('Remover o documento atual? A conversa também será apagada.')) return
    try {
      await deleteDocument()
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) {
        window.alert(errorText(error))
        return
      }
    }
    setPhase({ kind: 'empty' })
  }

  const warning = healthWarning(health)

  return (
    <div className="flex min-h-dvh flex-col">
      {warning && (
        <p role="status" className="border-b border-marker bg-marker/40 px-4 py-2 text-center text-sm text-ink">
          {warning}
        </p>
      )}
      {fatal ? (
        <Centered>
          <Wordmark />
          <p role="alert" className="mt-6 text-danger">
            {fatal}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md border border-rule bg-sheet px-4 py-2 text-sm hover:border-graphite"
          >
            Tentar novamente
          </button>
        </Centered>
      ) : phase.kind === 'loading' ? (
        <Centered>
          <p className="text-graphite">Carregando…</p>
        </Centered>
      ) : phase.kind === 'ready' ? (
        <Chat key={phase.document.document_id} document={phase.document} onRemove={handleRemove} />
      ) : (
        <Centered>
          <Wordmark />
          <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-graphite">
            Envie um PDF e faça perguntas sobre ele. As respostas saem do próprio documento, com a página de cada
            informação. Tudo roda no seu computador.
          </p>
          <div className="mt-10">
            {phase.kind === 'uploading' ? (
              <Processing filename={phase.filename} />
            ) : (
              <FileUpload onFile={handleFile} error={uploadError} />
            )}
          </div>
        </Centered>
      )}
    </div>
  )
}

function Wordmark() {
  return <h1 className="font-serif text-5xl font-semibold tracking-tight text-ink sm:text-6xl">DocNotes</h1>
}

function Centered({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:py-24">{children}</main>
}

function Processing({ filename }: { filename: string }) {
  return (
    <div role="status" aria-live="polite" className="sheet relative flex min-h-72 flex-col justify-end gap-4 border border-rule bg-sheet p-8">
      <div>
        <p className="font-serif text-2xl break-words text-ink">{filename}</p>
        <p className="mt-1 text-sm text-graphite">
          Lendo o texto e preparando o documento para perguntas. PDFs grandes podem levar alguns minutos.
        </p>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-rule" aria-hidden="true">
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
      push({ role: 'assistant', text: response.answer, found: response.found, sources: response.sources })
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
      <header className="sticky top-0 z-10 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <span className="hidden font-serif text-lg font-semibold whitespace-nowrap sm:inline">DocNotes</span>
          <div className="min-w-0 flex-1 sm:border-l sm:border-rule sm:pl-4">
            <p className="truncate text-sm font-medium" title={document.filename}>
              {document.filename}
            </p>
            <p className="text-xs text-graphite">{pages}</p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover documento"
            className="rounded-md border border-rule bg-sheet px-3 py-1.5 text-sm whitespace-nowrap text-ink hover:border-danger hover:text-danger"
          >
            Remover<span className="hidden sm:inline"> documento</span>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {messages.length === 0 && !asking ? (
          <div className="max-w-prose pt-8">
            <p className="font-serif text-2xl text-ink">O documento está pronto.</p>
            <p className="mt-2 text-graphite">
              Pergunte o que quiser saber sobre ele. Se a resposta não estiver no texto, o DocNotes avisa em vez de
              inventar.
            </p>
          </div>
        ) : (
          <div className="space-y-8" aria-live="polite">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {asking && <p className="font-serif text-lg text-graphite">Consultando o documento…</p>}
          </div>
        )}
        <div ref={endRef} />
      </main>

      <footer className="sticky bottom-0 border-t border-rule bg-paper/95 backdrop-blur">
        <form onSubmit={submit} className="mx-auto flex max-w-3xl items-end gap-3 px-4 py-4">
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
            className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none rounded-md border border-rule bg-sheet px-3 py-2.5 placeholder:text-graphite/70 focus:border-pen focus:outline-none"
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="h-11 rounded-md bg-pen px-5 text-sm font-medium text-white hover:bg-pen-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            Perguntar
          </button>
        </form>
        {question.length > MAX_QUESTION_CHARS * 0.8 && (
          <p className="mx-auto -mt-2 max-w-3xl px-4 pb-3 text-xs text-graphite">
            {question.length}/{MAX_QUESTION_CHARS} caracteres
          </p>
        )}
      </footer>
    </>
  )
}
