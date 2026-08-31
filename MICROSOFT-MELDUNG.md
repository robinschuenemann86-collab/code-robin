# Fehlalarm bei Microsoft melden — Schritt für Schritt

Ziel: Microsoft nimmt MR Launch von der Defender-Erkennung aus. Kostenlos,
dauert beim Ausfüllen ca. 5 Minuten, Bearbeitung meist 1–3 Tage. Danach ist
die Warnung bei **allen** deinen Freunden gleichzeitig weg.

Seite: **https://www.microsoft.com/en-us/wdsi/filesubmission**

Du brauchst ein Microsoft-Konto zum Anmelden (ein normales Outlook-/Hotmail-
Konto reicht völlig).

---

## Welche Datei hochladen?

Die **Setup-Datei, die Defender blockiert hat** — also `MR-Launch-Setup.exe`
aus dem GitHub-Release, das die Warnung ausgelöst hat. Nicht eine frisch
gebaute andere Version.

Falls Defender sie bereits in Quarantäne verschoben hat, holst du sie so
zurück: Windows-Sicherheit → Viren- & Bedrohungsschutz → Schutzverlauf →
den Eintrag anklicken → Aktionen → **Zulassen**.

---

## Die Felder, eins nach dem anderen

Die Bezeichnungen können leicht abweichen, der Sinn bleibt gleich.

| Feld | Was du auswählst |
|---|---|
| Wer bist du / "customer type" | **Software developer** — du bist der Entwickler der Datei |
| "What do you want to submit?" | **File** (Datei) |
| Datei | `MR-Launch-Setup.exe` hochladen |
| "Detection name" | `Trojan:Win32/Wacatac.B!ml` |
| Wo wurde es erkannt / "detected by" | **Microsoft Defender Antivirus** |
| Wichtigste Frage: Einschätzung | **Incorrectly detected as malware / malicious** ← das ist der Kern der Meldung |
| "Do you have a support case?" / Support-Ticket | **No** |
| Priorität / "severity" (falls gefragt) | Normal reicht |
| Kommentarfeld ("Additional information") | Text unten einfügen |

---

## Text zum Kopieren (ins Kommentarfeld)

Microsoft bearbeitet auf Englisch — deshalb ist der Text englisch.

```
This file is the installer for "MR Launch", a game and program launcher for
Windows that I develop myself and share with friends. It is built with
Electron and packaged as an NSIS installer using electron-builder.

Windows Defender detects it as Trojan:Win32/Wacatac.B!ml. I believe this is
a false positive. A VirusTotal scan of this exact file shows 0 detections
out of roughly 70 engines, including the Microsoft engine.

The application legitimately enumerates installed software (registry
uninstall keys, Steam/Epic/GOG manifest files), extracts file icons via the
Windows API, and starts other executables when the user clicks them. I
assume this combination is what triggers the machine-learning heuristic.

The installer is currently unsigned; code signing is planned.

Full source code is public: https://github.com/robinschuenemann86-collab/code-robin

Please review and remove the detection. Thank you.
```

---

## Danach

Du bekommst eine Bestätigungs-Mail mit einer Vorgangsnummer und später das
Ergebnis. Erfahrungsgemäß wird die Erkennung innerhalb weniger Tage
entfernt.

**Wichtig:** Das gilt für genau diese eine Datei. Sobald du eine neue
Version baust, ist es eine neue, unbekannte Datei — und das Spiel kann von
vorn losgehen. Dauerhaft löst das nur eine Code-Signatur (siehe unten).

---

## Der dauerhafte Weg: Code-Signatur

Eine Signatur ist ein digitaler Ausweis für deine Programme. Damit weiß
Windows, dass die Datei wirklich von dir kommt — und die Warnungen bleiben
dauerhaft aus, auch bei jeder neuen Version.

Praktikabel für dich: **Azure Trusted Signing**, rund 10 US-Dollar im Monat,
ohne Hardware-Stick, lässt sich direkt in den Build einbauen. Voraussetzung
ist ein Identitätsnachweis (bei Einzelpersonen inzwischen möglich, dauert
ein paar Tage).

Sag im Chat Bescheid, wenn du das angehen willst — dann richte ich den
Build entsprechend ein.

---

## Was du deinen Freunden *nicht* sagen solltest

Bitte rate ihnen **nicht**, den Virenschutz abzuschalten oder eine Ausnahme
einzurichten. Das ist ein schlechter Reflex für Leute, die dir vertrauen —
und sobald die Meldung oben durch ist, ist es ohnehin unnötig.

Bis dahin die ehrliche Variante: „Windows meint, es kenne das Programm noch
nicht, weil es neu und noch nicht signiert ist. Ich habe es prüfen lassen
(0 von 70 Scannern melden etwas) und bei Microsoft zur Korrektur
eingereicht." Der Link zum VirusTotal-Ergebnis wirkt dabei Wunder.
