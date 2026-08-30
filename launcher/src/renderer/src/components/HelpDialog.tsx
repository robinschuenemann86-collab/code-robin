import type { ReactElement } from 'react'
import { IconX } from './icons'
import { useEscapeToClose } from '../hooks'

interface HelpDialogProps {
  onClose: () => void
}

const FIRST_STEPS: string[] = [
  '"+" oder Drag & Drop fügt ein einzelnes Programm hinzu.',
  '"Programme suchen" durchsucht deinen PC automatisch (Steam, Epic, Battle.net, Ubisoft Connect, EA, GOG, Registry) und zeigt einen Vorschlag zum Übernehmen.',
  'Tags in der Seitenleiste anlegen und per Klick zuweisen — mehrere gleichzeitig filterbar (UND/ODER).',
  'Strg+Klick bzw. Umschalt+Klick wählt mehrere Programme aus, unten in der Leiste dann favorisieren, taggen oder entfernen.',
  'Fehlt ein Cover-Bild, hilft "Fehlende Cover-Art nachladen" im "…"-Menü oder der Hinweis oben im Fenster.',
  '"Übersicht" und "Statistik" zeigen Spielzeit, Streak und ein optionales Wochenziel.',
  'Der Knopf mit den vier Ecken schaltet in den Big-Picture-Modus — auch per Gamepad steuerbar.',
  'Über das "…"-Menü lässt sich der komplette Datenbestand sichern und wiederherstellen.',
  'Der Würfel-Knopf wählt zufällig ein Programm — mit Umschalt+Klick nur unter deinen Favoriten.'
]

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: '↑ ↓ ← →', description: 'Zwischen Programmen wechseln' },
  { keys: 'Pos1 / Ende', description: 'Erstes / letztes Programm der Ansicht auswählen' },
  { keys: 'Enter', description: 'Ausgewähltes Programm starten' },
  { keys: 'Entf / Rücktaste', description: 'Ausgewähltes Programm entfernen' },
  { keys: 'F', description: 'Favorit umschalten' },
  { keys: '/', description: 'Suchfeld fokussieren' },
  { keys: 'Escape', description: 'Suchfeld leeren, Kontextmenü oder Auswahl schließen' }
]

export function HelpDialog({ onClose }: HelpDialogProps): ReactElement {
  useEscapeToClose(onClose)

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70">
      <div className="flex max-h-[80vh] w-[30rem] flex-col gap-5 overflow-y-auto rounded-2xl border border-border bg-base p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold uppercase tracking-tight">Hilfe</h2>
          <button onClick={onClose} className="text-text-muted hover:text-gold" title="Schließen">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-display text-[11px] font-bold tracking-wider text-text-muted">
            ERSTE SCHRITTE
          </span>
          <ul className="flex flex-col gap-2 text-sm text-text-muted">
            {FIRST_STEPS.map((step, index) => (
              <li key={index} className="flex gap-2">
                <span className="text-gold">•</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-display text-[11px] font-bold tracking-wider text-text-muted">
            TASTENKÜRZEL
          </span>
          <p className="text-xs text-text-muted">
            Gelten in der Bibliotheksansicht, sobald kein Eingabefeld fokussiert ist.
          </p>
          <div className="flex flex-col gap-2">
            {SHORTCUTS.map((shortcut) => (
              <div
                key={shortcut.keys}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-panel px-3 py-2"
              >
                <span className="font-mono text-xs font-semibold text-gold">{shortcut.keys}</span>
                <span className="text-right text-sm text-text-muted">{shortcut.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
