import { useEffect, useId, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  title: string
  children: ReactNode
  onConfirm?: () => void
  onClose: () => void
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

export function Dialog({
  open,
  title,
  children,
  onConfirm,
  onClose,
  confirmLabel = onConfirm ? 'Confirmar' : 'Entendi',
  cancelLabel = 'Cancelar',
  tone = 'default',
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const bodyId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  const primary =
    tone === 'danger'
      ? 'bg-danger text-paper hover:bg-danger/85'
      : 'bg-pen text-paper hover:bg-pen-dark'

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-rule bg-sheet p-0 text-ink shadow-2xl shadow-black/60 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <div id={bodyId} className="mt-2 text-sm leading-relaxed text-graphite">
          {children}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onConfirm && (
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="rounded-xl border border-rule bg-sheet px-4 py-2.5 text-sm font-medium transition-colors hover:bg-raised"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            autoFocus={!onConfirm}
            onClick={onConfirm ?? onClose}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${primary}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
