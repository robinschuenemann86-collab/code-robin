import { ipcMain } from 'electron'
import { getStore, setSettings } from './store'

// Ob die Hilfe schon einmal automatisch gezeigt wurde — steckt in den
// generischen Einstellungen, da es sich (anders als z. B. das Wochenziel) um
// ein reines Ja/Nein-Flag ohne eigenen Wert handelt.
export function hasSeenWelcome(): boolean {
  return getStore().get('settings').hasSeenWelcome === true
}

export function markWelcomeSeen(): void {
  setSettings({ ...getStore().get('settings'), hasSeenWelcome: true })
}

export function registerOnboardingHandlers(): void {
  ipcMain.handle('onboarding:hasSeenWelcome', () => hasSeenWelcome())
  ipcMain.handle('onboarding:markWelcomeSeen', () => markWelcomeSeen())
}
