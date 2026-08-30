import type { ReactElement } from 'react'

const COLORS = ['#ffb020', '#ff5b1f', '#ffd873', '#ff8a3d', '#34d399']
const PIECES = Array.from({ length: 24 }, (_, i) => i)

// Rein dekorative, sich selbst entfernende Mini-Animation, wenn App.tsx einen
// neu freigeschalteten Erfolg meldet — läuft einmal durch und verschwindet.
export function ConfettiBurst(): ReactElement {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-screen overflow-hidden">
      {PIECES.map((i) => {
        const left = 35 + Math.random() * 30
        const delay = Math.random() * 0.3
        const duration = 1.1 + Math.random() * 0.6
        return (
          <span
            key={i}
            className="confetti-piece absolute top-10 h-2.5 w-1.5 rounded-sm"
            style={{
              left: `${left}%`,
              backgroundColor: COLORS[i % COLORS.length],
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`
            }}
          />
        )
      })}
    </div>
  )
}
