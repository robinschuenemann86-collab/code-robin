// Adresse des eigenen Cloudflare-Dienstes, der die Cover-Suche und den
// PC-Abgleich bedient (siehe metadata-proxy/ im Projektordner).
//
// Bewusst hier fest hinterlegt statt nur über eine Umgebungsvariable beim
// Bauen: In v1.30.1 wurde diese Variable beim Erstellen des Installers
// vergessen, wodurch bei allen Nutzern ohne eigenen SteamGridDB-Schlüssel
// überhaupt keine Cover mehr geladen wurden — lautlos, ohne Fehlermeldung.
// Diese Fehlerquelle fällt damit weg.
//
// Die Adresse ist kein Geheimnis: sie steckt ohnehin in jedem ausgelieferten
// Installer und lässt sich dort auslesen. Der eigentliche SteamGridDB-Schlüssel
// liegt ausschließlich auf dem Dienst selbst, nie in der App.
const DEFAULT_METADATA_PROXY_URL = 'https://mr-launch-metadata-proxy.robinschuenemann86.workers.dev'

// Eine beim Bauen gesetzte Umgebungsvariable hat weiterhin Vorrang — damit
// lässt sich für Tests ein anderer Dienst einhängen oder der Proxy mit einem
// leeren Wert bewusst abschalten.
const configured = process.env.METADATA_PROXY_URL

export const METADATA_PROXY_URL: string | null =
  configured === undefined ? DEFAULT_METADATA_PROXY_URL : configured.trim() || null
