import { useEffect, useRef, useState, type ReactElement } from 'react'
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
  const finalRef = useRef(randomOf(entries))
  const finishedRef = useRef(false)

  function finish(): void {
    if (finishedRef.current) return
    finishedRef.current = true
    setCurrent(finalRef.current)
    playSuccessSound()
    setTimeout(() => onDone(finalRef.current), 300)
  }

  useEffect(() => {
    let tick = 0
    const interval = setInterval(() => {
      tick += 1
      playDiceTick()
      if (tick >= TICKS) {
        clearInterval(interval)
        finish()
        return
      }
      setCurrent(randomOf(entries))
    }, TICK_MS)
    return () => clearInterval(interval)
    // Läuft absichtlich nur einmal beim Erscheinen — entries würde bei jedem
    // Render einen neuen Wurf anstoßen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-30 flex cursor-pointer items-center justify-center bg-black/70"
      onClick={finish}
      title="Klicken zum Überspringen"
    >
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
