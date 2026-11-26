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
        className={`sheet relative flex min-h-72 flex-col items-start justify-end gap-5 border bg-sheet p-8 transition-colors ${
          dragging ? 'border-pen bg-pen-wash' : 'border-rule'
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="mb-auto size-8 text-graphite" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" />
        </svg>
        <div>
          <p className="font-serif text-2xl text-ink">
            {dragging ? 'Solte o arquivo para enviar' : 'Arraste um PDF para cá'}
          </p>
          <p className="mt-1 text-sm text-graphite">
            Funciona com PDFs de texto selecionável. Documentos digitalizados como imagem não são lidos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-md bg-pen px-4 py-2 text-sm font-medium text-white hover:bg-pen-dark"
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
        <p role="alert" className="mt-3 text-sm text-danger">
          {message}
        </p>
      )}
    </div>
  )
}
