import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { Candidate } from '../types'
import { EntryIcon } from './EntryIcon'

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
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">{title}</h3>
        {items.map((candidate) => (
          <label
            key={candidate.key}
            className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${
              candidate.alreadyImported ? 'opacity-40' : 'hover:bg-neutral-900'
            }`}
          >
            <input
              type="checkbox"
              disabled={candidate.alreadyImported}
              checked={selectedKeys.has(candidate.key)}
              onChange={() => toggle(candidate.key)}
            />
            <EntryIcon iconHash={candidate.iconHash} className="h-8 w-8" />
            <span className="flex-1 truncate text-sm">{candidate.name}</span>
            {candidate.alreadyImported && (
              <span className="text-xs text-neutral-500">bereits vorhanden</span>
            )}
            {!candidate.alreadyImported && !candidate.likelyRelevant && (
              <span className="text-xs text-neutral-500">evtl. kein Spiel/Programm</span>
            )}
          </label>
        ))}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/60">
      <div className="flex max-h-[80vh] w-[32rem] flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-950 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Programme suchen</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300">
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-500">Durchsuche Registry und Steam-Bibliotheken …</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-neutral-500">Es wurden keine neuen Programme gefunden.</p>
        ) : (
          <div className="flex flex-col gap-4 overflow-y-auto">
            {renderGroup('Steam-Spiele', steamCandidates)}
            {renderGroup('Installierte Programme', registryCandidates)}
          </div>
        )}

        <div className="mt-auto flex justify-end gap-2 border-t border-neutral-800 pt-4">
          <button
            onClick={onClose}
            className="rounded-md border border-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            Abbrechen
          </button>
          <button
            onClick={handleImport}
            disabled={loading || importing || selectedKeys.size === 0}
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-40"
          >
            {importing ? 'Importiere …' : `${selectedKeys.size} auswählen und importieren`}
          </button>
        </div>
      </div>
    </div>
  )
}
