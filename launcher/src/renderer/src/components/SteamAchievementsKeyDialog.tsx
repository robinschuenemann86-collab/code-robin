import { useEffect, useState, type ReactElement } from 'react'
import { IconCheck, IconX } from './icons'
import { useEscapeToClose } from '../hooks'

interface SteamAchievementsKeyDialogProps {
  onClose: () => void
}

export function SteamAchievementsKeyDialog({
  onClose
}: SteamAchievementsKeyDialogProps): ReactElement {
  const [apiKey, setApiKey] = useState('')
  const [steamId, setSteamId] = useState('')
  const [saved, setSaved] = useState(false)

  useEscapeToClose(onClose)

  useEffect(() => {
    window.api.getSteamAchievementsCredentials().then((existing) => {
      setApiKey(existing?.apiKey ?? '')
      setSteamId(existing?.steamId ?? '')
    })
  }, [])

  async function handleSave(): Promise<void> {
    await window.api.setSteamAchievementsCredentials(apiKey.trim(), steamId.trim())
    setSaved(true)
    setTimeout(onClose, 700)
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70">
      <div className="flex w-[26rem] flex-col gap-4 rounded-2xl border border-border bg-base p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold uppercase tracking-tight">
            Steam-Erfolge
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-gold" title="Schließen">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-text-muted">
          Zeigt echte Steam-Erfolge im Detailpanel. Kostenlosen Key auf{' '}
          <span className="text-gold">steamcommunity.com/dev/apikey</span> erstellen. Die eigene
          SteamID64 findet man z. B. über <span className="text-gold">steamid.io</span>. Das
          Steam-Profil muss auf &quot;Öffentlich&quot; stehen.
        </p>

        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Steam-API-Key …"
          className="w-full rounded-lg border border-border bg-panel px-3 py-2 font-mono text-sm text-text outline-none focus:border-gold/50"
        />
        <input
          value={steamId}
          onChange={(e) => setSteamId(e.target.value)}
          placeholder="SteamID64 …"
          className="w-full rounded-lg border border-border bg-panel px-3 py-2 font-mono text-sm text-text outline-none focus:border-gold/50"
        />

        <button
          onClick={handleSave}
          disabled={!apiKey.trim() || !steamId.trim()}
          className="glow-ember ember-grad-bg flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-on-ember transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
        >
          {saved && <IconCheck className="h-4 w-4" />}
          {saved ? 'Gespeichert' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}
