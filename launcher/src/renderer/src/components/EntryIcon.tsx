import { useState, type ReactElement } from 'react'

export function EntryIcon({
  iconHash,
  coverHash = null,
  className = 'h-14 w-14'
}: {
  iconHash: string | null
  coverHash?: string | null
  className?: string
}): ReactElement {
  const [coverFailed, setCoverFailed] = useState(false)
  const [iconFailed, setIconFailed] = useState(false)

  if (coverHash && !coverFailed) {
    return (
      <img
        src={`launcher-icon://${coverHash}`}
        alt=""
        className={`shrink-0 rounded-xl border border-border bg-panel object-cover ${className}`}
        onError={() => setCoverFailed(true)}
      />
    )
  }

  if (!iconHash || iconFailed) {
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
      onError={() => setIconFailed(true)}
    />
  )
}
