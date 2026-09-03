import { ipcMain } from 'electron'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { cpus, totalmem, freemem } from 'os'
import { join } from 'path'

// Alle Werte sind bewusst optional: "nicht ermittelbar" (null) muss sich in der
// Anzeige von einem echten "0 %" unterscheiden lassen, sonst zeigt die Anzeige
// bei einem stillen Fehlschlag ein selbstbewusstes, falsches 0 %.
export interface SystemStats {
  cpuPercent: number | null
  ramPercent: number | null
  gpuPercent: number | null
  gpuTempC: number | null
  cpuTempC: number | null
}

// Systemwerkzeuge immer mit vollem Pfad starten. Bei einem bloßen Namen sucht
// Windows zuerst im Programm- und Arbeitsverzeichnis — eine dort abgelegte
// gleichnamige Datei würde sonst statt des echten Werkzeugs ausgeführt.
const SYSTEM32 = join(process.env.SystemRoot || 'C:\\Windows', 'System32')
const NVIDIA_SMI = join(SYSTEM32, 'nvidia-smi.exe')
const TYPEPERF = join(SYSTEM32, 'typeperf.exe')
const POWERSHELL = join(SYSTEM32, 'WindowsPowerShell', 'v1.0', 'powershell.exe')

// Ohne Zeitlimit hängt ein blockierter Kindprozess (bekanntes Verhalten der
// Leistungsindikatoren bei beschädigter Zählerdatenbank) die Abfrage dauerhaft
// auf — die Anzeige würde ohne Fehlermeldung auf ihren letzten Werten einfrieren.
const PROCESS_TIMEOUT_MS = 8000

function runProcess(command: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    let stdout = ''
    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    function finish(value: string): void {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve(value)
    }

    try {
      // stderr wird bewusst verworfen statt nur ignoriert: ein nicht gelesener
      // Fehlerkanal läuft nach ~64 KB voll und blockiert den Kindprozess für immer.
      const child = spawn(command, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore']
      })
      timer = setTimeout(() => {
        child.kill()
        finish('')
      }, PROCESS_TIMEOUT_MS)
      child.stdout.on('data', (chunk) => (stdout += chunk.toString()))
      child.on('error', () => finish(''))
      child.on('close', (code) => finish(code === 0 ? stdout : ''))
    } catch {
      finish('')
    }
  })
}

