import { ipcMain } from 'electron'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { basename, join } from 'path'
import { getStore, setEntries, type Entry } from './store'
import { ensureIconCached, ensureSteamIconCached } from './icons'
import { parseVdf } from './vdf'

export interface Candidate {
  key: string
  name: string
  source: 'registry' | 'steam' | 'epic'
  path: string
  steamAppId: string | null
  epicAppName: string | null
  expectedProcessName: string | null
  iconHash: string | null
  alreadyImported: boolean
  likelyRelevant: boolean
}

function runReg(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    let stdout = ''
    try {
      const child = spawn('reg', args, { windowsHide: true })
      child.stdout.on('data', (chunk) => (stdout += chunk.toString()))
      child.on('error', () => resolve(''))
      child.on('close', () => resolve(stdout))
    } catch {
      resolve('')
    }
  })
}

interface RegistryRecord {
  DisplayName?: string
  DisplayIcon?: string
  InstallLocation?: string
  Publisher?: string
  SystemComponent?: string
}

const RELEVANT_REGISTRY_VALUES = new Set([
  'DisplayName',
  'DisplayIcon',
  'InstallLocation',
  'Publisher',
  'SystemComponent'
])

// `reg query <key> /s` gibt pro Unterschlüssel eine Pfadzeile ohne Einrückung
// aus, gefolgt von eingerückten "Name    REG_TYP    Wert"-Zeilen.
function parseRegistryOutput(output: string): RegistryRecord[] {
  const records: RegistryRecord[] = []
  let current: RegistryRecord | null = null

  for (const rawLine of output.split(/\r?\n/)) {
    if (/^[A-Z]/.test(rawLine)) {
      current = {}
      records.push(current)
      continue
    }
    const match = rawLine.match(/^ {4}(.+?)\s{2,}(REG_\w+)\s{2,}(.*)$/)
    if (match && current) {
      const [, name, , value] = match
      if (RELEVANT_REGISTRY_VALUES.has(name)) {
        ;(current as Record<string, string>)[name] = value.trim()
      }
    }
  }

  return records
}

const NOISE_PATTERN =
  /update|redistributable|runtime|driver|\.net framework|visual c\+\+|security update|hotfix|kb\d{6,}|service pack|language pack| sdk\b/i

function resolveExecutableFromDisplayIcon(displayIcon: string | undefined): string | null {
  if (!displayIcon) return null
  const withoutIconIndex = displayIcon
    .replace(/,-?\d+$/, '')
    .replace(/^"|"$/g, '')
    .trim()
  if (!withoutIconIndex.toLowerCase().endsWith('.exe')) return null
  return existsSync(withoutIconIndex) ? withoutIconIndex : null
}

async function scanRegistryRoot(rootKey: string): Promise<RegistryRecord[]> {
  const output = await runReg(['query', rootKey, '/s'])
  return output ? parseRegistryOutput(output) : []
}

async function scanRegistry(existingPaths: Set<string>): Promise<Candidate[]> {
  const roots = [
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
  ]

  const allRecords = (await Promise.all(roots.map(scanRegistryRoot))).flat()

  const seenPaths = new Set<string>()
  const candidates: Candidate[] = []

  for (const record of allRecords) {
    if (!record.DisplayName) continue
    if (record.SystemComponent === '0x1') continue

    const exePath = resolveExecutableFromDisplayIcon(record.DisplayIcon)
    if (!exePath) continue
    if (seenPaths.has(exePath.toLowerCase())) continue
    seenPaths.add(exePath.toLowerCase())

    const iconHash = await ensureIconCached(exePath)
    candidates.push({
      key: `registry:${exePath.toLowerCase()}`,
      name: record.DisplayName,
      source: 'registry',
      path: exePath,
      steamAppId: null,
      epicAppName: null,
      expectedProcessName: basename(exePath),
      iconHash,
      alreadyImported: existingPaths.has(exePath),
      likelyRelevant: !NOISE_PATTERN.test(`${record.DisplayName} ${record.Publisher ?? ''}`)
    })
  }

  return candidates
}

const STEAM_NOISE_APP_IDS = new Set(['228980']) // Steamworks Common Redistributables

