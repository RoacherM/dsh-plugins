// Pi (and its Epi fork) session logs: one JSONL file per session.
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import {
  addPrompt, contentText, finalizeSession, newSession, noteToolCall, noteToolResult, toTime,
} from '../util.js'

export const agent = 'pi'

export function create(key, agentName = 'pi') {
  const id = /_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/.exec(key)?.[1]
    ?? basename(key, '.jsonl')
  return newSession(agentName, `${agentName}:${id}`, id)
}

export function feed(session, record) {
  const time = toTime(record.timestamp)

  if (record.type === 'session') {
    session.cwd ||= record.cwd ?? ''
    session.start ||= time
    if (record.id) {
      session.id = record.id
      session.key = `${session.agent}:${record.id}`
    }
    return
  }

  if (record.type === 'model_change') {
    session.model = record.modelId || session.model
    return
  }

  if (record.type !== 'message') return
  const message = record.message ?? {}
  const at = toTime(message.timestamp ?? record.timestamp, time)

  if (message.role === 'user') {
    addPrompt(session, at, contentText(message.content))
    return
  }

  if (message.role === 'assistant') {
    if (message.model) session.model = message.model
    if (message.stopReason === 'error') session.errors++
    for (const block of message.content ?? []) {
      if (block?.type === 'toolCall') {
        noteToolCall(session, at, block.name, block.arguments, block.id)
      }
    }
    return
  }

  if (message.role === 'toolResult' && message.isError) {
    noteToolResult(session, message.toolCallId, true)
  }
}

export function finalize(session) {
  return finalizeSession(session)
}

/** Read a complete file. Used by tests and by one-shot callers. */
export async function readSession(file, agentName = 'pi') {
  const session = create(file, agentName)
  for (const line of (await readFile(file, 'utf8')).split('\n')) {
    if (!line.trim()) continue
    try { feed(session, JSON.parse(line)) } catch { /* skip a damaged line */ }
  }
  return finalize(session)
}
