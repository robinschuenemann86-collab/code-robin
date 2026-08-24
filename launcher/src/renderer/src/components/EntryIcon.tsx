import { useState, type ReactElement } from 'react'

export function EntryIcon({
  iconHash,
  className = 'h-14 w-14'
}: {
  iconHash: string | null
  className?: string
}): ReactElement {
  const [failed, setFailed] = useState(false)

  if (!iconHash || failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl border border-border bg-panel text-xl ${className}`}
      >
        🎮
      </div>
    )
  }

  return (
    <img
      src={`launcher-icon://${iconHash}`}
      alt=""
      className={`shrink-0 rounded-xl border border-border bg-panel object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  )
}
