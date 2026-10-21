// Claude Code: ~/.claude/projects/<encoded-cwd>/<uuid>.jsonl and <uuid>/subagents/*.jsonl
import { basename } from 'node:path'
import { addPrompt, contentText, finalizeSession, newSession, noteToolCall, noteToolResult, oneLine, toTime } from '../util.js'

export const agent = 'claude'

export function keyOf(file) {
  const rest = file.split('/.claude/projects/')[1] ?? basename(file)
  return `claude:${rest.replace(/\.jsonl$/, '')}`
}

export function create(file) {
  return newSession(agent, keyOf(file), basename(file, '.jsonl'))
}

export function feed(session, record) {
  const time = toTime(record.timestamp)
  if (time && !session.end) session.end = time
  if (time && time > session.end) session.end = time
  if (record.cwd) session.cwd ||= record.cwd
  if (record.gitBranch) session.branch = record.gitBranch
  if (record.isSidechain) session.origin = 'subagent'

  switch (record.type) {
    case 'custom-title': {
      if (record.customTitle) session.title = String(record.customTitle)
      break
    }
    case 'ai-title': {
      if (record.aiTitle) session.title = String(record.aiTitle)
      break
    }
    case 'summary': {
      if (record.summary && !session.title) session.title = oneLine(record.summary, 80)
      break
    }
    case 'user': {
      if (record.isMeta) break
      const content = record.message?.content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === 'tool_result' && block.is_error) noteToolResult(session, block.tool_use_id, true)
        }
      }
      if (Array.isArray(content) && content.some((block) => block?.type === 'tool_result')) break
      if (record.origin?.kind && record.origin.kind !== 'human') break
      const prompt = contentText(content)
      if (prompt) addPrompt(session, time, prompt)
      if (!session.start && time) session.start = time
      break
    }
    case 'assistant': {
      session.model = record.message?.model ?? session.model
      const content = record.message?.content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === 'tool_use') noteToolCall(session, time, block.name, block.input, block.id)
        }
      }
      break
    }
    case 'system': {
      if (record.subtype === 'turn_duration' && record.durationMs) session.end = Math.max(session.end, time)
      break
    }
  }
}

export function finalize(session) {
  return finalizeSession(session)
}
