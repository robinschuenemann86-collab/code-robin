// Cloudflare Worker: reicht MR Launchs Cover-Art-Anfragen an SteamGridDB
// weiter und hängt dabei den echten API-Key an, der nur hier als Secret
// liegt (STEAMGRIDDB_API_KEY) — nie im Installer, nie im Quellcode.
//
// Nur die drei Pfade, die MR Launch tatsächlich braucht, werden
// durchgelassen — kein offener Durchgriff auf die komplette SteamGridDB-API.

const STEAMGRIDDB_BASE = 'https://www.steamgriddb.com/api/v2'

const ALLOWED_PATHS = [
  /^\/search\/autocomplete\/[^/]+$/,
  /^\/grids\/game\/\d+$/,
  /^\/heroes\/game\/\d+$/
]

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (!ALLOWED_PATHS.some((pattern) => pattern.test(url.pathname))) {
      return new Response('Not found', { status: 404 })
    }

    if (!env.STEAMGRIDDB_API_KEY) {
      return new Response('Proxy ist nicht eingerichtet (STEAMGRIDDB_API_KEY fehlt).', {
        status: 500
      })
    }

    const target = `${STEAMGRIDDB_BASE}${url.pathname}${url.search}`
    const response = await fetch(target, {
      headers: { Authorization: `Bearer ${env.STEAMGRIDDB_API_KEY}` }
    })

    return new Response(response.body, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' }
    })
  }
}
