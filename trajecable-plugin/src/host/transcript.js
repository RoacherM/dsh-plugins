// Build a compact reading copy of one session for the summarizer.
// The page index keeps only counts and excerpts, so summaries need the conversation itself.
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cleanText, contentText, isInjectedPrompt, oneLine, toTime } from './util.js'
import { decodeFrames, parseLines } from './zstd.js'

const MAX_HEAD = 16_000
const MAX_TAIL = 8_000
const MAX_MESSAGE = 1_200
const MAX_TOOL = 320

export async function readDigest(session, source, tz = 'UTC') {
  const digest = createDigest(tz)
  if (!source) {
    digest.fallback(session)
    return digest.text()
  }
  try {
    if (session.agent === 'dsh') await readDsh(source, digest)
    else if (session.agent === 'claude') await readClaude(source, digest)
    else if (session.agent === 'codex') await readCodex(source, digest)
    else if (session.agent === 'pi' || session.agent === 'epi') await readPi(source, digest)
    else if (session.agent === 'grok') await readGrok(source, digest)
  } catch {
    digest.fallback(session)
  }
  if (!digest.hasConversation()) digest.fallback(session)
  else digest.facts(session)
  return digest.text()
}

function createDigest(tz) {
  const stampFormat = new Intl.DateTimeFormat('en-CA', { timeZone: tz, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  const stamp = (at) => {
    if (!at) return ''
    try {
      const parts = stampFormat.formatToParts(new Date(at))
      const get = (type) => parts.find((part) => part.type === type)?.value ?? ''
      return `${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
    } catch { return '' }
  }
  let head = ''
  let tail = ''
  let truncated = false
  let conversation = false

  function line(prefix, value, max = MAX_MESSAGE, at = 0) {
    const text = cleanText(value)
    if (!text) return
    const time = stamp(at)
    const entry = `${time ? `[${time}] ` : ''}${prefix}: ${oneLine(text, max)}\n`
    head += entry
    if (head.length > MAX_HEAD) {
      truncated = true
      head = head.slice(0, MAX_HEAD)
    }
    tail = (tail + entry).slice(-MAX_TAIL)
    if (prefix === 'USER' || prefix === 'ASSISTANT') conversation = true
  }

  return {
    user: (value, at = 0) => {
      const text = cleanText(value)
      if (!text || isInjectedPrompt(text)) return
      line('USER', text, MAX_MESSAGE, at)
    },
    assistant: (value, at = 0) => line('ASSISTANT', value, MAX_MESSAGE, at),
    tool: (name, args, at = 0) => {
      const label = oneLine(name || 'tool', 60)
      let input = args
      if (input && typeof input === 'object') input = JSON.stringify(input)
      line('TOOL', `${label} ${oneLine(input, MAX_TOOL)}`.trim(), MAX_TOOL, at)
    },
    error: (value, at = 0) => line('ERROR', value, 500, at),
    title: (value, at = 0) => line('TITLE', value, 120, at),
    note: (value, at = 0) => line('NOTE', value, 300, at),
    hasConversation: () => conversation,
    facts(session) {
      if (session.files?.length) line('FILES', session.files.slice(0, 30).join(', '), 1_600)
      const commands = (session.commands ?? []).slice(0, 12).map((command) => `${command.tool}: ${command.text}`)
      if (commands.length) line('COMMANDS', commands.join(' | '), 1_600)
      if (session.prompts?.length) {
        for (const prompt of session.prompts.slice(0, 6)) line('USER', prompt.text)
      }
    },
    fallback(session) {
      if (session.title) line('TITLE', session.title, 120, session.start)
      for (const prompt of session.prompts ?? []) line('USER', prompt.text, MAX_MESSAGE, prompt.t)
      this.facts(session)
    },
    text() {
      if (!head) return ''
      // Head carries the opening task; tail carries the latest progress for long sessions.
      return truncated ? `${head}\n…\n${tail}` : head
    },
  }
}

function blockText(content) {
  if (!Array.isArray(content)) return contentText(content)
  return content
    .filter((block) => block && typeof block === 'object' && ['text', 'input_text', 'output_text'].includes(block.type))
    .map((block) => block.text ?? '')
    .join('\n')
}

function toolInput(input) {
  if (typeof input === 'string') return input
  if (input && typeof input === 'object') return JSON.stringify(input)
  return ''
}

async function readDsh(file, digest) {
  const raw = await readFile(file)
  const text = file.endsWith('.zstd') ? decodeFrames(raw) : raw.toString('utf8')
  for (const event of parseLines(text)) {
    const data = event.data ?? {}
    const at = toTime(event.time ?? event.timestamp ?? data.time)
    if (event.type === 'user/message') digest.user(contentText(data.content), at)
    else if (event.type === 'assistant/message') {
      for (const block of data.message?.content ?? []) {
        if (block?.type === 'text') digest.assistant(block.text, at)
        else if (block?.type === 'tool-call') digest.tool(block.name, block.arguments, at)
      }
    } else if (event.type === 'tool/call') digest.tool(data.name, data.arguments, at)
    else if (event.type === 'tool/result' && (data.error || data.message?.isError)) {
      digest.error(data.error ?? contentText(data.message?.content) ?? 'tool failed', at)
    }
  }
}

async function eachJsonLine(file, onValue) {
  const stream = createReadStream(file, { encoding: 'utf8' })
  let buffer = ''
  for await (const chunk of stream) {
    buffer += chunk
    let newline
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline)
      buffer = buffer.slice(newline + 1)
      if (!line.trim()) continue
      try { onValue(JSON.parse(line)) } catch { /* skip a torn or unknown line */ }
    }
  }
  if (buffer.trim()) {
    try { onValue(JSON.parse(buffer)) } catch { /* skip */ }
  }
}

async function readClaude(file, digest) {
  await eachJsonLine(file, (record) => {
    if (record.isMeta) return
    const content = record.message?.content
    const at = toTime(record.timestamp)
    if (record.type === 'user') {
      if (typeof content === 'string') digest.user(content, at)
      else if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === 'text') digest.user(block.text, at)
          else if (block?.type === 'tool_result' && block.is_error) digest.error(blockText(block.content), at)
        }
      }
    } else if (record.type === 'assistant' && Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === 'text') digest.assistant(block.text, at)
        else if (block?.type === 'tool_use') digest.tool(block.name, block.input, at)
      }
    }
  })
}

async function readCodex(file, digest) {
  await eachJsonLine(file, (record) => {
    const payload = record.payload ?? {}
    const at = toTime(record.timestamp)
    if (record.type === 'response_item') {
      if (payload.type === 'message') {
        const text = blockText(payload.content)
        if (payload.role === 'user') digest.user(text, at)
        else if (payload.role === 'assistant') digest.assistant(text, at)
      } else if (payload.type === 'function_call' || payload.type === 'custom_tool_call') {
        digest.tool(payload.name, payload.arguments ?? payload.input, at)
      } else if (payload.type === 'function_call_output' || payload.type === 'custom_tool_call_output') {
        const output = payload.output
        const text = typeof output === 'string' ? output : JSON.stringify(output ?? '')
        if (/\"exit_code\"\s*:\s*[1-9]/.test(text) || /Traceback|Script failed/i.test(text)) digest.error(text, at)
      }
    } else if (record.type === 'event_msg' && payload.type === 'user_message') {
      digest.user(payload.message, at)
    }
  })
}

async function readPi(file, digest) {
  await eachJsonLine(file, (record) => {
    if (record.type !== 'message') return
    const message = record.message ?? {}
    const role = message.role
    const at = toTime(record.timestamp ?? message.timestamp)
    if (role === 'user') digest.user(blockText(message.content), at)
    else if (role === 'assistant') {
      const content = message.content
      if (typeof content === 'string') digest.assistant(content, at)
      else if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === 'text') digest.assistant(block.text, at)
          else if (block?.type === 'toolCall') digest.tool(block.name, block.input, at)
        }
      }
    } else if (role === 'toolResult' && message.isError) digest.error(blockText(message.content), at)
  })
}

async function readGrok(dir, digest) {
  let summary = {}
  try { summary = JSON.parse(await readFile(join(dir, 'summary.json'), 'utf8')) } catch { /* optional */ }
  if (summary.generated_title) digest.title(summary.generated_title, toTime(summary.created_at))
  let found = false
  const chat = join(dir, 'chat_history.jsonl')
  await eachJsonLine(chat, (record) => {
    const content = record.content
    const at = toTime(record.timestamp)
    if (record.type === 'user') {
      const value = Array.isArray(content) ? contentText(content) : content
      const query = /<user_query>([\s\S]*?)<\/user_query>/.exec(String(value ?? ''))
      digest.user(query?.[1] ?? value, at)
      found = true
    } else if (record.type === 'assistant') {
      digest.assistant(typeof content === 'string' ? content : contentText(content), at)
      found = true
    }
  }).catch(() => {})
  const updates = join(dir, 'updates.jsonl')
  await eachJsonLine(updates, (record) => {
    const update = record.params?.update ?? {}
    if (update.sessionUpdate === 'tool_call') {
      const tool = update._meta?.['x.ai/tool'] ?? {}
      const kind = tool.kind ?? update.kind ?? ''
      const args = kind === 'write' || kind === 'edit' ? update.rawInput : update.rawInput
      digest.tool(tool.name ?? kind ?? update.title, args, toTime(record.timestamp))
      found = true
    } else if (update.sessionUpdate === 'tool_call_update') {
      const code = update.rawOutput?.exit_code
      if (update.status === 'failed' || (typeof code === 'number' && code !== 0)) {
        digest.error(update.rawOutput?.output ?? update.title ?? 'tool failed', toTime(record.timestamp))
      }
    } else if (!found && update.sessionUpdate === 'user_message_chunk') {
      digest.user(update.content?.text, toTime(record.timestamp))
    } else if (!found && update.sessionUpdate === 'agent_message_chunk') {
      digest.assistant(update.content?.text, toTime(record.timestamp))
    }
  }).catch(() => {})
}
