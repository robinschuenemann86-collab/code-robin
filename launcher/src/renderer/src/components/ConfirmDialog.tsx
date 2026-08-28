import type { ReactElement } from 'react'
import { useEscapeToClose } from '../hooks'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Entfernen',
  onConfirm,
  onCancel
}: ConfirmDialogProps): ReactElement {
  useEscapeToClose(onCancel)

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70">
      <div className="flex w-96 flex-col gap-4 rounded-2xl border border-border bg-base p-6 shadow-2xl">
        <h2 className="font-display text-lg font-extrabold uppercase tracking-tight">{title}</h2>
        <p className="text-sm text-text-muted">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border bg-panel px-4 py-2 text-sm text-text transition hover:border-gold/50 hover:text-gold"
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-500/90 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
