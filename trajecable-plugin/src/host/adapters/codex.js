// Codex: ~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<uuid>.jsonl
import { basename } from 'node:path'
import { addPrompt, contentText, finalizeSession, newSession, noteToolCall, noteToolResult, toTime } from '../util.js'

export const agent = 'codex'

export function keyOf(file) {
  return `codex:${basename(file, '.jsonl')}`
}

export function create(file) {
  return newSession(agent, keyOf(file), basename(file, '.jsonl'))
}

function outputFailed(output) {
  const text = Array.isArray(output) ? contentText(output) : String(output ?? '')
  if (!text) return false
  const exit = /"exit_code"\s*:\s*(-?\d+)/.exec(text)
  if (exit && Number(exit[1]) !== 0) return true
  if (/Script failed|Traceback \(most recent call last\)/.test(text)) return true
  try {
    const parsed = JSON.parse(text)
    return Boolean(parsed && typeof parsed === 'object' && (parsed.success === false || parsed.error))
  } catch {
    return false
  }
}

export function feed(session, record) {
  const time = toTime(record.timestamp)
  if (time && time > session.end) session.end = time
  const payload = record.payload ?? {}

  switch (record.type) {
    case 'session_meta': {
      session.id = payload.id ?? session.id
      session.cwd ||= payload.cwd ?? ''
      session.origin ||= payload.thread_source ?? ''
      if (payload.timestamp) session.start = toTime(payload.timestamp, session.start)
      break
    }
    case 'turn_context': {
      session.cwd ||= payload.cwd ?? ''
      session.model = payload.model ?? session.model
      break
    }
    case 'event_msg': {
      if (payload.type === 'user_message' && payload.message) addPrompt(session, time, payload.message)
      break
    }
    case 'response_item': {
      switch (payload.type) {
        case 'message': {
          if (payload.role !== 'user') break
          const prompt = contentText(payload.content)
          if (prompt) addPrompt(session, time, prompt)
          break
        }
        case 'function_call':
        case 'custom_tool_call': {
          noteToolCall(session, time, payload.name, payload.arguments ?? payload.input, payload.call_id)
          break
        }
        case 'function_call_output':
        case 'custom_tool_call_output': {
          noteToolResult(session, payload.call_id, outputFailed(payload.output))
          break
        }
      }
      break
    }
  }
}

export function finalize(session) {
  return finalizeSession(session)
}
