import { useRef, useState, type DragEvent } from 'react'

interface FileUploadProps {
  onFile: (file: File) => void
  error: string | null
}

export function FileUpload({ onFile, error }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  function handle(file: File | undefined) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setLocalError(`"${file.name}" não é um PDF. Escolha um arquivo com extensão .pdf.`)
      return
    }
    setLocalError(null)
    onFile(file)
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    handle(event.dataTransfer.files[0])
  }

  const message = localError ?? error

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-5 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors sm:py-14 ${
          dragging ? 'border-pen bg-pen-wash' : 'border-rule bg-sheet/60 hover:border-graphite/50'
        }`}
      >
        <span className="grid size-12 place-items-center rounded-xl bg-raised text-pen">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" />
          </svg>
        </span>
        <div>
          <p className="text-lg font-medium text-ink">
            {dragging ? 'Solte o arquivo para enviar' : 'Arraste um PDF para cá'}
          </p>
          <p className="mx-auto mt-1 max-w-[42ch] text-sm text-graphite">
            Funciona com PDFs de texto selecionável. Documentos digitalizados como imagem não são lidos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-xl bg-pen px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-pen-dark"
        >
          Escolher arquivo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          aria-label="Selecionar arquivo PDF"
          onChange={(event) => {
            handle(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>
      {message && (
        <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {message}
        </p>
      )}
    </div>
  )
}
