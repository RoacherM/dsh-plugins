import { buildSessionDetail, buildTimeline, isMeaningful } from './timeline.js'

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
})

const toNumber = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function registerRoutes(ctx, { store, ready, scan, maybeScan, summarizer, indexDshSession }) {
  const indexed = () => {
    const state = store.snapshot()
    return {
      sessions: Object.values(state.sessions).filter(isMeaningful).length,
      files: Object.keys(state.files).length,
    }
  }

  const scanMeta = () => ({ ...scan.state(), lastScanAt: store.lastScanAt() })

  const timeline = (url) => {
    const q = url.searchParams
    const range = q.get('range') ?? '7d'
    const to = toNumber(q.get('to'), Date.now())
    const from = range === 'all' ? 0 : toNumber(q.get('from'), to - 7 * 86_400_000)
    const sessions = Object.values(store.snapshot().sessions)
    return buildTimeline({
      sessions,
      from,
      to,
      tz: q.get('tz') ?? undefined,
      agent: q.get('agent') || undefined,
      project: q.get('project') || undefined,
      q: q.get('q')?.trim() || undefined,
      indexed: indexed(),
      scan: scanMeta(),
    })
  }

  async function handleTimeline(url) {
    await ready
    maybeScan('page').catch(() => {})
    return timeline(url)
  }

  async function handleSession(url) {
    await ready
    const key = url.searchParams.get('key')
    if (!key) return json({ error: 'missing key' }, 400)
    if (key.startsWith('dsh:') && indexDshSession) await indexDshSession(key.slice(4))
    const session = buildSessionDetail(store.session(key), url.searchParams.get('tz') ?? undefined)
    return session ? json(session) : json({ error: 'session not found' }, 404)
  }

  async function handleSummary(request) {
    await ready
    let body
    try { body = await request.json() } catch { return json({ error: 'invalid body' }, 400) }
    const key = body?.key
    if (!key) return json({ error: 'missing key' }, 400)
    const session = store.session(key)
    if (!session) return json({ error: 'session not found' }, 404)
    try {
      const tz = typeof body?.tz === 'string' ? body.tz : undefined
      const result = await summarizer.run(session, { force: Boolean(body?.force), tz })
      return { key, ...result }
    } catch (error) {
      return json({ error: error?.message ?? String(error) }, 503)
    }
  }

  const routes = [
    ['POST', '/api/trajecable/summary', (request) => handleSummary(request)],
    ['GET', '/api/trajecable/timeline', (request, url) => handleTimeline(url)],
    ['GET', '/api/trajecable/session', (request, url) => handleSession(url)],
    ['GET', '/api/trajecable/status', async () => {
      await ready
      return { scan: scanMeta(), indexed: indexed() }
    }],
    ['POST', '/api/trajecable/scan', async () => {
      await ready
      scan.run().catch(() => {})
      return { started: true, scan: scanMeta() }
    }],
  ]

  for (const [method, path, fn] of routes) {
    ctx.effect(() => ctx.connection.fetch.register({
      path,
      methods: [method],
      requestBody: 'buffered',
      fetch: async (request) => {
        try {
          const result = await fn(request, new URL(request.url))
          return result instanceof Response ? result : json(result)
        } catch (error) {
          return json({ error: error?.message ?? String(error) }, 500)
        }
      },
    }), 'dsh-trajecable: ' + path)
  }
}
