import { ipcMain } from 'electron'
import { spawn } from 'child_process'
import { cpus, totalmem, freemem } from 'os'

export interface SystemStats {
  cpuPercent: number
  ramPercent: number
  gpuPercent: number | null
  gpuTempC: number | null
  cpuTempC: number | null
}

function runProcess(command: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    let stdout = ''
    try {
      const child = spawn(command, args, { windowsHide: true })
      child.stdout.on('data', (chunk) => (stdout += chunk.toString()))
      child.on('error', () => resolve(''))
      child.on('close', (code) => resolve(code === 0 ? stdout : ''))
    } catch {
      resolve('')
    }
  })
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

// Ein einzelner Zeitpunkt von os.cpus() sagt nichts über Auslastung aus (nur
// aufsummierte Ticks seit Systemstart) — zwei Messungen mit kurzem Abstand
// und die Differenz der Idle-Zeit ergeben die tatsächliche Momentanauslastung.
async function getCpuUsagePercent(): Promise<number> {
  const start = cpuTimes()
  await new Promise((resolve) => setTimeout(resolve, 200))
  const end = cpuTimes()
  const idleDelta = end.idle - start.idle
  const totalDelta = end.total - start.total
  if (totalDelta <= 0) return 0
  return Math.max(0, Math.min(100, Math.round(100 * (1 - idleDelta / totalDelta))))
}

function getRamUsagePercent(): number {
  const total = totalmem()
  const free = freemem()
  if (total <= 0) return 0
  return Math.round(((total - free) / total) * 100)
}

// nvidia-smi liegt bei jeder NVIDIA-Treiberinstallation bereits bei — kein
// zusätzliches Programm nötig. Liefert Auslastung UND Temperatur in einem
// einzigen, schnellen Aufruf. Wird einmal pro Programmlaufzeit geprüft, ob es
// überhaupt vorhanden ist, statt es bei fehlender NVIDIA-Karte immer wieder
// erfolglos zu versuchen.
let hasNvidiaSmi: boolean | null = null

async function getNvidiaGpuStats(): Promise<{ percent: number; tempC: number } | null> {
  const output = await runProcess('nvidia-smi', [
    '--query-gpu=utilization.gpu,temperature.gpu',
    '--format=csv,noheader,nounits'
  ])
  if (!output.trim()) {
    if (hasNvidiaSmi === null) hasNvidiaSmi = false
    return null
  }
  hasNvidiaSmi = true
  const [percentRaw, tempRaw] = output.split(',').map((part) => part.trim())
  const percent = Number(percentRaw)
  const tempC = Number(tempRaw)
  if (!Number.isFinite(percent) || !Number.isFinite(tempC)) return null
  return { percent, tempC }
}

// Fallback ohne NVIDIA-Karte: Windows' eigene GPU-Engine-Zähler (funktioniert
// herstellerunabhängig, aber ohne Temperatur — die gibt es nur über
// herstellerspezifische Tools). Etwas langsamer als nvidia-smi, da PowerShell
// startet — deshalb nur versucht, wenn nvidia-smi sicher fehlt.
async function getGenericGpuPercent(): Promise<number | null> {
  const output = await runProcess('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    "(Get-Counter '\\GPU Engine(*engtype_3D)\\Utilization Percentage' -ErrorAction SilentlyContinue).CounterSamples | Measure-Object -Property CookedValue -Sum | Select-Object -ExpandProperty Sum"
  ])
  const value = Number(output.trim())
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.min(100, Math.round(value)))
}

async function getGpuStats(): Promise<{ percent: number | null; tempC: number | null }> {
  if (hasNvidiaSmi !== false) {
    const nvidia = await getNvidiaGpuStats()
    if (nvidia) return { percent: Math.round(nvidia.percent), tempC: Math.round(nvidia.tempC) }
  }
  const percent = await getGenericGpuPercent()
  return { percent, tempC: null }
}

// Best-effort über den ACPI-Thermalzone-Sensor — auf vielen Mainboards liefert
// das keine oder falsche Werte (kein Ersatz für ein "echtes" Hardware-Monitoring-
// Tool, das dafür einen eigenen Treiber mitbringt). Wird nach dem ersten
// Fehlschlag nicht mehr erneut versucht, um nicht bei jedem Poll unnötig eine
// PowerShell-Instanz zu starten, die ohnehin nichts liefert.
let cpuTempAvailable: boolean | null = null

async function getCpuTemperature(): Promise<number | null> {
  if (cpuTempAvailable === false) return null
  const output = await runProcess('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    'Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty CurrentTemperature'
  ])
  const raw = Number(output.trim())
  if (!Number.isFinite(raw) || raw <= 0) {
    cpuTempAvailable = false
    return null
  }
  cpuTempAvailable = true
  // MSAcpi_ThermalZoneTemperature liefert Zehntel-Kelvin.
  return Math.round(raw / 10 - 273.15)
}

export async function getSystemStats(): Promise<SystemStats> {
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
}

export function registerSystemMonitorHandlers(): void {
  ipcMain.handle('systemMonitor:get', () => getSystemStats())
}
