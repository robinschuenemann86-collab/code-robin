import { useEffect, useState, type ReactElement } from 'react'
import type { Entry, EntryStats, Tag } from '../types'
import type { Session } from '../../../main/store'
import type { SteamAchievement } from '../../../main/steamAchievements'
import { EntryIcon } from './EntryIcon'
import { extractAccentColor } from '../colorExtraction'
import {
  IconAlertTriangle,
  IconCalendar,
  IconClock,
  IconDisc,
  IconEdit,
  IconFolder,
  IconPlay,
  IconStar,
  IconTag,
  IconTrash,
  IconX
} from './icons'

function formatSize(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

interface DetailPanelProps {
  entry: Entry
  tags: Tag[]
  pathMissing: boolean
  stats: EntryStats | null
  onLaunch: (entry: Entry) => void
  onRename: (id: string, name: string) => void
  onSetLaunchArgs: (id: string, args: string) => void
  onToggleTag: (id: string, tagId: string) => void
  onChangeIcon: (id: string) => void
  onFetchCoverArt: (id: string) => void
  onToggleFavorite: (entry: Entry) => void
  onSetRating: (id: string, rating: number) => void
  onRemove: (entry: Entry) => void
  onClose: () => void
  onSetLaunchScripts: (id: string, preLaunchCommand: string, postLaunchCommand: string) => void
  onPickEmulator: (id: string) => void
  onClearEmulatorPath: (id: string) => void
  onFetchMetadata: (id: string) => void
  onOpenTrailer: (id: string) => void
  onSetNotes: (id: string, notes: string) => void
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

export function DetailPanel({
  entry,
  tags,
  pathMissing,
  stats,
  onLaunch,
  onRename,
  onSetLaunchArgs,
  onToggleTag,
  onChangeIcon,
  onFetchCoverArt,
  onToggleFavorite,
  onSetRating,
  onRemove,
  onClose,
  onSetLaunchScripts,
  onPickEmulator,
  onClearEmulatorPath,
  onFetchMetadata,
  onOpenTrailer,
  onSetNotes
}: DetailPanelProps): ReactElement {
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(entry.name)
  const [launchArgs, setLaunchArgsValue] = useState(entry.launchArgs ?? '')
  const [preLaunchCommand, setPreLaunchCommand] = useState(entry.preLaunchCommand ?? '')
  const [postLaunchCommand, setPostLaunchCommand] = useState(entry.postLaunchCommand ?? '')
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [size, setSize] = useState<number | null | 'loading'>('loading')
  const [sessions, setSessions] = useState<Session[]>([])
  const [accentColor, setAccentColor] = useState<string | null>(null)
  const [screenshots, setScreenshots] = useState<string[]>([])
  const [lightboxHash, setLightboxHash] = useState<string | null>(null)
  const [achievements, setAchievements] = useState<SteamAchievement[]>([])
  const [achievementsError, setAchievementsError] = useState<string | null>(null)
  const canUseLaunchArgs = !entry.steamAppId && !entry.epicAppName && !entry.battlenetCode

  useEffect(() => {
    setSize('loading')
    window.api.getEntrySize(entry.id).then(setSize)
  }, [entry.id])

  // Akzentfarbe aus Cover oder Icon — sorgt für eine dezente, zum jeweiligen
  // Programm passende Farbstimmung statt eines immer gleichen Panels.
  useEffect(() => {
    const hash = entry.coverHash ?? entry.iconHash
    if (!hash) {
      setAccentColor(null)
      return
    }
    let cancelled = false
    extractAccentColor(hash).then((color) => {
      if (!cancelled) setAccentColor(color)
    })
    return () => {
      cancelled = true
    }
  }, [entry.coverHash, entry.iconHash])

  useEffect(() => {
    window.api.getEntrySessions(entry.id).then(setSessions)
  }, [entry.id, stats])

  // Nur für Steam-Titel möglich — andere Quellen haben keinen einheitlichen
  // Screenshot-Speicherort (siehe screenshots.ts).
  useEffect(() => {
    if (!entry.steamAppId) {
      setScreenshots([])
      return
    }
    window.api.getScreenshots(entry.id).then(setScreenshots)
  }, [entry.id, entry.steamAppId])

  // Nur ein Fetch-Versuch, wenn Zugangsdaten hinterlegt sind — sonst bliebe
  // die Fehlermeldung "keine Zugangsdaten" bei jedem Steam-Spiel sichtbar,
  // obwohl das Feature bewusst inaktiv ist, bis Zugangsdaten eingetragen wurden.
  useEffect(() => {
    setAchievements([])
    setAchievementsError(null)
    const steamAppId = entry.steamAppId
    if (!steamAppId) return
    let cancelled = false
    window.api.getSteamAchievementsCredentials().then((credentials) => {
      if (cancelled || !credentials) return
      window.api.fetchSteamAchievements(steamAppId).then(
        (result) => {
          if (!cancelled) setAchievements(result)
        },
        (error) => {
          if (!cancelled) {
            setAchievementsError(error instanceof Error ? error.message : String(error))
          }
        }
      )
    })
    return () => {
      cancelled = true
    }
  }, [entry.id, entry.steamAppId])

  function commitName(): void {
    const trimmed = name.trim()
    if (trimmed && trimmed !== entry.name) onRename(entry.id, trimmed)
    setEditingName(false)
  }

  function commitLaunchArgs(): void {
    if (launchArgs.trim() !== (entry.launchArgs ?? '')) {
      onSetLaunchArgs(entry.id, launchArgs)
    }
  }

  function commitNotes(): void {
    if (notes.trim() !== (entry.notes ?? '')) {
      onSetNotes(entry.id, notes)
    }
  }

  function commitLaunchScripts(): void {
    if (
      preLaunchCommand.trim() !== (entry.preLaunchCommand ?? '') ||
      postLaunchCommand.trim() !== (entry.postLaunchCommand ?? '')
    ) {
      onSetLaunchScripts(entry.id, preLaunchCommand, postLaunchCommand)
    }
  }

  return (
    <aside className="relative flex w-72 shrink-0 flex-col gap-4 border-l border-border bg-panel/40 p-5">
      {accentColor && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-25"
          style={{ background: `linear-gradient(180deg, ${accentColor}, transparent)` }}
        />
      )}
      {entry.heroHash && (
        <img
          src={`launcher-icon://${entry.heroHash}`}
          alt=""
          className="-mx-5 -mt-5 mb-1 h-28 w-[calc(100%+2.5rem)] max-w-none object-cover"
        />
      )}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onToggleFavorite(entry)}
          title="Favorit (F)"
          className={entry.favorite ? 'text-amber' : 'text-text-muted hover:text-amber'}
        >
          <IconStar className="h-4 w-4" filled={entry.favorite} />
        </button>
        <button onClick={onClose} className="text-text-muted hover:text-gold" title="Schließen">
          <IconX className="h-4 w-4" />
        </button>
      </div>

      {pathMissing && (
        <div className="flex items-center gap-2 rounded-lg border border-amber/40 bg-amber/10 p-2 text-xs text-amber">
          <IconAlertTriangle className="h-4 w-4 shrink-0" />
          Pfad nicht gefunden — das Programm wurde vermutlich verschoben oder deinstalliert.
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <div
          className="group relative rounded-xl"
          style={accentColor ? { boxShadow: `0 0 24px 2px ${accentColor}55` } : undefined}
        >
          <button
            onClick={() => {
              const hash = entry.coverHash ?? entry.iconHash
              if (hash) setLightboxHash(hash)
            }}
            title="Vergrößern"
          >
            <EntryIcon
              iconHash={entry.iconHash}
              coverHash={entry.coverHash}
              className={entry.coverHash ? 'aspect-[2/3] w-32' : 'h-20 w-20'}
            />
          </button>
          <button
            onClick={() => onChangeIcon(entry.id)}
            title="Icon ändern"
            className="absolute bottom-1 right-1 hidden rounded-md bg-black/60 p-1 text-white group-hover:flex"
          >
            <IconEdit className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          onClick={() => onFetchCoverArt(entry.id)}
          className="text-xs font-semibold text-gold hover:brightness-125"
        >
          {entry.coverHash ? 'Cover-Art neu laden' : 'Cover-Art laden'}
        </button>
        {editingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') {
                setName(entry.name)
                setEditingName(false)
              }
            }}
            className="w-full rounded-lg bg-panel-hover px-2 py-1 text-center text-sm text-text outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="flex items-center gap-1.5 text-center text-sm font-medium"
          >
            {entry.name} <IconEdit className="h-3 w-3 text-text-muted" />
          </button>
        )}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              onClick={() => onSetRating(entry.id, entry.rating === value ? 0 : value)}
              title={`${value} von 5 Sternen`}
              className={value <= entry.rating ? 'text-amber' : 'text-text-muted hover:text-amber'}
            >
              <IconStar className="h-3.5 w-3.5" filled={value <= entry.rating} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2">
        <IconTag className="mt-1 h-4 w-4 shrink-0 text-text-muted" />
        {tags.length === 0 ? (
          <p className="pt-1 text-xs text-text-muted">Noch keine Tags angelegt.</p>
        ) : (
          <div className="flex flex-1 flex-wrap gap-1.5">
            {tags.map((tag) => {
              const active = entry.tags.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  onClick={() => onToggleTag(entry.id, tag.id)}
                  className={`rounded-full border px-2 py-0.5 text-xs transition ${
                    active
                      ? 'border-gold/60 bg-panel-active text-gold'
                      : 'border-border text-text-muted hover:border-gold/30 hover:text-text'
                  }`}
                >
                  {tag.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2">
        <button
          onClick={() => window.api.showEntryInExplorer(entry.id)}
          title="Im Explorer anzeigen"
          className="mt-0.5 shrink-0 text-text-muted hover:text-gold"
        >
          <IconFolder className="h-4 w-4" />
        </button>
        <span
          className="break-all rounded-lg border border-border bg-panel p-2 font-mono text-xs text-text"
          title={entry.path}
        >
          {entry.path}
        </span>
      </div>

      {entry.description ? (
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-[11px] font-bold tracking-wider text-text-muted">
            {[entry.genre, entry.developer, entry.releaseYear?.toString()]
              .filter(Boolean)
              .join(' · ') || 'INFO'}
          </span>
          <p className="text-xs leading-relaxed text-text-muted">{entry.description}</p>
          {entry.videoId && (
            <button
              onClick={() => onOpenTrailer(entry.id)}
              className="flex items-center gap-1.5 self-start text-xs text-gold hover:brightness-125"
            >
              <IconPlay className="h-3 w-3" />
              Trailer ansehen
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={() => onFetchMetadata(entry.id)}
          className="w-full rounded-lg border border-border bg-panel px-2 py-1.5 text-left text-xs text-text-muted transition hover:border-gold/50 hover:text-gold"
        >
          Metadaten laden …
        </button>
      )}

      {canUseLaunchArgs && (
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-[11px] font-bold tracking-wider text-text-muted">
            START-PARAMETER
          </span>
          <input
            value={launchArgs}
            onChange={(e) => setLaunchArgsValue(e.target.value)}
            onBlur={commitLaunchArgs}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setLaunchArgsValue(entry.launchArgs ?? '')
            }}
            placeholder="z. B. -windowed -novid"
            className="w-full rounded-lg border border-border bg-panel px-2 py-1.5 font-mono text-xs text-text outline-none focus:border-gold/50"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="font-display text-[11px] font-bold tracking-wider text-text-muted">
          EMULATOR
        </span>
        {entry.emulatorPath ? (
          <div className="flex items-center gap-2">
            <span
              className="flex-1 truncate rounded-lg border border-border bg-panel p-2 font-mono text-xs text-text"
              title={entry.emulatorPath}
            >
              {entry.emulatorPath}
            </span>
            <button
              onClick={() => onClearEmulatorPath(entry.id)}
              title="Emulator entfernen"
              className="shrink-0 text-text-muted hover:text-gold"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onPickEmulator(entry.id)}
            className="w-full rounded-lg border border-border bg-panel px-2 py-1.5 text-left text-xs text-text-muted transition hover:border-gold/50 hover:text-gold"
          >
            Emulator auswählen …
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-display text-[11px] font-bold tracking-wider text-text-muted">
          START-SKRIPTE
        </span>
        <input
          value={preLaunchCommand}
          onChange={(e) => setPreLaunchCommand(e.target.value)}
          onBlur={commitLaunchScripts}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setPreLaunchCommand(entry.preLaunchCommand ?? '')
          }}
          placeholder="Vor dem Start ausführen …"
          className="w-full rounded-lg border border-border bg-panel px-2 py-1.5 font-mono text-xs text-text outline-none focus:border-gold/50"
        />
        <input
          value={postLaunchCommand}
          onChange={(e) => setPostLaunchCommand(e.target.value)}
          onBlur={commitLaunchScripts}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setPostLaunchCommand(entry.postLaunchCommand ?? '')
          }}
          placeholder="Nach dem Start ausführen …"
          className="w-full rounded-lg border border-border bg-panel px-2 py-1.5 font-mono text-xs text-text outline-none focus:border-gold/50"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-display text-[11px] font-bold tracking-wider text-text-muted">
          NOTIZEN
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={commitNotes}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setNotes(entry.notes ?? '')
          }}
          placeholder="Eigene Notizen …"
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-panel px-2 py-1.5 text-xs text-text outline-none focus:border-gold/50"
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-text-muted">
        <IconCalendar className="h-4 w-4 shrink-0" />
        {new Date(entry.addedAt).toLocaleDateString('de-DE')}
      </div>

      <div className="flex items-center gap-2 text-xs text-text-muted">
        <IconDisc className="h-4 w-4 shrink-0" />
        {size === 'loading' ? 'Größe wird berechnet …' : size === null ? 'Größe unbekannt' : formatSize(size)}
      </div>

      {stats && stats.launchCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <IconClock className="h-4 w-4 shrink-0" />
          {formatDuration(stats.totalPlayedMs)} · {stats.launchCount}× gestartet
          {stats.lastPlayedAt &&
            ` · zuletzt ${new Date(stats.lastPlayedAt).toLocaleDateString('de-DE')}`}
        </div>
      )}

      {sessions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-[11px] font-bold tracking-wider text-text-muted">
            SITZUNGEN
          </span>
          <div className="flex max-h-32 flex-col gap-1 overflow-y-auto pr-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between text-xs text-text-muted"
              >
                <span>{new Date(session.startedAt).toLocaleDateString('de-DE')}</span>
                <span>{formatDuration((session.endedAt ?? session.startedAt) - session.startedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {screenshots.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-[11px] font-bold tracking-wider text-text-muted">
            SCREENSHOTS
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {screenshots.map((hash) => (
              <button key={hash} onClick={() => setLightboxHash(hash)} className="shrink-0">
                <img
                  src={`launcher-icon://${hash}`}
                  alt=""
                  className="h-14 w-24 rounded-md object-cover transition hover:brightness-110"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {(achievements.length > 0 || achievementsError) && (
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-[11px] font-bold tracking-wider text-text-muted">
            ERFOLGE
            {achievements.length > 0 &&
              ` (${achievements.filter((a) => a.achieved).length}/${achievements.length})`}
          </span>
          {achievementsError ? (
            <p className="text-xs text-text-muted">{achievementsError}</p>
          ) : (
            <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto pr-1">
              {achievements.map((a) => (
                <div
                  key={a.apiName}
                  className={`flex items-center gap-2 rounded-lg border border-border bg-panel p-1.5 ${
                    a.achieved ? '' : 'opacity-50'
                  }`}
                >
                  {a.iconHash ? (
                    <img
                      src={`launcher-icon://${a.iconHash}`}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded"
                    />
                  ) : (
                    <div className="h-8 w-8 shrink-0 rounded bg-panel-hover" />
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-xs text-text" title={a.name}>
                      {a.name}
                    </span>
                    <span
                      className="truncate text-[11px] text-text-muted"
                      title={a.description}
                    >
                      {a.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {lightboxHash && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/85 p-8"
          onClick={() => setLightboxHash(null)}
        >
          <img
            src={`launcher-icon://${lightboxHash}`}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}

      <div className="mt-auto flex gap-2">
        <button
          onClick={() => onLaunch(entry)}
          title="Starten"
          className="glow-gold flex flex-1 items-center justify-center rounded-lg bg-gold py-2.5 text-base transition hover:brightness-110"
        >
          <IconPlay className="h-5 w-5" />
        </button>
        <button
          onClick={() => onRemove(entry)}
          title="Entfernen"
          className="flex items-center justify-center rounded-lg border border-border px-4 text-text-muted transition hover:border-danger/50 hover:text-danger"
        >
          <IconTrash className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}
