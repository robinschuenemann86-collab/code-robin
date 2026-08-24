# Launcher auf einem neuen Rechner einrichten

Diese Anleitung bringt das Launcher-Projekt auf einen anderen Windows-PC —
zum Beispiel den, auf dem deine Spiele liegen. Kopier dir diese Datei ruhig
zusätzlich irgendwohin (USB-Stick, Mail an dich selbst), falls du sie unterwegs
brauchst, aber sie liegt auch automatisch mit im Projekt, sobald du es
herunterlädst (Schritt 3).

Rechne mit ca. 10–15 Minuten, das meiste davon ist Warten auf Installationen.

---

## Schritt 1: Node.js installieren

Das ist der Motor, auf dem der Launcher läuft.

1. Geh auf **[nodejs.org](https://nodejs.org)**
2. Lade die **LTS-Version** herunter (der große, empfohlene Button — nicht "Current")
3. Installer starten, überall auf "Weiter"/"Installieren" klicken — die
   Standardeinstellungen reichen völlig
4. Fertig, danach musst du nichts mehr daran anfassen

## Schritt 2: Git installieren

Das Werkzeug, mit dem der Projektstand heruntergeladen wird.

1. Geh auf **[git-scm.com](https://git-scm.com/download/win)**
2. Installer herunterladen und starten
3. Auch hier: überall die Standardeinstellungen übernehmen ("Weiter" klicken),
   nichts umstellen

## Schritt 3: Projekt herunterladen

1. Öffne den Ordner, in dem das Projekt liegen soll (z. B. leg dir einen Ordner
   `Dokumente\Robin Coding` an, wie auf dem ersten Rechner)
2. Rechtsklick in den Ordner → **"Git Bash Here"** (kommt mit der
   Git-Installation aus Schritt 2 dazu) — es öffnet sich ein schwarzes
   Fenster mit einer Eingabezeile
3. Diese eine Zeile eintippen und Enter drücken:

   ```
   git clone https://github.com/robinschuenemann86-collab/code-robin.git .
   ```

   (Der Punkt am Ende gehört dazu — er sagt "hier in diesen Ordner rein",
   nicht in einen neuen Unterordner.)
4. Kurz warten, bis es fertig ist. Danach liegt alles im Ordner, inklusive
   dieser Anleitung und der `CLAUDE.md`, die den Projektstand für Claude
   beschreibt.

## Schritt 4: Launcher startklar machen

1. Im selben schwarzen Fenster (oder neu: Rechtsklick auf den `launcher`-
   Unterordner → "Git Bash Here") folgendes eintippen:

   ```
   cd launcher
   npm install
   ```
2. Das dauert beim ersten Mal 1–2 Minuten — hier werden alle Bausteine
   heruntergeladen, die der Launcher braucht.
3. Danach starten mit:

   ```
   npm run dev
   ```
4. Ein Fenster namens "Launcher" sollte aufgehen.

## Wichtig zu wissen

- **Deine Programme/Spiele-Liste ist auf diesem Rechner leer.** Die Liste
  wird pro Rechner gespeichert, nicht im Projekt selbst — das ist Absicht,
  weil auf jedem Rechner andere Spiele installiert sind. Nutz oben rechts
  **"Programme suchen"**, um deine Steam-/Epic-/Battle.net-Spiele automatisch
  zu finden.
- Falls `npm` oder `node` als "nicht gefunden" gemeldet wird, obwohl du sie
  installiert hast: einmal den Rechner neu starten (oder zumindest das
  schwarze Fenster schließen und neu öffnen) — Windows übernimmt die
  Installation manchmal erst danach.

## Wenn du dort auch mit Claude weiterarbeiten willst

Öffne einfach den `launcher`-Ordner (oder den übergeordneten Projektordner)
in Claude Code oder Cowork. Die `CLAUDE.md` im Ordner sagt Claude automatisch,
worum es hier geht — du musst den Kontext nicht neu erklären.

## Wenn danach etwas hakt

Schreib mir einfach im Chat, was genau passiert ist (am besten die
Fehlermeldung kopieren oder einen Screenshot schicken) — dann schauen wir
uns das zusammen an.
