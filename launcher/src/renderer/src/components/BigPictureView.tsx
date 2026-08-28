import { useEffect, useState, type ReactElement } from 'react'
import type { Entry } from '../types'
import { EntryIcon } from './EntryIcon'
import logo from '../assets/logo.png'

interface BigPictureViewProps {
  entries: Entry[]
  totalEntryCount: number
  runningIds: Set<string>
  onLaunch: (entry: Entry) => void
  onExit: () => void
  onResetFilters: () => void
}

const COLUMNS = 5

export function BigPictureView({
  entries,
  totalEntryCount,
  runningIds,
  onLaunch,
  onExit,
  onResetFilters
}: BigPictureViewProps): ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(entries.length - 1, 0)))
  }, [entries.length])

  function move(delta: number): void {
    setSelectedIndex((i) => {
      const next = i + delta
      return next < 0 || next >= entries.length ? i : next
    })
  }

  function activate(): void {
    const entry = entries[selectedIndex]
    if (entry) onLaunch(entry)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onExit()
      } else if (e.key === 'ArrowRight') {
        move(1)
      } else if (e.key === 'ArrowLeft') {
        move(-1)
      } else if (e.key === 'ArrowDown') {
        move(COLUMNS)
      } else if (e.key === 'ArrowUp') {
        move(-COLUMNS)
      } else if (e.key === 'Enter') {
        activate()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, selectedIndex])

  // Gamepad-Steuerung nach Standard-Belegung (Xbox-/PS-Controller): D-Pad
  // oder linker Stick zum Navigieren, A zum Starten, B zum Verlassen. Läuft
  // nur, solange diese Ansicht offen ist — kein Polling im Rest der App.
  useEffect(() => {
    let frame: number
    const prev = { up: false, down: false, left: false, right: false, a: false, b: false }

    function poll(): void {
      const pad = navigator.getGamepads()[0]
      if (pad) {
        const axisX = pad.axes[0] ?? 0
        const axisY = pad.axes[1] ?? 0
        const next = {
          up: (pad.buttons[12]?.pressed ?? false) || axisY < -0.5,
          down: (pad.buttons[13]?.pressed ?? false) || axisY > 0.5,
          left: (pad.buttons[14]?.pressed ?? false) || axisX < -0.5,
          right: (pad.buttons[15]?.pressed ?? false) || axisX > 0.5,
          a: pad.buttons[0]?.pressed ?? false,
          b: pad.buttons[1]?.pressed ?? false
        }
        if (next.right && !prev.right) move(1)
        if (next.left && !prev.left) move(-1)
        if (next.down && !prev.down) move(COLUMNS)
        if (next.up && !prev.up) move(-COLUMNS)
        if (next.a && !prev.a) activate()
        if (next.b && !prev.b) onExit()
        Object.assign(prev, next)
      }
      frame = requestAnimationFrame(poll)
    }
    frame = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, selectedIndex])

  const selectedEntry = entries[selectedIndex] as Entry | undefined

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden p-10 text-text"
      style={{
        background:
          'radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--color-ember) 20%, var(--color-base)) 0%, color-mix(in srgb, var(--color-ember) 6%, var(--color-base)) 45%, var(--color-base) 100%)'
      }}
    >
      {/* Hero-Banner des fokussierten Spiels als Hintergrund, wie auf einer
          Store-Seite — nur ein Extra, viele Einträge haben keins. */}
      {selectedEntry?.heroHash && (
        <img
          key={selectedEntry.heroHash}
          src={`launcher-icon://${selectedEntry.heroHash}`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--color-base) 55%, transparent) 0%, var(--color-base) 85%)'
        }}
      />

      <div className="relative z-10 mb-8 flex items-center gap-3">
        <img src={logo} alt="" className="h-10 w-10 rounded-md object-cover" />
        <h1 className="ember-grad-text font-display text-xl font-extrabold uppercase tracking-tight">
          MR Launch
        </h1>
        <p className="ml-auto text-sm text-text-muted">Esc zum Beenden · Enter zum Starten</p>
      </div>

      {entries.length === 0 ? (
        <div className="relative z-10 flex flex-col items-start gap-2">
          <p className="text-text-muted">
            {totalEntryCount === 0 ? 'Noch keine Programme.' : 'Keine Programme in dieser Ansicht.'}
          </p>
          {totalEntryCount > 0 && (
            <button onClick={onResetFilters} className="text-sm text-gold underline hover:brightness-125">
              Filter zurücksetzen
            </button>
          )}
        </div>
      ) : (
        <div
          className="relative z-10 grid flex-1 content-start gap-6 overflow-y-auto"
          style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
        >
          {entries.map((entry, index) => (
            <button
              key={entry.id}
              onClick={() => {
                setSelectedIndex(index)
                onLaunch(entry)
              }}
              className={`flex flex-col items-center gap-3 rounded-2xl border p-4 text-center transition ${
                index === selectedIndex
                  ? 'glow-gold scale-105 border-gold/60 bg-panel-active'
                  : 'border-border bg-panel'
              }`}
            >
              <div className="relative w-full">
                <EntryIcon
                  iconHash={entry.iconHash}
                  coverHash={entry.coverHash}
                  className="aspect-[2/3] w-full"
                />
                {runningIds.has(entry.id) && (
                  <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-base/90 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-emerald-400 ring-1 ring-emerald-400/50">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Läuft
                  </span>
                )}
              </div>
              <span className="w-full truncate text-sm font-medium">{entry.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
