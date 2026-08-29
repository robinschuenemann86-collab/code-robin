import { useEffect, useState, type ReactElement } from 'react'
import type { Entry } from '../types'
import { EntryIcon } from './EntryIcon'
import { playDiceTick, playSuccessSound } from '../sounds'

interface DiceRollOverlayProps {
  entries: Entry[]
  onDone: (finalEntry: Entry) => void
}

const TICK_MS = 90
const TICKS = 14

function randomOf(entries: Entry[]): Entry {
  return entries[Math.floor(Math.random() * entries.length)]
}

export function DiceRollOverlay({ entries, onDone }: DiceRollOverlayProps): ReactElement {
  const [current, setCurrent] = useState(() => randomOf(entries))

  useEffect(() => {
    const final = randomOf(entries)
    let tick = 0
    const interval = setInterval(() => {
      tick += 1
      playDiceTick()
      if (tick >= TICKS) {
        clearInterval(interval)
        setCurrent(final)
        playSuccessSound()
        setTimeout(() => onDone(final), 500)
        return
      }
      setCurrent(randomOf(entries))
    }, TICK_MS)
    return () => clearInterval(interval)
    // Läuft absichtlich nur einmal beim Erscheinen — entries/onDone würden bei
    // jedem Render einen neuen Wurf anstoßen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-gold/40 bg-base p-8 shadow-2xl">
        <EntryIcon
          iconHash={current.iconHash}
          coverHash={current.coverHash}
          className="aspect-[2/3] w-40"
        />
        <span className="max-w-64 truncate text-center text-lg font-bold">{current.name}</span>
      </div>
    </div>
  )
}
