// Antigravity keeps conversation summaries in SQLite (one table per install).
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { finalizeSession, isInjectedPrompt, newSession, oneLine, projectName } from '../util.js'

export const agent = 'antigravity'

const run = promisify(execFile)
const SQL = `SELECT conversation_id, title, preview, step_count,
  last_modified_time, last_user_input_time, workspace_uris
  FROM conversation_summaries ORDER BY last_modified_time`

async function query(dbPath) {
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(dbPath, { readOnly: true })
    try { return db.prepare(SQL).all() } finally { db.close() }
  } catch {
    // Older Node builds have no node:sqlite. macOS ships the sqlite3 CLI.
    try {
      const { stdout } = await run('sqlite3', ['-json', dbPath, SQL])
      return stdout.trim() ? JSON.parse(stdout) : []
    } catch {
      // The IDE database has no conversation_summaries table.
      return []
    }
  }
}

// SQLite prints datetimes as `YYYY-MM-DD HH:MM:SS+00:00`; replacing the space is
// required because V8 misreads a year-0001 value as 2001. Placeholder rows use year 0001.
function sqliteTime(value) {
  if (!value) return 0
  const parsed = Date.parse(String(value).trim().replace(' ', 'T'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function workspacePath(uris) {
  let list = []
  try { list = JSON.parse(uris || '[]') } catch { /* keep empty */ }
  for (const uri of Array.isArray(list) ? list : []) {
    try {
      const path = fileURLToPath(String(uri))
      if (path) return path
    } catch { /* not a file URI */ }
  }
  return ''
}

export async function readSessions(dbPath, sourceTag) {
  const rows = await query(dbPath)
  return rows.map((row) => {
    const id = String(row.conversation_id)
    const start = sqliteTime(row.last_user_input_time)
    const end = sqliteTime(row.last_modified_time)
    if (!start && !end) return undefined
    const session = newSession('antigravity', `antigravity:${sourceTag}:${id}`, id)
    const preview = oneLine(row.preview ?? '', 600)
    const injectedTitle = oneLine(row.title ?? '', 100)
    session.title = isInjectedPrompt(injectedTitle) ? (isInjectedPrompt(preview) ? '' : preview) : (injectedTitle || preview)
    session.cwd = workspacePath(row.workspace_uris)
    session.project = projectName(session.cwd)
    session.start = start || end
    session.end = end
    // A summary row means at least one human turn happened. The preview is the only
    // prompt text available without decoding Antigravity's protobuf step store.
    session.promptCount = session.title ? 1 : 0
    if (preview && !isInjectedPrompt(preview) && preview !== session.title) {
      session.prompts.push({ t: session.start, text: preview })
    }
    return finalizeSession(session)
  }).filter(Boolean)
}
