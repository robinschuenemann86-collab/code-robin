import { ipcMain, Menu, dialog, shell, type BrowserWindow } from 'electron'
import { getStore } from './store'
import { launchEntry, toggleFavorite, toggleEntryTag, removeEntry, pickCustomIcon } from './entries'
import { fetchCoverArt } from './coverArt'

export function registerContextMenuHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.on('contextMenu:showForEntry', (_event, id: string) => {
    const window = getWindow()
    const entry = getStore()
      .get('entries')
      .find((e) => e.id === id)
    if (!window || !entry) return

    const tags = getStore().get('tags')

    function notify(entries: Awaited<ReturnType<typeof toggleFavorite>>): void {
      window?.webContents.send('entries:changed', entries)
    }

    const menu = Menu.buildFromTemplate([
      { label: 'Starten', click: () => launchEntry(id) },
      { type: 'separator' },
      {
        label: 'Favorit',
        type: 'checkbox',
        checked: entry.favorite,
        click: () => notify(toggleFavorite(id))
      },
      ...(tags.length > 0
        ? [
            {
              label: 'Tags',
              submenu: tags.map((tag) => ({
                label: tag.name,
                type: 'checkbox' as const,
                checked: entry.tags.includes(tag.id),
                click: () => notify(toggleEntryTag(id, tag.id))
              }))
            }
          ]
        : []),
      { type: 'separator' },
      { label: 'Im Explorer anzeigen', click: () => shell.showItemInFolder(entry.path) },
      { label: 'Icon ändern…', click: () => pickCustomIcon(window, id).then(notify) },
      {
        label: 'Cover-Art laden',
        click: async () => {
          window.webContents.send('status:message', `Suche Cover-Art für "${entry.name}" …`)
          try {
            notify(await fetchCoverArt(id))
            window.webContents.send('status:message', `Cover-Art für "${entry.name}" geladen.`)
          } catch (error) {
            window.webContents.send(
              'status:message',
              error instanceof Error ? error.message : String(error)
            )
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Entfernen',
        click: async () => {
          const result = await dialog.showMessageBox(window, {
            type: 'question',
            buttons: ['Abbrechen', 'Entfernen'],
            defaultId: 0,
            cancelId: 0,
            message: `"${entry.name}" aus dem Launcher entfernen?`
          })
          if (result.response === 1) {
            notify(await removeEntry(id))
          }
        }
      }
    ])
    menu.popup({ window })
  })
}
