import { useEffect, useState, type ReactElement } from 'react'
import { IconCheck, IconX } from './icons'
import { useEscapeToClose } from '../hooks'

interface SyncDialogProps {
  onClose: () => void
  onSynced: () => void
}

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 20; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export function SyncDialog({ onClose, onSynced }: SyncDialogProps): ReactElement {
  useEscapeToClose(onClose)
  const [code, setCode] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    window.api.getSyncCode().then((existing) => setCode(existing ?? ''))
  }, [])

  async function commitCode(value: string): Promise<void> {
    setCode(value)
    await window.api.setSyncCode(value.trim() || null)
  }

  async function handleSync(): Promise<void> {
    setSyncing(true)
    setResult(null)
    const outcome = await window.api.syncNow()
    setSyncing(false)
    setResult(outcome.message)
    if (outcome.ok) onSynced()
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70">
      <div className="flex w-[28rem] flex-col gap-4 rounded-2xl border border-border bg-base p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold uppercase tracking-tight">
            PC-Abgleich
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-gold" title="Schließen">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-text-muted">
          Gleicht Favoriten, Sternebewertung und Tags zwischen deinen eigenen PCs ab (fügt nie neue
          Programme hinzu). Trage denselben Code auf allen PCs ein, die abgeglichen werden sollen —
          wer den Code kennt, hat Zugriff auf diese Daten, also nicht weitergeben.
        </p>

        <div className="flex items-center gap-2">
          <input
            value={code}
            onChange={(e) => commitCode(e.target.value)}
            placeholder="Abgleich-Code"
            className="flex-1 rounded-lg border border-border bg-panel px-3 py-2 font-mono text-sm text-text outline-none focus:border-gold/50"
          />
          <button
            onClick={() => commitCode(randomCode())}
            title="Neuen Code erzeugen"
            className="rounded-lg border border-border bg-panel px-3 py-2 text-xs font-semibold text-text-muted transition hover:border-gold/50 hover:text-gold"
          >
            Erzeugen
          </button>
        </div>

        <button
          onClick={handleSync}
          disabled={!code.trim() || syncing}
          className="glow-ember ember-grad-bg flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-on-ember transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
        >
          {syncing ? 'Gleicht ab …' : 'Jetzt abgleichen'}
        </button>

        {result && (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <IconCheck className="h-4 w-4 shrink-0 text-gold" />
            {result}
          </div>
        )}
      </div>
    </div>
  )
}
