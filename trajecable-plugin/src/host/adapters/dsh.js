// DSH: ~/.dsh/sessions/<workspace>/<uuid>/session.v<N>.jsonl[.zstd]
// The file is small enough to re-read; a full re-read also repairs any interrupted earlier scan.
import { readFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { addPrompt, contentText, finalizeSession, newSession, noteLlmReply, noteToolCall, noteToolResult, toTime } from '../util.js'
import { decodeFrames, parseLines } from '../zstd.js'

export const agent = 'dsh'

export function keyOf(file) {
  return `dsh:${basename(dirname(file))}`
}

export function create(file) {
  return newSession(agent, keyOf(file), basename(dirname(file)))
}

export function feed(session, event) {
  const time = toTime(event.time)
  if (time) {
    if (!session.start) session.start = time
    if (time > session.end) session.end = time
  }
  const data = event.data ?? {}

  switch (event.type) {
    case 'session': {
      session.cwd ||= event.cwd ?? data.cwd ?? ''
      session.origin ||= event.origin ?? data.origin ?? ''
      const createdAt = event.createdAt ?? data.createdAt
      if (createdAt) {
        const created = toTime(createdAt)
        if (created) session.start = created
      }
      break
    }
    case 'session/title': {
      if (data.title) session.title = String(data.title)
      break
    }
    case 'user/message': {
      addPrompt(session, time, contentText(data.content))
      break
    }
    case 'assistant/message': {
      session.model ||= data.message?.source?.model ?? ''
      noteLlmReply(session, time, Number(data.usage?.totalTokens) || 0)
      break
    }
    case 'tool/call': {
      noteToolCall(session, time, data.name, data.arguments, data.callId)
      break
    }
    case 'tool/result': {
      noteToolResult(session, data.toolCallId ?? data.message?.toolCallId, Boolean(data.error || data.message?.isError))
      break
    }
  }
}

export async function readSession(file) {
  const raw = await readFile(file)
  const text = file.endsWith('.zstd') ? decodeFrames(raw) : raw.toString('utf8')
  const session = create(file)
  for (const event of parseLines(text)) feed(session, event)
  finalizeSession(session)
  return session
}
