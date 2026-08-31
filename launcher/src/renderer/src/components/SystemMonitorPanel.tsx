import { useEffect, useState, type ReactElement } from 'react'
import type { SystemStats } from '../../../main/systemMonitor'
import { IconX } from './icons'
import { useEscapeToClose } from '../hooks'

interface SystemMonitorPanelProps {
  onClose: () => void
}

const POLL_INTERVAL_MS = 2000

function gaugeColor(percent: number): string {
  if (percent >= 85) return '#f87171'
  if (percent >= 60) return 'var(--color-amber)'
  return '#34d399'
}

function RadialGauge({
  percent,
  label,
  sublabel
}: {
  percent: number | null
  label: string
  sublabel?: string
}): ReactElement {
  const size = 84
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const value = percent ?? 0
  const offset = circumference * (1 - value / 100)

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--color-border)"
            strokeWidth={stroke}
            fill="none"
          />
          {percent !== null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={gaugeColor(value)}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-text">
          {percent === null ? '–' : `${percent}%`}
        </div>
      </div>
      <span className="font-display text-[10px] font-bold tracking-wider text-text-muted">
        {label}
      </span>
      {sublabel && <span className="text-[10px] text-text-muted">{sublabel}</span>}
    </div>
  )
}

// Reines Anzeige-Widget, holt sich seine Werte selbst per Intervall — läuft
// nur, solange dieses Panel offen ist (kein main-process-Timer im
// Hintergrund), und zeigt ausschließlich Werte des laufenden Rechners, nie
// etwas aus einem gestarteten Spiel selbst.
export function SystemMonitorPanel({ onClose }: SystemMonitorPanelProps): ReactElement {
  const [stats, setStats] = useState<SystemStats | null>(null)

  useEscapeToClose(onClose)

  useEffect(() => {
    let cancelled = false
    function poll(): void {
      window.api.getSystemStats().then((result) => {
        if (!cancelled) setStats(result)
      })
    }
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <aside className="fixed right-4 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-5 rounded-2xl border border-border bg-base/95 p-4 shadow-2xl backdrop-blur">
      <button onClick={onClose} title="Schließen" className="self-end text-text-muted hover:text-gold">
        <IconX className="h-3.5 w-3.5" />
      </button>
      <RadialGauge
        percent={stats?.cpuPercent ?? null}
        label="CPU"
        sublabel={stats?.cpuTempC != null ? `${stats.cpuTempC}°C` : undefined}
      />
      <RadialGauge percent={stats?.ramPercent ?? null} label="RAM" />
      <RadialGauge
        percent={stats?.gpuPercent ?? null}
        label="GPU"
        sublabel={stats?.gpuTempC != null ? `${stats.gpuTempC}°C` : undefined}
      />
    </aside>
  )
}
