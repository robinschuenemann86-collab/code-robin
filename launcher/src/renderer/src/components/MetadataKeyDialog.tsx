import { useEffect, useState, type ReactElement } from 'react'
import { IconCheck, IconX } from './icons'
import { useEscapeToClose } from '../hooks'

interface MetadataKeyDialogProps {
  onClose: () => void
}

export function MetadataKeyDialog({ onClose }: MetadataKeyDialogProps): ReactElement {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [saved, setSaved] = useState(false)

  useEscapeToClose(onClose)

  useEffect(() => {
    window.api.getMetadataCredentials().then((existing) => {
      setClientId(existing?.clientId ?? '')
      setClientSecret(existing?.clientSecret ?? '')
    })
  }, [])

  async function handleSave(): Promise<void> {
    await window.api.setMetadataCredentials(clientId.trim(), clientSecret.trim())
    setSaved(true)
    setTimeout(onClose, 700)
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70">
      <div className="flex w-[26rem] flex-col gap-4 rounded-2xl border border-border bg-base p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold uppercase tracking-tight">
            IGDB-Metadaten
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-gold" title="Schließen">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-text-muted">
          Lädt Beschreibung, Genre, Entwickler und Erscheinungsjahr nach. Kostenlose
          Zugangsdaten auf <span className="text-gold">dev.twitch.tv/console/apps</span> unter
          &quot;Register Your Application&quot; erstellen (Kategorie beliebig) — Client-ID und
          Client Secret hier eintragen.
        </p>

        <input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="Client-ID …"
          className="w-full rounded-lg border border-border bg-panel px-3 py-2 font-mono text-sm text-text outline-none focus:border-gold/50"
        />
        <input
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder="Client Secret …"
          className="w-full rounded-lg border border-border bg-panel px-3 py-2 font-mono text-sm text-text outline-none focus:border-gold/50"
        />

        <button
          onClick={handleSave}
          disabled={!clientId.trim() || !clientSecret.trim()}
          className="glow-ember ember-grad-bg flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-on-ember transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
        >
          {saved && <IconCheck className="h-4 w-4" />}
          {saved ? 'Gespeichert' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}
