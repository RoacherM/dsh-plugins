// Discover local agent session stores and fold their logs into the scan index.
import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { homedir } from 'node:os'
import * as dsh from './adapters/dsh.js'
import * as claude from './adapters/claude.js'
import * as codex from './adapters/codex.js'
import * as pi from './adapters/pi.js'
import * as epi from './adapters/epi.js'
import * as grok from './adapters/grok.js'
import * as antigravity from './adapters/antigravity.js'

export const ADAPTERS = { dsh, claude, codex, pi, epi, grok }

export function defaultSources() {
  const home = homedir()
  return {
    dsh: join(home, '.dsh', 'sessions'),
    claude: join(process.env.CLAUDE_CONFIG_DIR ?? join(home, '.claude'), 'projects'),
    codex: join(process.env.CODEX_HOME ?? join(home, '.codex'), 'sessions'),
    pi: process.env.PI_SESSION_DIR ?? join(home, '.pi', 'agent', 'sessions'),
    epi: process.env.EPI_SESSION_DIR ?? join(process.env.EPI_HOME ?? join(home, '.epi'), 'pi', 'sessions'),
    grok: join(home, '.grok', 'sessions'),
    antigravity: [
      join(home, '.gemini', 'antigravity', 'conversation_summaries.db'),
      join(home, '.gemini', 'antigravity-ide', 'conversation_summaries.db'),
      join(home, '.gemini', 'antigravity-cli', 'conversation_summaries.db'),
    ],
  }
}

async function dirents(dir) {
  if (!dir) return []
  try { return await readdir(dir, { withFileTypes: true }) } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

async function fileInfo(agent, file) {
  try {
    const info = await stat(file)
    return { agent, file, size: info.size, mtimeMs: info.mtimeMs }
  } catch {
    return undefined
  }
}

// All sessions, or only the session directory named `onlySession`.
async function dshLogs(root, onlySession) {
  const out = []
  for (const workspace of await dirents(root)) {
    if (!workspace.isDirectory()) continue
    for (const session of await dirents(join(root, workspace.name))) {
      if (!session.isDirectory() || (onlySession && session.name !== onlySession)) continue
      const dir = join(root, workspace.name, session.name)
      const candidates = (await dirents(dir))
        .filter((entry) => entry.isFile() && /^session\.v(\d+)\.jsonl(\.zstd)?$/.test(entry.name))
        .map((entry) => ({ name: entry.name, version: Number(/^session\.v(\d+)/.exec(entry.name)[1]) }))
        .sort((a, b) => b.version - a.version || (a.name.endsWith('.zstd') ? -1 : 1))
      if (candidates[0]) out.push(join(dir, candidates[0].name))
    }
  }
  return out
}

async function claudeLogs(root) {
  const out = []
  for (const project of await dirents(root)) {
    if (!project.isDirectory()) continue
    for (const entry of await dirents(join(root, project.name))) {
      // Subagent transcripts (<session>/subagents/*.jsonl) repeat work the parent already records.
      if (entry.isFile() && entry.name.endsWith('.jsonl')) out.push(join(root, project.name, entry.name))
    }
  }
  return out
}

async function piLogs(root) {
  const out = []
  for (const project of await dirents(root)) {
    if (!project.isDirectory()) continue
    for (const entry of await dirents(join(root, project.name))) {
      // subagent-artifacts/ holds nested transcripts; the top-level file is the session.
      if (entry.isFile() && entry.name.endsWith('.jsonl')) out.push(join(root, project.name, entry.name))
    }
  }
  return out
}

async function codexLogs(root) {
  const out = []
  for (const year of await dirents(root)) {
    if (!year.isDirectory()) continue
    for (const month of await dirents(join(root, year.name))) {
      if (!month.isDirectory()) continue
      for (const day of await dirents(join(root, year.name, month.name))) {
        if (!day.isDirectory()) continue
        for (const entry of await dirents(join(root, year.name, month.name, day.name))) {
          if (entry.isFile() && entry.name.startsWith('rollout-') && entry.name.endsWith('.jsonl')) {
            out.push(join(root, year.name, month.name, day.name, entry.name))
          }
        }
      }
    }
  }
  return out
}

async function grokLogs(root) {
  const out = []
  for (const cwdDir of await dirents(root)) {
    if (!cwdDir.isDirectory()) continue
    for (const session of await dirents(join(root, cwdDir.name))) {
      if (!session.isDirectory()) continue
      const dir = join(root, cwdDir.name, session.name)
      const summary = await stat(join(dir, 'summary.json')).catch(() => undefined)
      if (!summary) continue
      const updates = await stat(join(dir, 'updates.jsonl')).catch(() => undefined)
      out.push({
        agent: 'grok',
        file: dir,
        size: summary.size + (updates?.size ?? 0),
        mtimeMs: Math.max(summary.mtimeMs, updates?.mtimeMs ?? 0),
      })
    }
  }
  return out
}

function antigravityTag(db) {
  const parent = basename(dirname(db))
  return parent.replace(/^antigravity-?/, '') || 'ide'
}

async function antigravityLogs(paths) {
  const out = []
  for (const file of paths ?? []) {
    try {
      const info = await stat(file)
      out.push({ agent: 'antigravity', file, size: info.size, mtimeMs: info.mtimeMs, tag: antigravityTag(file) })
    } catch { /* not every Antigravity install has a summaries DB */ }
  }
  return out
}

export async function discover(sources = defaultSources()) {
  const [dshFiles, claudeFiles, codexFiles, piFiles, epiFiles, grokFiles, antigravityFiles] = await Promise.all([
    dshLogs(sources.dsh),
    claudeLogs(sources.claude),
    codexLogs(sources.codex),
    piLogs(sources.pi),
    piLogs(sources.epi),
    grokLogs(sources.grok),
    antigravityLogs(sources.antigravity),
  ])
  const files = []
  for (const [agent, list] of [
    ['dsh', dshFiles], ['claude', claudeFiles], ['codex', codexFiles],
    ['pi', piFiles], ['epi', epiFiles],
  ]) {
    for (const file of list) {
      const info = await fileInfo(agent, file)
      if (info) files.push(info)
    }
  }
  files.push(...grokFiles, ...antigravityFiles)
  return files.sort((x, y) => y.mtimeMs - x.mtimeMs)
}

/** Feed complete JSON lines from `start` to `end`; return the byte offset of the last complete line. */
async function readRecords(file, start, end, onRecord) {
  if (end <= start) return start
  const stream = createReadStream(file, { start, end: end - 1 })
  let buffer = Buffer.alloc(0)
  let consumed = start
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk])
    let newline
    while ((newline = buffer.indexOf(10)) !== -1) {
      const line = buffer.subarray(0, newline).toString('utf8')
      consumed += newline + 1
      buffer = buffer.subarray(newline + 1)
      if (line.trim()) onRecord(line)
    }
  }
  return consumed
}

