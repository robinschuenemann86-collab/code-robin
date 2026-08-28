import { useEffect, useState, type ReactElement } from 'react'
import { IconCheck, IconX } from './icons'
import { useEscapeToClose } from '../hooks'

interface CoverArtKeyDialogProps {
  onClose: () => void
}

export function CoverArtKeyDialog({ onClose }: CoverArtKeyDialogProps): ReactElement {
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [hasProxy, setHasProxy] = useState(false)

  useEscapeToClose(onClose)

  useEffect(() => {
    window.api.getCoverArtKey().then((existing) => setKey(existing ?? ''))
    window.api.hasCoverArtProxy().then(setHasProxy)
  }, [])

  async function handleSave(): Promise<void> {
    await window.api.setCoverArtKey(key.trim())
    setSaved(true)
    setTimeout(onClose, 700)
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70">
      <div className="flex w-[26rem] flex-col gap-4 rounded-2xl border border-border bg-base p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold uppercase tracking-tight">
            SteamGridDB-Key
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-gold" title="Schließen">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-text-muted">
          {hasProxy ? (
            'Cover-Art funktioniert bereits ohne eigenen Key. Ein eigener Key ist optional, z. B. für höhere Ratenlimits.'
          ) : (
            <>
              Wird für große Cover-Art im Raster gebraucht. Kostenlosen Key auf{' '}
              <span className="text-gold">steamgriddb.com</span> unter Preferences → API Access
              erstellen.
            </>
          )}
        </p>

        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="API-Key einfügen …"
          className="w-full rounded-lg border border-border bg-panel px-3 py-2 font-mono text-sm text-text outline-none focus:border-gold/50"
        />

        <button
          onClick={handleSave}
          disabled={!key.trim()}
          className="glow-ember ember-grad-bg flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-on-ember transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
        >
          {saved && <IconCheck className="h-4 w-4" />}
          {saved ? 'Gespeichert' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}
