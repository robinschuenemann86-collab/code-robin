import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { Entry, Tag } from '../types'
import { IconDisc, IconEdit, IconFolder, IconPlay, IconStar, IconTag, IconTrash } from './icons'

interface EntryContextMenuProps {
  entry: Entry
  tags: Tag[]
  x: number
  y: number
  onClose: () => void
  onLaunch: (entry: Entry) => void
  onToggleFavorite: (entry: Entry) => void
  onToggleTag: (id: string, tagId: string) => void
  onShowInExplorer: (id: string) => void
  onChangeIcon: (id: string) => void
  onFetchCoverArt: (id: string) => void
  onRemove: (entry: Entry) => void
}

const ITEM_CLASS =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-text transition hover:bg-panel-hover'

export function EntryContextMenu({
  entry,
  tags,
  x,
  y,
  onClose,
  onLaunch,
  onToggleFavorite,
  onToggleTag,
  onShowInExplorer,
  onChangeIcon,
  onFetchCoverArt,
  onRemove
}: EntryContextMenuProps): ReactElement {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })
  const [tagsOpen, setTagsOpen] = useState(false)

  // Erst unsichtbar an (x, y) rendern, dann anhand der tatsächlichen Größe
  // einmalig so verschieben, dass das Menü nicht über den Fensterrand
  // hinausragt — die Größe hängt u. a. von der Tag-Anzahl ab und ist vorher
  // nicht bekannt.
  useEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))
    const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))
    setPosition({ left, top })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y])

  function act(action: () => void): void {
    action()
    onClose()
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        ref={menuRef}
        style={{ left: position.left, top: position.top }}
        className="fixed z-50 w-56 rounded-xl border border-border bg-base p-1.5 shadow-2xl"
      >
        <button className={ITEM_CLASS} onClick={() => act(() => onLaunch(entry))}>
          <IconPlay className="h-4 w-4 text-text-muted" />
          Starten
        </button>

        <div className="my-1 border-t border-border" />

        <button className={ITEM_CLASS} onClick={() => act(() => onToggleFavorite(entry))}>
          <IconStar className="h-4 w-4" filled={entry.favorite} />
          Favorit
        </button>

        {tags.length > 0 && (
          <div
            className="relative"
            onMouseEnter={() => setTagsOpen(true)}
            onMouseLeave={() => setTagsOpen(false)}
          >
            <button className={`${ITEM_CLASS} justify-between`}>
              <span className="flex items-center gap-2.5">
                <IconTag className="h-4 w-4 text-text-muted" />
                Tags
              </span>
              <span className="text-text-muted">›</span>
            </button>
            {tagsOpen && (
              <div className="absolute left-full top-0 ml-1 w-48 rounded-xl border border-border bg-base p-1.5 shadow-2xl">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    className={ITEM_CLASS}
                    onClick={() => act(() => onToggleTag(entry.id, tag.id))}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        entry.tags.includes(tag.id) ? 'bg-gold' : 'border border-border'
                      }`}
                    />
                    <span className="truncate">{tag.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="my-1 border-t border-border" />

        <button className={ITEM_CLASS} onClick={() => act(() => onShowInExplorer(entry.id))}>
          <IconFolder className="h-4 w-4 text-text-muted" />
          Im Explorer anzeigen
        </button>
        <button className={ITEM_CLASS} onClick={() => act(() => onChangeIcon(entry.id))}>
          <IconEdit className="h-4 w-4 text-text-muted" />
          Icon ändern…
        </button>
        <button className={ITEM_CLASS} onClick={() => act(() => onFetchCoverArt(entry.id))}>
          <IconDisc className="h-4 w-4 text-text-muted" />
          Cover-Art laden
        </button>

        <div className="my-1 border-t border-border" />

        <button
          className={`${ITEM_CLASS} hover:text-red-400`}
          onClick={() => act(() => onRemove(entry))}
        >
          <IconTrash className="h-4 w-4" />
          Entfernen
        </button>
      </div>
    </>
  )
}
