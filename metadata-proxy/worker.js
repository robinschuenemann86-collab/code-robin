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

// Bibliotheks-Abgleich zwischen mehreren PCs: ein frei gewählter Code
// identifiziert einen Datensatz in einem Cloudflare-KV-Namespace (Bindung
// "SYNC_STORE") — bewusst kein echtes Login, nur ein geteiltes Geheimnis
// zwischen den eigenen PCs. Wer den Code kennt, kann lesen und schreiben;
// für den persönlichen Gebrauch zwischen eigenen Geräten ausreichend, aber
// kein Ersatz für echte Zugriffskontrolle.
const SYNC_CODE_PATTERN = /^[A-Za-z0-9]{16,64}$/
const MAX_SYNC_BODY_BYTES = 200_000

async function handleSync(request, env, code) {
  if (!env.SYNC_STORE) {
    return new Response('Abgleich ist nicht eingerichtet (KV-Namespace SYNC_STORE fehlt).', {
      status: 500
    })
  }
  if (!SYNC_CODE_PATTERN.test(code)) {
    return new Response('Ungültiger Code.', { status: 400 })
  }

  if (request.method === 'GET') {
    const stored = await env.SYNC_STORE.get(`sync:${code}`)
    return new Response(stored ?? 'null', {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }

  if (request.method === 'POST') {
    const body = await request.text()
    if (body.length > MAX_SYNC_BODY_BYTES) {
      return new Response('Daten zu groß.', { status: 413 })
    }
    try {
      JSON.parse(body)
    } catch {
      return new Response('Ungültiges JSON.', { status: 400 })
    }
    await env.SYNC_STORE.put(`sync:${code}`, body)
    return new Response('OK', { status: 200 })
  }

  return new Response('Method not allowed', { status: 405 })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    const syncMatch = url.pathname.match(/^\/sync\/([^/]+)$/)
    if (syncMatch) {
      return handleSync(request, env, syncMatch[1])
    }

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
