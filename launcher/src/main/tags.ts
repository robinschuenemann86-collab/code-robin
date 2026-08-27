import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getStore, setTags, setEntries, type Tag } from './store'

function addTag(name: string): Tag[] {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Der Tag-Name darf nicht leer sein.')
  }
  const tags = getStore().get('tags')
  if (tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('Diesen Tag gibt es bereits.')
  }
  const updated = [...tags, { id: randomUUID(), name: trimmed, color: null }]
  setTags(updated)
  return updated
}

// Zyklus statt freier Farbwahl, damit es zur kuratierten Palette passt (siehe
// DOT_COLORS in Sidebar.tsx) — ein Klick springt zur nächsten Farbe, nach der
// letzten zurück auf "automatisch" (null, nach Position durchrotiert).
function cycleTagColor(id: string, palette: string[]): Tag[] {
  const tags = getStore().get('tags')
  const index = tags.findIndex((t) => t.id === id)
  if (index === -1) {
    throw new Error('Tag wurde nicht gefunden.')
  }
  const current = tags[index].color
  const currentIndex = current ? palette.indexOf(current) : -1
  const nextColor = currentIndex + 1 >= palette.length ? null : palette[currentIndex + 1]
  const updated = [...tags]
  updated[index] = { ...updated[index], color: nextColor }
  setTags(updated)
  return updated
}

function renameTag(id: string, name: string): Tag[] {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Der Tag-Name darf nicht leer sein.')
  }
  const tags = getStore().get('tags')
  const index = tags.findIndex((t) => t.id === id)
  if (index === -1) {
    throw new Error('Tag wurde nicht gefunden.')
  }
  if (tags.some((t) => t.id !== id && t.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('Diesen Tag gibt es bereits.')
  }
  const updated = [...tags]
  updated[index] = { ...updated[index], name: trimmed }
  setTags(updated)
  return updated
}

// Löscht den Tag und entfernt ihn aus allen Einträgen, statt sie mit einer
// verwaisten Tag-Id liegen zu lassen.
function removeTag(id: string): Tag[] {
  const tags = getStore().get('tags')
  if (!tags.some((t) => t.id === id)) {
    throw new Error('Tag wurde nicht gefunden.')
  }
  const updated = tags.filter((t) => t.id !== id)

  const entries = getStore().get('entries')
  const affected = entries.some((e) => e.tags.includes(id))
  if (affected) {
    setEntries(entries.map((e) => ({ ...e, tags: e.tags.filter((t) => t !== id) })))
  }

  setTags(updated)
  return updated
}

export function registerTagHandlers(): void {
  ipcMain.handle('tags:list', () => getStore().get('tags'))
  ipcMain.handle('tags:add', (_event, name: string) => addTag(name))
  ipcMain.handle('tags:rename', (_event, id: string, name: string) => renameTag(id, name))
  ipcMain.handle('tags:remove', (_event, id: string) => removeTag(id))
  ipcMain.handle('tags:cycleColor', (_event, id: string, palette: string[]) =>
    cycleTagColor(id, palette)
  )
}
