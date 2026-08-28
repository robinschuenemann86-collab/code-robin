import type { ReactElement } from 'react'
import { IconX } from './icons'
import { useEscapeToClose } from '../hooks'

interface ShortcutsDialogProps {
  onClose: () => void
}

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: '↑ ↓ ← →', description: 'Zwischen Programmen wechseln' },
  { keys: 'Pos1 / Ende', description: 'Erstes / letztes Programm der Ansicht auswählen' },
  { keys: 'Enter', description: 'Ausgewähltes Programm starten' },
  { keys: 'Entf / Rücktaste', description: 'Ausgewähltes Programm entfernen' },
  { keys: 'F', description: 'Favorit umschalten' }
]

export function ShortcutsDialog({ onClose }: ShortcutsDialogProps): ReactElement {
  useEscapeToClose(onClose)

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70">
      <div className="flex w-[26rem] flex-col gap-4 rounded-2xl border border-border bg-base p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold uppercase tracking-tight">
            Tastenkürzel
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-gold" title="Schließen">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-text-muted">
          Gelten in der Bibliotheksansicht, sobald kein Eingabefeld fokussiert ist.
        </p>

        <div className="flex flex-col gap-2">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.keys}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-panel px-3 py-2"
            >
              <span className="font-mono text-xs font-semibold text-gold">{shortcut.keys}</span>
              <span className="text-right text-sm text-text-muted">{shortcut.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