async function findSteamPath(): Promise<string | null> {
  for (const args of [
    ['query', 'HKCU\\SOFTWARE\\Valve\\Steam', '/v', 'SteamPath'],
    ['query', 'HKCU\\SOFTWARE\\Valve\\Steam', '/v', 'InstallPath']
  ]) {
    const output = await runReg(args)
    const match = output.match(/(?:SteamPath|InstallPath)\s+REG_SZ\s+(.+)/i)
    if (match) {
      const path = match[1].trim().replace(/\//g, '\\')
      if (existsSync(path)) return path
    }
  }
  const fallback = 'C:\\Program Files (x86)\\Steam'
  return existsSync(fallback) ? fallback : null
}

function readLibraryFolders(steamPath: string): string[] {
  const vdfFile = join(steamPath, 'steamapps', 'libraryfolders.vdf')
  const libraries = new Set<string>([steamPath])

  if (!existsSync(vdfFile)) return [...libraries]

  try {
    const parsed = parseVdf(readFileSync(vdfFile, 'utf-8'))
    const root = (parsed['libraryfolders'] ?? parsed['LibraryFolders']) as
      Record<string, unknown> | undefined
    if (root) {
      for (const entry of Object.values(root)) {
        if (entry && typeof entry === 'object' && 'path' in entry) {
          const path = (entry as { path?: string }).path
          if (path) libraries.add(path)
        }
      }
    }
  } catch {
    // Datei war nicht lesbar/parsebar — wir arbeiten dann nur mit dem Hauptpfad.
  }

  return [...libraries]
}

const EXE_BLOCKLIST_PATTERN =
  /unins|setup|redist|vcredist|directx|crashpad|crashhandler|crashreporter|battleye|easyanticheat|^eac|report|helper|updater/i

function findExecutables(dir: string, depth: number): string[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  const results: string[] = []
  for (const name of names) {
    const full = join(dir, name)
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue
    }
    if (stat.isDirectory() && depth > 0) {
      results.push(...findExecutables(full, depth - 1))
    } else if (stat.isFile() && name.toLowerCase().endsWith('.exe')) {
      results.push(full)
    }
  }
  return results
}

// Steam-Manifeste kennen keinen Haupt-EXE-Namen — wir raten anhand der größten
// .exe-Datei im Installationsordner, abzüglich bekannter Installer-/Anti-Cheat-Dateien.
function resolveSteamMainExecutable(installPath: string): string | null {
  const candidates = findExecutables(installPath, 1).filter(
    (p) => !EXE_BLOCKLIST_PATTERN.test(basename(p))
  )
  if (candidates.length === 0) return null
  candidates.sort((a, b) => {
    try {
      return statSync(b).size - statSync(a).size
    } catch {
      return 0
    }
  })
  return basename(candidates[0])
}

async function scanSteam(existingSteamAppIds: Set<string>): Promise<Candidate[]> {
  const steamPath = await findSteamPath()
  if (!steamPath) return []

  const libraries = readLibraryFolders(steamPath)
  const candidates: Candidate[] = []

  for (const library of libraries) {
    const steamappsDir = join(library, 'steamapps')
    if (!existsSync(steamappsDir)) continue

    let files: string[]
    try {
      files = readdirSync(steamappsDir)
    } catch {
      continue
    }

    for (const file of files) {
      const match = file.match(/^appmanifest_(\d+)\.acf$/i)
      if (!match) continue
      const appId = match[1]
      if (STEAM_NOISE_APP_IDS.has(appId)) continue

      try {
        const manifest = parseVdf(readFileSync(join(steamappsDir, file), 'utf-8'))
        const appState = manifest['AppState'] as Record<string, unknown> | undefined
        const name = appState?.['name'] as string | undefined
        const installDir = appState?.['installdir'] as string | undefined
        if (!name || !installDir) continue

        const installPath = join(steamappsDir, 'common', installDir)
        if (!existsSync(installPath)) continue

        const iconHash = await ensureSteamIconCached(appId, steamPath)
        candidates.push({
          key: `steam:${appId}`,
          name,
          source: 'steam',
          path: installPath,
          steamAppId: appId,
          epicAppName: null,
          expectedProcessName: resolveSteamMainExecutable(installPath),
          iconHash,
          alreadyImported: existingSteamAppIds.has(appId),
          likelyRelevant: true
        })
      } catch {
        continue
      }
    }
  }

  return candidates
}

const EPIC_MANIFESTS_DIR = join(
  process.env.ProgramData ?? 'C:\\ProgramData',
  'Epic',
  'EpicGamesLauncher',
  'Data',
  'Manifests'
)

