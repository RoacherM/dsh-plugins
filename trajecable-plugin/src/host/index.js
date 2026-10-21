// Host half of the trajecable timeline: scan local agent logs into an index, serve it to the page.
import { createStore, defaultDataDir } from './store.js'
import { defaultSources, scanDshSession, scanSources } from './scan.js'
import { registerRoutes } from './routes.js'
import { createSummarizer } from './summarize.js'

export const name = 'dsh-trajecable'
export const inject = ['connection']

export function apply(ctx, config = {}) {
  const log = (message) => ctx.logger?.warn?.(message)
  const store = createStore({ dir: config.dataDir ?? defaultDataDir() })
  // A damaged index must not brick the page: start empty and let the next scan rebuild it.
  const ready = store.load().catch((error) => {
    log(`trajecable: cannot load index, rebuilding: ${error?.message ?? error}`)
  })
  const sources = { ...defaultSources() }
  if (config.dshDir) sources.dsh = config.dshDir
  if (config.claudeDir) sources.claude = config.claudeDir
  if (config.codexDir) sources.codex = config.codexDir
  if (config.piDir) sources.pi = config.piDir
  if (config.epiDir) sources.epi = config.epiDir
  if (config.grokDir) sources.grok = config.grokDir
  if (config.antigravityDir) sources.antigravity = [config.antigravityDir]
  if (Array.isArray(config.antigravityDirs)) sources.antigravity = config.antigravityDirs

  const pageInterval = (config.pageScanIntervalMinutes ?? 2) * 60_000
  const dailyInterval = (config.scanIntervalHours ?? 24) * 3_600_000
  const controller = new AbortController()

  const state = {
    scanning: false,
    startedAt: 0,
    endedAt: 0,
    error: null,
    progress: { done: 0, total: 0 },
  }

  const scan = {
    state: () => ({
      scanning: state.scanning,
      startedAt: state.startedAt,
      endedAt: state.endedAt,
      error: state.error,
      progress: { ...state.progress },
    }),
    async run(reason = 'manual') {
      if (state.scanning) return false
      state.scanning = true
      state.startedAt = Date.now()
      state.endedAt = 0
      state.error = null
      state.progress = { done: 0, total: 0 }
      try {
        const result = await scanSources({
          store,
          sources,
          signal: controller.signal,
          log,
          onProgress: (done, total) => { state.progress = { done, total } },
        })
        state.endedAt = Date.now()
        log(`trajecable: ${reason} scan read ${result.changed}/${result.files} files`)
        return true
      } catch (error) {
        state.endedAt = Date.now()
        state.error = error?.message ?? String(error)
        log(`trajecable: scan failed: ${state.error}`)
        return false
      } finally {
        state.scanning = false
      }
    },
  }

  async function maybeScan(reason) {
    const age = Date.now() - store.lastScanAt()
    const interval = reason === 'daily' ? dailyInterval : reason === 'startup' ? 3_600_000 : pageInterval
    if (age < interval) return
    await scan.run(reason)
  }

  const summarizer = createSummarizer({ ctx, store, config, log })
  // The chat HUD asks for the open session, which is often newer than the last full scan.
  const indexDshSession = (id) => scanDshSession({ store, root: sources.dsh, id })
  registerRoutes(ctx, { store, ready, scan, maybeScan, summarizer, indexDshSession })

  ready.then(() => {
    maybeScan('startup').catch(() => {})
  }).catch((error) => log(`trajecable: cannot load index: ${error?.message ?? error}`))

  const tick = () => { maybeScan('daily').catch(() => {}) }
  const timer = setInterval(tick, 60 * 60_000)
  timer.unref?.()

  ctx.effect(() => () => {
    clearInterval(timer)
    controller.abort()
  }, 'dsh-trajecable: timers')
}
