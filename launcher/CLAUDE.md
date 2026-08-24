# Projekt: Windows Game- & Programm-Launcher

## Was das hier ist

Ein Desktop-Launcher für Windows. Nutzer verwalten damit ihre Spiele und Programme
an einem Ort: automatisch erkannt oder manuell hinzugefügt, mit Icon, Kategorien,
Suche und Spielzeit-Statistik. Wird öffentlich verteilt, signiert und aktualisiert
sich selbst.

Priorität in dieser Reihenfolge: **saubere, intuitive UI** > **Stabilität** >
**Funktionsumfang** > Bundle-Größe. Installer darf 100+ MB haben.

## Wichtig: Wer hier mitarbeitet

Der Projektinhaber ist **kein Programmierer**. Das ändert die Arbeitsweise:

- Erkläre in normaler Sprache, was du tust und warum — kein Fachjargon ohne
  Übersetzung.
- Sage bei jedem Schritt konkret, was der Nutzer selbst tun muss (Datei öffnen,
  Programm installieren, Knopf drücken) und was du erledigst.
- Triff technische Detailentscheidungen selbst, statt sie zur Abstimmung zu
  stellen. Frage nur bei Dingen nach, die man sehen oder erleben kann:
  Aussehen, Bedienung, Verhalten.
- Wähle immer den Weg mit weniger Einrichtungsaufwand, auch wenn er technisch
  weniger elegant ist. Keine Bibliotheken, die auf dem Rechner kompiliert werden
  müssen.
- Nach jeder Phase: kurz und in Alltagssprache zusammenfassen, was jetzt
  funktioniert und wie man es ausprobiert.

## Stack

- Electron (aktuelle stabile Version) + electron-vite
- React + TypeScript
- Tailwind CSS
- `electron-store` für Persistenz (JSON-Datei, **kein** SQLite, keine nativen
  Module — der Nutzer hat keine Build-Tools installiert)
- electron-builder (NSIS-Target) für den Installer
- electron-updater gegen GitHub Releases

Keine zusätzlichen UI-Frameworks ohne Rücksprache. Komponenten selbst bauen oder
shadcn/ui verwenden.

## Architekturregeln

Diese Regeln sind nicht verhandelbar:

1. **Main-Prozess macht alles Systemnahe.** Registry, Dateisystem, Prozessstart,
   Icon-Extraktion, Datenspeicherung. Nie im Renderer.
2. **Renderer ist reine UI.** Kein `require`, kein Node-API-Zugriff.
3. **`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.**
   Kommunikation ausschließlich über eine explizit typisierte Preload-Bridge.
   Jeder IPC-Kanal wird einzeln freigegeben, keine generischen Passthrough-Kanäle.
4. **Keine Pfade aus dem Renderer ungeprüft ausführen.** Alles, was zu
   `spawn`/`exec` führt, wird im Main-Prozess validiert.
5. **Kein Shell-Interpolieren.** `spawn` mit Argument-Array, nie `exec` mit
   zusammengebautem String.

## Datenhaltung

- `electron-store` legt die Daten als JSON in `app.getPath('userData')` ab
- Icon-Cache als PNG im selben Verzeichnis, Dateiname = Hash des Ziel-Pfads
- Datenstruktur versioniert, Migrationen vorwärtskompatibel — Nutzer haben nach
  dem ersten Release echte Daten drin
- Inhalte mindestens: `entries` (Programme), `sessions` (Spielzeit),
  `categories`, `settings`
- Vor jedem Schreibvorgang gegen ein Schema validieren, damit eine kaputte Datei
  den Start nicht verhindert. Bei defekter Datei: Backup anlegen, leer starten,
  Nutzer informieren.

## Bekannte Stolpersteine

- **Launcher-EXEs beenden sich sofort.** Steam-, Ubisoft- und EA-Titel starten
  den echten Prozess als Kind und beenden sich. Das Exit-Event des gespawnten
  Prozesses reicht für die Spielzeitmessung nicht aus — zusätzlich auf den
  Prozessnamen pollen.
- **Steam-Spiele startet man über `steam://rungameid/<appid>`**, nicht über die
  EXE. Bibliotheken stehen in `steamapps/libraryfolders.vdf`, die Spiele in
  `appmanifest_*.acf`.
- **Registry-Scan liefert viel Müll.** `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`
  und das WOW6432Node-Pendant enthalten Treiber, Runtimes und Updates. Vor dem
  Import filtern und dem Nutzer einen Review-Dialog zeigen — nie stillschweigend
  importieren.
- **Icon-Extraktion über `app.getFileIcon()`**, nicht über Fremdbibliotheken.
- **Umlaute und Leerzeichen in Pfaden** sind der Normalfall, nicht die Ausnahme.

## Phasenplan

Jede Phase auf eigenem Branch, am Ende ein Stand, den man starten und anschauen
kann. Keine Phase überspringen.

1. **Gerüst** — Electron + Vite + React + TS, Fenster geht auf, Dummy-Liste,
   ein fest verdrahtetes Programm per Klick starten.
2. **Manuelle Einträge** — Datei-Picker, Icon extrahieren und cachen, speichern,
   bearbeiten, löschen.
3. **UI-Politur** — Grid- und Listenansicht, Suche, Kategorien, Detailpanel,
   Leerzustände, Tastaturbedienung.
4. **Scanner** — Registry-Uninstall-Keys und Steam-VDF, Dubletten gegen
   bestehende Einträge, Review-Dialog vor Import.
5. **Spielzeit** — Session-Tracking mit Prozess-Polling, Statistikansicht,
   zuletzt gespielt.
6. **Distribution** — electron-builder NSIS-Target, Code Signing,
   electron-updater gegen GitHub Releases, Update-Hinweis in der UI.

Die Reihenfolge ist bewusst so: Der Scanner (Phase 4) schreibt auf dieselbe
Datenstruktur wie die manuellen Einträge (Phase 2). Erst wenn die steht, ist der
Scanner sinnvoll.

## Distribution

- Ziel: NSIS-Installer, Per-User-Installation ohne Adminrechte als Standard
- Code Signing ist Pflicht, weil öffentlich verteilt wird. Ohne Signatur zeigt
  Windows SmartScreen bei jedem Nutzer eine Warnung. Seit 2023 müssen die
  Schlüssel auf einem HSM oder Token liegen — praktikabel sind Azure Trusted
  Signing oder ein OV-Zertifikat mit Cloud-Signing (Certum, SSL.com).
  Dieses Thema erst in Phase 6 angehen, nicht vorher.
- Update-Feed: GitHub Releases, `electron-updater` prüft beim Start
- Versionierung: SemVer, Release-Tag = `v<version>`
