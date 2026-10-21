// The scan index: one session record per source log, plus the byte cursor of every file.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { homedir } from 'node:os'

const VERSION = 6
const SAVE_SOON_MS = 5000

export function createStore({ dir }) {
  const state = { version: VERSION, lastScanAt: 0, files: {}, sessions: {} }
  let loaded = false
  let queue = Promise.resolve()

  async function load() {
    if (loaded) return
    loaded = true
    try {
      const parsed = JSON.parse(await readFile(join(dir, 'index.json'), 'utf8'))
      if (parsed?.version === VERSION && parsed.sessions && parsed.files) {
        state.lastScanAt = parsed.lastScanAt ?? 0
        state.files = parsed.files
        state.sessions = parsed.sessions
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }

  function file(path) {
    return state.files[path]
  }

  function setFile(path, record) {
    state.files[path] = record
  }

  function session(key) {
    return state.sessions[key]
  }

  function setSession(record) {
    state.sessions[record.key] = record
  }

  function removeSession(key) {
    delete state.sessions[key]
  }

  function lastScanAt() {
    return state.lastScanAt
  }

  function finishScan(at = Date.now()) {
    state.lastScanAt = at
  }

  function snapshot() {
    return state
  }

  function save() {
    const run = queue.then(async () => {
      await mkdir(dir, { recursive: true })
      const temp = join(dir, `index.json.${process.pid}.${randomBytes(3).toString('hex')}.tmp`)
      await writeFile(temp, JSON.stringify(state))
      await rename(temp, join(dir, 'index.json'))
    })
    queue = run.catch(() => {})
    return run
  }

  // Coalesce frequent small updates (the live chat HUD) into one write. If DSH quits before
  // the timer fires, nothing is lost: the session log is the source and the next scan reads it again.
  let soon = null
  function saveSoon(delay = SAVE_SOON_MS) {
    if (soon) return
    soon = setTimeout(() => { soon = null; save().catch(() => {}) }, delay)
    soon.unref?.()
  }

  return { load, file, setFile, session, setSession, removeSession, lastScanAt, finishScan, snapshot, save, saveSoon, dir }
}

export function defaultDataDir() {
  return process.env.DSH_TRAJECABLE_DIR ?? join(homedir(), '.dsh', 'plugin-data', 'trajecable')
}
