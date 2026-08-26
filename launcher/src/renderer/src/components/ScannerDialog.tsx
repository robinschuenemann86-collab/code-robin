import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { Candidate } from '../types'
import { EntryIcon } from './EntryIcon'
import { IconAlertTriangle, IconCheck, IconDownload, IconX } from './icons'

interface ScannerDialogProps {
  onClose: () => void
  onImported: () => void
}

export function ScannerDialog({ onClose, onImported }: ScannerDialogProps): ReactElement {
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    window.api.scan().then((found) => {
      setCandidates(found)
      setSelectedKeys(
        new Set(found.filter((c) => !c.alreadyImported && c.likelyRelevant).map((c) => c.key))
      )
      setLoading(false)
    })
  }, [])

  const steamCandidates = useMemo(
    () => candidates.filter((c) => c.source === 'steam'),
    [candidates]
  )
  const epicCandidates = useMemo(() => candidates.filter((c) => c.source === 'epic'), [candidates])
  const battlenetCandidates = useMemo(
    () => candidates.filter((c) => c.source === 'battlenet'),
    [candidates]
  )
  const registryCandidates = useMemo(
    () => candidates.filter((c) => c.source === 'registry'),
    [candidates]
  )

  function toggle(key: string): void {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleImport(): Promise<void> {
    setImporting(true)
    const chosen = candidates.filter((c) => selectedKeys.has(c.key))
    await window.api.importCandidates(chosen)
    setImporting(false)
    onImported()
  }

  function renderGroup(title: string, items: Candidate[]): ReactElement | null {
    if (items.length === 0) return null
    return (
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium uppercase tracking-widest text-text-muted">{title}</h3>
        {items.map((candidate) => (
          <label
            key={candidate.key}
            className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${
              candidate.alreadyImported ? 'opacity-40' : 'hover:bg-panel-hover'
            }`}
          >
            <input
              type="checkbox"
              disabled={candidate.alreadyImported}
              checked={selectedKeys.has(candidate.key)}
              onChange={() => toggle(candidate.key)}
              className="accent-gold"
            />
            <EntryIcon iconHash={candidate.iconHash} className="h-8 w-8" />
            <span className="flex-1 truncate text-sm">{candidate.name}</span>
            {candidate.alreadyImported && (
              <IconCheck className="h-4 w-4 shrink-0 text-text-muted" title="Bereits vorhanden" />
            )}
            {!candidate.alreadyImported && !candidate.likelyRelevant && (
              <IconAlertTriangle
                className="h-4 w-4 shrink-0 text-amber"
                title="Evtl. kein Spiel/Programm"
              />
            )}
          </label>
        ))}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70">
      <div className="flex max-h-[80vh] w-[32rem] flex-col gap-4 rounded-xl border border-border bg-base p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Programme suchen</h2>
          <button onClick={onClose} className="text-text-muted hover:text-gold" title="Schließen">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-text-muted">Durchsuche …</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-text-muted">Nichts gefunden.</p>
        ) : (
          <div className="flex flex-col gap-4 overflow-y-auto">
            {renderGroup('Steam-Spiele', steamCandidates)}
            {renderGroup('Epic-Spiele', epicCandidates)}
            {renderGroup('Battle.net-Spiele', battlenetCandidates)}
            {renderGroup('Installierte Programme', registryCandidates)}
          </div>
        )}

        <div className="mt-auto flex justify-end border-t border-border pt-4">
          <button
            onClick={handleImport}
            disabled={loading || importing || selectedKeys.size === 0}
            title="Importieren"
            className="glow-ember ember-grad-bg flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-on-ember transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
          >
            <IconDownload className="h-4 w-4" />
            {importing ? '…' : selectedKeys.size}
          </button>
        </div>
      </div>
    </div>
  )
}
