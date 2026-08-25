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
  const updated = [...tags, { id: randomUUID(), name: trimmed }]
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
}
