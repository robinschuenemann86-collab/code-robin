import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getStore, setSavedViews, type SavedView } from './store'

type NewSavedView = Omit<SavedView, 'id'>

function addSavedView(view: NewSavedView): SavedView[] {
  const trimmed = view.name.trim()
  if (!trimmed) {
    throw new Error('Der Name darf nicht leer sein.')
  }
  const views = getStore().get('savedViews')
  const updated = [...views, { ...view, name: trimmed, id: randomUUID() }]
  setSavedViews(updated)
  return updated
}

function removeSavedView(id: string): SavedView[] {
  const views = getStore().get('savedViews')
  if (!views.some((v) => v.id === id)) {
    throw new Error('Ansicht wurde nicht gefunden.')
  }
  const updated = views.filter((v) => v.id !== id)
  setSavedViews(updated)
  return updated
}

export function registerSavedViewHandlers(): void {
  ipcMain.handle('savedViews:list', () => getStore().get('savedViews'))
  ipcMain.handle('savedViews:add', (_event, view: NewSavedView) => addSavedView(view))
  ipcMain.handle('savedViews:remove', (_event, id: string) => removeSavedView(id))
}