// Number('') ist 0, nicht NaN — ein leeres Ergebnis würde also als echte 0 %
// durchgehen. Zusätzlich das deutsche Dezimalkomma abfangen, das manche
// Windows-Werkzeuge je nach Spracheinstellung ausgeben.
function parseNumber(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.')
  if (!normalized) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function cpuTimes(): { idle: number; total: number } {
  let idle = 0
  let total = 0
  for (const cpu of cpus()) {
    idle += cpu.times.idle
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq
  }
  return { idle, total }
}

// Ein einzelner Zeitpunkt von os.cpus() sagt nichts über die Auslastung aus (das
// sind aufsummierte Ticks seit Systemstart) — erst die Differenz zweier Messungen
// mit kurzem Abstand ergibt die tatsächliche Momentanauslastung.
async function getCpuUsagePercent(): Promise<number | null> {
  const start = cpuTimes()
  if (start.total === 0) return null
  await new Promise((resolve) => setTimeout(resolve, 200))
  const end = cpuTimes()
  const idleDelta = end.idle - start.idle
  const totalDelta = end.total - start.total
  if (totalDelta <= 0) return null
  return clampPercent(100 * (1 - idleDelta / totalDelta))
}

function getRamUsagePercent(): number | null {
  const total = totalmem()
  const free = freemem()
  if (total <= 0) return null
  return clampPercent(((total - free) / total) * 100)
}

// nvidia-smi liegt bei jeder NVIDIA-Treiberinstallation in System32 — kein
// zusätzliches Programm nötig, und Auslastung wie Temperatur kommen in einem
// einzigen schnellen Aufruf.
async function getNvidiaGpuStats(): Promise<{ percent: number; tempC: number } | null> {
  if (!existsSync(NVIDIA_SMI)) return null
  const output = await runProcess(NVIDIA_SMI, [
    '--query-gpu=utilization.gpu,temperature.gpu',
    '--format=csv,noheader,nounits'
  ])
  // Bei mehreren Grafikkarten gibt nvidia-smi eine Zeile je Karte aus. Ohne
  // diese Beschränkung auf die erste Zeile landet der Zeilenumbruch mitten im
  // Temperaturwert und die gesamte Abfrage schlägt fehl.
  const firstLine = output.split(/\r?\n/).find((line) => line.trim())
  if (!firstLine) return null
  const [percentRaw, tempRaw] = firstLine.split(',')
  if (percentRaw === undefined || tempRaw === undefined) return null
  const percent = parseNumber(percentRaw)
  const tempC = parseNumber(tempRaw)
  if (percent === null || tempC === null) return null
  return { percent: clampPercent(percent), tempC: Math.round(tempC) }
}

// Herstellerunabhängiger Rückfallweg über die Windows-Leistungsindikatoren.
// Bewusst typeperf statt PowerShell: ein schlichtes Messwerkzeug fällt der
// Verhaltensüberwachung von Virenscannern deutlich weniger auf als eine
// Skriptumgebung — und es liefert Zahlen unabhängig von der Spracheinstellung
// mit Punkt als Dezimaltrennzeichen. Temperatur gibt es auf diesem Weg nicht.
async function getGenericGpuPercent(): Promise<number | null> {
  const output = await runProcess(TYPEPERF, [
    '\\GPU Engine(*engtype_3D)\\Utilization Percentage',
    '-sc',
    '1'
  ])
  if (!output.trim()) return null

  // Ausgabe ist CSV: eine Kopfzeile mit den Zählernamen, danach eine Datenzeile,
  // die mit einem Zeitstempel in Anführungszeichen beginnt. Abschließende
  // Statusmeldungen ("Der Befehl wurde erfolgreich ausgeführt") überspringen.
  const dataLine = output
    .split(/\r?\n/)
    .filter((line) => /^"\d/.test(line.trim()))
    .pop()
  if (!dataLine) return null

  const fields = dataLine.split(',').map((field) => field.replace(/^"|"$/g, ''))
  let sum = 0
  let seen = 0
  // Feld 0 ist der Zeitstempel, alles danach je ein Zähler (ein Eintrag pro
  // Prozess und Grafik-Engine) — die Summe ergibt die Gesamtauslastung.
  for (const field of fields.slice(1)) {
    const value = parseNumber(field)
    if (value !== null) {
      sum += value
      seen++
    }
  }
  if (seen === 0) return null
  return clampPercent(sum)
}

// Ein einmaliger Fehlschlag darf einen Sensor nicht für die gesamte Laufzeit
// abschalten (z. B. wenn beim Öffnen des Panels gerade der Grafiktreiber
// aktualisiert wird) — deshalb wird ein Fehlschlag nur zeitlich begrenzt gemerkt.
const NVIDIA_RETRY_AFTER_MS = 120_000
let nvidiaFailedAt: number | null = null

async function getGpuStats(): Promise<{ percent: number | null; tempC: number | null }> {
  const skipNvidia = nvidiaFailedAt !== null && Date.now() - nvidiaFailedAt < NVIDIA_RETRY_AFTER_MS
  if (!skipNvidia) {
    const nvidia = await getNvidiaGpuStats()
    if (nvidia) {
      nvidiaFailedAt = null
      return { percent: nvidia.percent, tempC: nvidia.tempC }
    }
    nvidiaFailedAt = Date.now()
  }
  return { percent: await getGenericGpuPercent(), tempC: null }
}

// Temperaturen ändern sich träge — eine Abfrage alle 30 Sekunden genügt völlig.
// Das ist zugleich der einzige verbliebene PowerShell-Aufruf im Programm; ihn an
// den 2-Sekunden-Takt zu hängen wäre unnötig auffällig. Auf vielen Mainboards
// liefert der ACPI-Sensor ohnehin nichts, deshalb wird auch ein Fehlschlag
// zwischengespeichert — aber nur befristet, damit er nicht dauerhaft hängen bleibt.
const CPU_TEMP_SUCCESS_TTL_MS = 30_000
const CPU_TEMP_FAILURE_TTL_MS = 300_000
let cpuTempCache: { value: number | null; at: number } | null = null

async function getCpuTemperature(): Promise<number | null> {
  if (cpuTempCache) {
    const ttl = cpuTempCache.value === null ? CPU_TEMP_FAILURE_TTL_MS : CPU_TEMP_SUCCESS_TTL_MS
    if (Date.now() - cpuTempCache.at < ttl) return cpuTempCache.value
  }
  if (!existsSync(POWERSHELL)) {
    cpuTempCache = { value: null, at: Date.now() }
    return null
  }
  const output = await runProcess(POWERSHELL, [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    'Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty CurrentTemperature'
  ])
  const raw = parseNumber(output)
  // MSAcpi_ThermalZoneTemperature liefert Zehntel-Kelvin.
  const celsius = raw !== null && raw > 0 ? Math.round(raw / 10 - 273.15) : null
  // Unplausible Werte (manche Mainboards liefern konstant 0 K oder Fantasiewerte)
  // lieber verwerfen als eine offensichtlich falsche Temperatur anzeigen.
  const value = celsius !== null && celsius > 0 && celsius < 150 ? celsius : null
  cpuTempCache = { value, at: Date.now() }
  return value
}

// Mehrere gleichzeitig laufende Abfragen würden sich gegenseitig aufstauen und
// die Kindprozesse vervielfachen — parallele Aufrufe teilen sich deshalb dasselbe
// Ergebnis, statt jeweils eine eigene Messung zu starten.
let inFlight: Promise<SystemStats> | null = null

export function getSystemStats(): Promise<SystemStats> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    const [cpuPercent, gpu, cpuTempC] = await Promise.all([
      getCpuUsagePercent(),
      getGpuStats(),
      getCpuTemperature()
    ])
    return {
      cpuPercent,
      ramPercent: getRamUsagePercent(),
      gpuPercent: gpu.percent,
      gpuTempC: gpu.tempC,
      cpuTempC
    }
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}

export function registerSystemMonitorHandlers(): void {
  ipcMain.handle('systemMonitor:get', () => getSystemStats())
}