// Epics eigene Manifeste liefern den Installationsordner UND den relativen
// Pfad zur Start-EXE direkt mit — anders als bei Steam ist hier kein Raten nötig.
async function scanEpic(existingEpicAppNames: Set<string>): Promise<Candidate[]> {
  if (!existsSync(EPIC_MANIFESTS_DIR)) return []

  let files: string[]
  try {
    files = readdirSync(EPIC_MANIFESTS_DIR)
  } catch {
    return []
  }

  const candidates: Candidate[] = []

  for (const file of files) {
    if (!file.toLowerCase().endsWith('.item')) continue

    try {
      const manifest = JSON.parse(readFileSync(join(EPIC_MANIFESTS_DIR, file), 'utf-8')) as Record<
        string,
        unknown
      >
      const displayName = manifest['DisplayName'] as string | undefined
      const installLocation = manifest['InstallLocation'] as string | undefined
      const launchExecutable = manifest['LaunchExecutable'] as string | undefined
      const appName = manifest['AppName'] as string | undefined
      if (!displayName || !installLocation || !launchExecutable || !appName) continue

      const exePath = join(installLocation, launchExecutable)
      if (!existsSync(exePath)) continue

      const iconHash = await ensureIconCached(exePath)
      candidates.push({
        key: `epic:${appName}`,
        name: displayName,
        source: 'epic',
        path: installLocation,
        steamAppId: null,
        epicAppName: appName,
        expectedProcessName: basename(launchExecutable),
        iconHash,
        alreadyImported: existingEpicAppNames.has(appName),
        likelyRelevant: true
      })
    } catch {
      continue
    }
  }

  return candidates
}

async function scan(): Promise<Candidate[]> {
  const entries = getStore().get('entries')
  const existingPaths = new Set(entries.map((e) => e.path))
  const existingSteamAppIds = new Set(
    entries.map((e) => e.steamAppId).filter((id): id is string => !!id)
  )
  const existingEpicAppNames = new Set(
    entries.map((e) => e.epicAppName).filter((id): id is string => !!id)
  )

  const [registryCandidates, steamCandidates, epicCandidates] = await Promise.all([
    scanRegistry(existingPaths),
    scanSteam(existingSteamAppIds),
    scanEpic(existingEpicAppNames)
  ])

  return [...steamCandidates, ...epicCandidates, ...registryCandidates]
}

// Der Renderer schickt die zuvor per scan() gelieferten Kandidaten zurück —
// hier wird jeder einzelne erneut geprüft, statt der Renderer-Angabe blind zu vertrauen.
async function importCandidates(candidates: Candidate[]): Promise<Entry[]> {
  const entries = getStore().get('entries')
  const existingPaths = new Set(entries.map((e) => e.path))
  const existingSteamAppIds = new Set(
    entries.map((e) => e.steamAppId).filter((id): id is string => !!id)
  )
  const existingEpicAppNames = new Set(
    entries.map((e) => e.epicAppName).filter((id): id is string => !!id)
  )

  const newEntries: Entry[] = []

  for (const candidate of candidates) {
    if (candidate.source === 'steam') {
      if (!candidate.steamAppId || !/^\d+$/.test(candidate.steamAppId)) continue
      if (existingSteamAppIds.has(candidate.steamAppId)) continue
    } else if (candidate.source === 'epic') {
      if (!candidate.epicAppName) continue
      if (existingEpicAppNames.has(candidate.epicAppName)) continue
    } else {
      if (!existsSync(candidate.path)) continue
      if (existingPaths.has(candidate.path)) continue
    }

    newEntries.push({
      id: randomUUID(),
      name: candidate.name,
      path: candidate.path,
      iconHash: candidate.iconHash,
      tags: [],
      addedAt: Date.now(),
      steamAppId: candidate.steamAppId,
      epicAppName: candidate.epicAppName,
      favorite: false,
      expectedProcessName: candidate.expectedProcessName
    })
  }

  const updated = [...entries, ...newEntries]
  setEntries(updated)
  return updated
}

export function registerScannerHandlers(): void {
  ipcMain.handle('scanner:scan', () => scan())
  ipcMain.handle('scanner:import', (_event, candidates: Candidate[]) =>
    importCandidates(candidates)
  )
}
