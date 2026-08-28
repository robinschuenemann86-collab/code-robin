import { Client } from '@xhayper/discord-rpc'

// Nur gesetzt, wenn beim Bauen eine Discord-Anwendungs-Id mitgegeben wurde
// (siehe electron.vite.config.ts) — ohne das bleibt die Funktion einfach
// inaktiv, ganz ohne Fehler für den Nutzer. Die Id ist kein Geheimnis (anders
// als der SteamGridDB-Key), sie identifiziert nur die Discord-"App", unter
// deren Namen "Spielt gerade X" erscheint.
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || null

let client: Client | null = null
let ready = false

// Discord läuft beim Nutzer oft einfach nicht — das ist der Normalfall für
// dieses Feature, kein Fehler. login() bricht dann nach einem kurzen Timeout
// ab; das wird hier bewusst verschluckt, statt eine Fehlermeldung zu zeigen.
export function initDiscordPresence(): void {
  if (!CLIENT_ID) return

  client = new Client({ clientId: CLIENT_ID })
  client.on('ready', () => {
    ready = true
  })
  client.on('disconnected', () => {
    ready = false
  })
  client.login().catch(() => {})
}

export function setDiscordPresence(gameName: string): void {
  if (!ready || !client?.user) return
  client.user
    .setActivity({
      details: `Spielt ${gameName}`,
      startTimestamp: new Date(),
      instance: false
    })
    .catch(() => {})
}

export function clearDiscordPresence(): void {
  if (!ready || !client?.user) return
  client.user.clearActivity().catch(() => {})
}

export function destroyDiscordPresence(): void {
  client?.destroy().catch(() => {})
}