async function scanIncremental(file, adapter, store, log) {
  const key = String(file.file)
  const prev = store.file(key)
  let session = prev?.key ? store.session(prev.key) : undefined
  let start = prev?.cursor ?? 0
  if (!session || file.size < start) {
    session = adapter.create(key)
    start = 0
  }
  let failedLines = 0
  const consumed = await readRecords(key, start, file.size, (line) => {
    try {
      adapter.feed(session, JSON.parse(line))
    } catch {
      failedLines++
    }
  })
  if (failedLines) log?.(`trajecable: ${failedLines} unreadable lines in ${basename(key)}`)
  adapter.finalize(session)
  store.setSession(session)
  store.setFile(key, { agent: file.agent, size: file.size, mtimeMs: file.mtimeMs, cursor: consumed, key: session.key })
  return consumed !== prev?.cursor || !prev
}

async function scanDsh(file, store, log) {
  const key = String(file.file)
  const prev = store.file(key)
  // Records indexed before turn and token counts existed are read again once.
  const current = prev && store.session(prev.key)
  const counted = current?.turns && typeof current.tokens === 'number'
  if (prev && prev.size === file.size && prev.mtimeMs === file.mtimeMs && counted) return false
  const session = await dsh.readSession(key)
  store.setSession(session)
  store.setFile(key, { agent: 'dsh', size: file.size, mtimeMs: file.mtimeMs, cursor: file.size, key: session.key })
  return true
}

async function scanGrok(file, store) {
  const key = String(file.file)
  const prev = store.file(key)
  if (prev && prev.size === file.size && prev.mtimeMs === file.mtimeMs) return false
  const session = await grok.readSession(key)
  store.setSession(session)
  store.setFile(key, { agent: 'grok', size: file.size, mtimeMs: file.mtimeMs, cursor: 0, key: session.key })
  return true
}

async function scanAntigravity(file, store, log) {
  const key = String(file.file)
  const prev = store.file(key)
  // The summary DB is small. Re-read it on every scan so deleted or retitled
  // conversations disappear, even when SQLite keeps the same file mtime.
  const tag = file.tag ?? antigravityTag(key)
  const sessions = await antigravity.readSessions(key, tag)
  const prefix = `antigravity:${tag}:`
  for (const oldKey of Object.keys(store.snapshot().sessions)) {
    if (oldKey.startsWith(prefix)) store.removeSession(oldKey)
  }
  for (const session of sessions) store.setSession(session)
  store.setFile(key, { agent: 'antigravity', size: file.size, mtimeMs: file.mtimeMs, cursor: 0, key: prefix })
  log?.(`trajecable: ${sessions.length} Antigravity conversations from ${basename(dirname(key))}`)
  return !prev || prev.size !== file.size || prev.mtimeMs !== file.mtimeMs
}

/**
 * Index one DSH session now, e.g. the one open in the chat view, without waiting for the next full scan.
 * The record is updated in memory at once. The index file is written later by `store.saveSoon()`:
 * a running chat asks after every step, and each write is the whole multi-MB index.
 * Returns false when no log exists for it.
 */
export async function scanDshSession({ store, root = defaultSources().dsh, id }) {
  if (!id || id.includes('/') || id.includes('\\') || id.startsWith('.')) return false
  const [file] = await dshLogs(root, id)
  const info = file && await fileInfo('dsh', file)
  if (!info) return false
  if (await scanDsh(info, store)) store.saveSoon()
  return true
}

/**
 * Scan every discovered log. `onProgress(done, total, file)` runs after each file.
 * The store is saved during the scan, so a first long scan already serves partial data.
 */
export async function scanSources({ store, sources = defaultSources(), signal, onProgress, log } = {}) {
  await store.load()
  const files = await discover(sources)
  let done = 0
  let read = 0
  for (const file of files) {
    if (signal?.aborted) break
    try {
      const changed = file.agent === 'dsh'
        ? await scanDsh(file, store, log)
        : file.agent === 'grok'
          ? await scanGrok(file, store)
          : file.agent === 'antigravity'
            ? await scanAntigravity(file, store, log)
            : await scanIncremental(file, ADAPTERS[file.agent], store, log)
      if (changed) read++
    } catch (error) {
      log?.(`trajecable: cannot read ${file.file}: ${error?.message ?? error}`)
    }
    done++
    onProgress?.(done, files.length, file)
    if (done % 40 === 0) await store.save()
    await new Promise((resolve) => setImmediate(resolve))
  }
  store.finishScan()
  await store.save()
  return { files: files.length, changed: read, done }
}
