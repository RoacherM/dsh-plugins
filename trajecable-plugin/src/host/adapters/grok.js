// Grok Build sessions: summary.json + updates.jsonl (event stream), with chat_history fallback.
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  addPrompt, cleanText, contentText, finalizeSession, newSession, noteToolCall, noteToolResult, oneLine, toTime,
} from '../util.js'

export const agent = 'grok'

const FILE_KINDS = new Set(['write', 'edit'])
const NO_FILE_KINDS = new Set(['read', 'list', 'search', 'web_fetch', 'web_search'])

async function readJsonl(file, onRecord) {
  let buffer = ''
  const stream = createReadStream(file, { encoding: 'utf8' })
  for await (const chunk of stream) {
    buffer += chunk
    let newline
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline)
      buffer = buffer.slice(newline + 1)
      if (line.trim()) onRecord(line)
    }
  }
  if (buffer.trim()) onRecord(buffer)
}

function promptFromChat(text) {
  const raw = cleanText(text)
  const match = /<user_query>([\s\S]*?)<\/user_query>/.exec(raw)
  return match ? match[1] : raw
}

function toolInfo(update) {
  const meta = update._meta?.['x.ai/tool'] ?? {}
  return {
    name: meta.name || update.title || 'tool',
    kind: meta.kind || '',
  }
}

export async function readSession(dir) {
  let summary = {}
  try { summary = JSON.parse(await readFile(join(dir, 'summary.json'), 'utf8')) } catch { /* keep empty */ }
  const id = summary.info?.id || basename(dir)
  const session = newSession('grok', `grok:${id}`, id)
  session.cwd = summary.info?.cwd ?? ''
  session.branch = summary.head_branch ?? ''
  session.model = summary.current_model_id ?? ''
  session.title = oneLine(summary.generated_title || summary.session_summary || '', 100)
  session.start = toTime(summary.created_at)
  session.end = toTime(summary.updated_at)

  const seenPrompts = new Set()
  const failedCalls = new Set()
  const updates = join(dir, 'updates.jsonl')
  let readUpdates = false
  try {
    await readJsonl(updates, (line) => {
      let record
      try { record = JSON.parse(line) } catch { return }
      const update = record.params?.update
      if (!update) return
      readUpdates = true
      const at = toTime(record.timestamp)
      if (at > session.end) session.end = at

      if (update.sessionUpdate === 'user_message_chunk') {
        const index = update._meta?.promptIndex
        if (index !== undefined) {
          if (seenPrompts.has(index)) return
          seenPrompts.add(index)
        }
        addPrompt(session, at, update.content?.text ?? '')
        return
      }

      if (update.sessionUpdate === 'tool_call') {
        const info = toolInfo(update)
        const args = !info.kind || FILE_KINDS.has(info.kind) || !NO_FILE_KINDS.has(info.kind)
          ? update.rawInput
          : {}
        noteToolCall(session, at, info.name, args, update.toolCallId)
        return
      }

      if (update.sessionUpdate === 'tool_call_update') {
        const exitCode = update.rawOutput?.exit_code
        const failed = update.status === 'failed' || (typeof exitCode === 'number' && exitCode !== 0)
        if (failed && update.toolCallId && !failedCalls.has(update.toolCallId)) {
          failedCalls.add(update.toolCallId)
          noteToolResult(session, update.toolCallId, true)
        }
      }
    })
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  // Older Grok builds have no updates stream; the chat history still has the prompts.
  if (!readUpdates) {
    try {
      await readJsonl(join(dir, 'chat_history.jsonl'), (line) => {
        let record
        try { record = JSON.parse(line) } catch { return }
        if (record.type !== 'user' || record.synthetic_reason) return
        addPrompt(session, toTime(record.timestamp), promptFromChat(contentText(record.content)))
        if (!session.model && record.model_id) session.model = record.model_id
      })
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }

  if (!session.model) {
    // Older summaries only carry the model on the assistant chat rows.
    try {
      await readJsonl(join(dir, 'chat_history.jsonl'), (line) => {
        if (session.model) return
        try {
          const record = JSON.parse(line)
          if (record.type === 'assistant' && record.model_id) session.model = record.model_id
        } catch { /* skip */ }
      })
    } catch { /* summary-only session */ }
  }

  if (!session.title) session.title = oneLine(session.prompts[0]?.text, 80) || session.project || 'Grok'
  finalizeSession(session)
  return session
}
