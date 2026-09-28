const MAL_ORIGIN = 'https://myanimelist.net'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() })
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders() })
    }

    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return Response.json({ ok: true }, { headers: corsHeaders() })
    }

    if (url.pathname !== '/list') {
      return new Response('Not found', { status: 404, headers: corsHeaders() })
    }

    const user = (url.searchParams.get('user') ?? '').trim()
    const offsetRaw = url.searchParams.get('offset') ?? '0'
    const offset = Number(offsetRaw)

    if (!/^[A-Za-z0-9_-]{1,32}$/.test(user)) {
      return Response.json({ error: 'invalid_user' }, { status: 400, headers: corsHeaders() })
    }

    if (!Number.isInteger(offset) || offset < 0 || offset > 6000 || offset % 300 !== 0) {
      return Response.json({ error: 'invalid_offset' }, { status: 400, headers: corsHeaders() })
    }

    const target = `${MAL_ORIGIN}/animelist/${encodeURIComponent(user)}/load.json?offset=${offset}&status=7`
    const cache = caches.default
    const cacheKey = new Request(url.toString(), request)
    const cached = await cache.match(cacheKey)

    if (cached) return cached

    let upstream
    try {
      upstream = await fetch(target, {
        headers: {
          'Accept': 'application/json,text/plain,*/*',
          'User-Agent': 'MAL-Sheet/1.0',
          'Referer': `${MAL_ORIGIN}/animelist/${encodeURIComponent(user)}`,
        },
        cf: {
          cacheTtl: 300,
          cacheEverything: true,
        },
      })
    } catch {
      return Response.json(
        { error: 'upstream_unreachable' },
        { status: 502, headers: corsHeaders() },
      )
    }

    const body = await upstream.arrayBuffer()
    const headers = new Headers(corsHeaders())
    headers.set('Content-Type', upstream.headers.get('Content-Type') ?? 'application/json; charset=utf-8')
    headers.set('Cache-Control', upstream.ok ? 'public, max-age=300' : 'no-store')

    const response = new Response(body, {
      status: upstream.status,
      headers,
    })

    if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()))
    return response
  },
}
