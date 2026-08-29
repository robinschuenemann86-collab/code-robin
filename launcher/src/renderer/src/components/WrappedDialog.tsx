import { useState, type ReactElement } from 'react'
import type { Entry, WrappedData } from '../types'
import { IconX } from './icons'
import { useEscapeToClose } from '../hooks'

interface WrappedDialogProps {
  wrapped: WrappedData
  entries: Entry[]
  onClose: () => void
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} Minuten`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} Stunden` : `${hours} Std. ${rest} Min.`
}

function entryName(entries: Entry[], entryId: string | undefined): string {
  if (!entryId) return 'einem Programm'
  return entries.find((e) => e.id === entryId)?.name ?? 'einem gelöschten Programm'
}

export function WrappedDialog({ wrapped, entries, onClose }: WrappedDialogProps): ReactElement {
  useEscapeToClose(onClose)
  const [slide, setSlide] = useState(0)

  const slides: { headline: string; body: string }[] = [
    {
      headline: `Dein ${wrapped.year} bei MR Launch`,
      body: `${wrapped.totalLaunches} Starts, ${formatDuration(wrapped.totalPlayedMs)} Spielzeit insgesamt.`
    },
    {
      headline: wrapped.topGame ? entryName(entries, wrapped.topGame.entryId) : 'Noch kein Favorit',
      body: wrapped.topGame
        ? `Dein meistgespieltes Programm dieses Jahr mit ${formatDuration(wrapped.topGame.totalPlayedMs)}.`
        : 'Dieses Jahr war noch keine Spielzeit erfasst.'
    },
    {
      headline: wrapped.wildestDay
        ? new Date(wrapped.wildestDay.date).toLocaleDateString('de-DE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          })
        : 'Noch kein wilder Tag',
      body: wrapped.wildestDay
        ? `Dein verrücktester Tag: ${formatDuration(wrapped.wildestDay.totalPlayedMs)} an einem einzigen Tag.`
        : 'Noch keine Sitzung abgeschlossen.'
    },
    {
      headline: wrapped.longestSession ? formatDuration(wrapped.longestSession.durationMs) : '—',
      body: wrapped.longestSession
        ? `Deine längste einzelne Sitzung, mit ${entryName(entries, wrapped.longestSession.entryId)}.`
        : 'Noch keine Sitzung abgeschlossen.'
    },
    {
      headline: `${wrapped.gamesAdded} neue Programme`,
      body: `So viele Programme hast du dieses Jahr zu MR Launch hinzugefügt.`
    }
  ]

  const isLast = slide === slides.length - 1
  const current = slides[slide]

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/80">
      <div className="relative flex h-[26rem] w-[26rem] flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-gold/40 bg-base p-10 text-center shadow-2xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, var(--color-ember) 30%, var(--color-base)) 0%, var(--color-base) 70%)'
          }}
        />
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 text-text-muted hover:text-gold"
          title="Schließen"
        >
          <IconX className="h-4 w-4" />
        </button>

        <div className="relative flex flex-col items-center gap-4">
          <span className="font-display text-[11px] font-bold uppercase tracking-widest text-gold">
            MR Launch Wrapped
          </span>
          <h2 className="ember-grad-text font-display text-3xl font-extrabold leading-tight">
            {current.headline}
          </h2>
          <p className="max-w-xs text-sm text-text-muted">{current.body}</p>
        </div>

        <div className="relative mt-4 flex items-center gap-2">
          {slides.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 w-1.5 rounded-full ${index === slide ? 'bg-gold' : 'bg-border'}`}
            />
          ))}
        </div>

        <div className="relative mt-2 flex gap-2">
          {slide > 0 && (
            <button
              onClick={() => setSlide((s) => s - 1)}
              className="rounded-lg border border-border bg-panel px-4 py-2 text-sm text-text transition hover:border-gold/50"
            >
              Zurück
            </button>
          )}
          <button
            onClick={() => (isLast ? onClose() : setSlide((s) => s + 1))}
            className="glow-ember ember-grad-bg rounded-lg px-4 py-2 text-sm font-medium text-on-ember transition hover:brightness-110"
          >
            {isLast ? 'Schließen' : 'Weiter'}
          </button>
        </div>
      </div>
    </div>
  )
}
