import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getStore, setCategories, setEntries, type Category } from './store'

function addCategory(name: string): Category[] {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Der Kategoriename darf nicht leer sein.')
  }
  const categories = getStore().get('categories')
  if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('Diese Kategorie gibt es bereits.')
  }
  const updated = [...categories, { id: randomUUID(), name: trimmed }]
  setCategories(updated)
  return updated
}

function renameCategory(id: string, name: string): Category[] {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Der Kategoriename darf nicht leer sein.')
  }
  const categories = getStore().get('categories')
  const index = categories.findIndex((c) => c.id === id)
  if (index === -1) {
    throw new Error('Kategorie wurde nicht gefunden.')
  }
  if (categories.some((c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('Diese Kategorie gibt es bereits.')
  }
  const updated = [...categories]
  updated[index] = { ...updated[index], name: trimmed }
  setCategories(updated)
  return updated
}

// Löscht die Kategorie und setzt betroffene Einträge auf "ohne Kategorie" zurück,
// statt sie mit einer verwaisten Kategorie-Id liegen zu lassen.
function removeCategory(id: string): Category[] {
  const categories = getStore().get('categories')
  if (!categories.some((c) => c.id === id)) {
    throw new Error('Kategorie wurde nicht gefunden.')
  }
  const updated = categories.filter((c) => c.id !== id)

  const entries = getStore().get('entries')
  const affected = entries.some((e) => e.category === id)
  if (affected) {
    setEntries(entries.map((e) => (e.category === id ? { ...e, category: '' } : e)))
  }

  setCategories(updated)
  return updated
}

export function registerCategoryHandlers(): void {
  ipcMain.handle('categories:list', () => getStore().get('categories'))
  ipcMain.handle('categories:add', (_event, name: string) => addCategory(name))
  ipcMain.handle('categories:rename', (_event, id: string, name: string) =>
    renameCategory(id, name)
  )
  ipcMain.handle('categories:remove', (_event, id: string) => removeCategory(id))
}
