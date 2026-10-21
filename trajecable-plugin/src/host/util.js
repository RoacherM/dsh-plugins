// Shared shapes and text helpers for the three session-log adapters.
//
// Each adapter turns its own log format into the same compact session record:
//   { key, agent, id, title, cwd, project, branch, model, origin,
//     start, end, promptCount, prompts[], toolCount, tools{},
//     fileCount, files[], commands[], testRuns, testFails, commits, delegates, errors,
//     llmCount, tokens, recent[], turns[] }
// A turn starts at each user prompt: { n, t, llm, tools, errors, tokens }. Only the DSH
// adapter counts LLM replies and tokens; the chat HUD reads them without any model call.

export const MAX_PROMPTS = 12
export const MAX_FILES = 60
export const MAX_COMMANDS = 24
export const MAX_TURNS = 200

const NOISE_PREFIXES = [
  '<system-reminder',
  '<local-command',
  '<command-name',
  '<command-message',
  '<command-args',
  '<command-stdout',
  '<environment_context',
  '<recommended_plugins',
  '<permissions instructions',
  '<user_instructions',
  '<turn_aborted',
  '<synara_host_context',
  'Current runtime context',
  'The following workspace instructions may be relevant',
  'The following is the Codex agent history',
  'Caveat: The messages below',
  'The approval policy changed',
  'The user declined',
  'background job ',
  'Background subagent ',
  'The user approved',
  'The user switched this session to plan mode',
  '[model changed:',
  '[autoproject]',
  'Repeated tool call detected',
  'You are repeating the exact same tool call',
  'You ran the identical',
  'This is an automatically generated checkpoint',
  'Time sampled while preparing turn',
  '[Request interrupted',
  'This session is being continued from a previous conversation',
]

const NOISE_PATTERNS = [
  /^Agent (?:session-)?[0-9a-f][0-9a-f-]{7,} sent a message:/i,
  /^\[\d+\] tool exec call:/,
  /^\[\d+\] (?:assistant|user|system):/,
]

const FILE_KEYS = ['file_path', 'filePath', 'path', 'notebook_path', 'target_file']
const COMMAND_KEYS = ['command', 'cmd']
const DELEGATE_TOOLS = /^(subagent|subagent_fork|task|agent|delegate)$/i
const TEST_COMMAND = /(?:^|[\s;&|])(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test\b|(?:^|[\s;&|])(?:npx\s+)?(?:vitest|jest|mocha|pytest|playwright|cypress)\b|\bnode\s+--test\b|\bgo\s+test\b|\bcargo\s+test\b|\bdeno\s+test\b/
const PATCH_FILE = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm
const PATCH_MOVE = /^\*\*\* Move to: (.+)$/gm
const CMD_IN_CODE = /\b(?:cmd|command)\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|`([^`]*)`)/s

export function parseMaybeJson(value) {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text.startsWith('{') && !text.startsWith('[')) return value
  try { return JSON.parse(text) } catch { return value }
}

export function contentText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (typeof part === 'string') return part
      if (part?.type === 'text' || part?.type === 'input_text' || part?.type === 'output_text') return part.text ?? ''
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

export function cleanText(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function oneLine(text, max = 120) {
  const line = cleanText(text).replace(/\s+/g, ' ')
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line
}

export function isInjectedPrompt(text) {
  const value = cleanText(text)
  if (!value) return true
  if (value.startsWith('# AGENTS.md')) return true
  if (NOISE_PREFIXES.some((prefix) => value.startsWith(prefix))) return true
  return NOISE_PATTERNS.some((pattern) => pattern.test(value))
}

export function toTime(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'number' && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function projectName(cwd) {
  if (!cwd) return ''
  const parts = String(cwd).split('/').filter(Boolean)
  const at = parts.findIndex((part) => part === 'worktrees' || part === '.worktrees')
  if (at >= 0 && parts[at + 1]) return parts[at + 1]
  return parts[parts.length - 1] || ''
}

export const SUMMARY_VERSION = 2

export function freshSummary(session) {
  const ai = session?.ai
  if (!ai || ai.version !== SUMMARY_VERSION) return null
  if (ai.key !== summaryCacheKey(session, ai.tz ?? '')) return null
  if (ai.state === 'done' && ai.completion && ai.completion.solved < ai.completion.total) {
    return { ...ai, state: 'ongoing' }
  }
  return ai
}

export function summaryCacheKey(session, tz = '') {
  return `${session.end ?? 0}|${session.promptCount ?? 0}|${session.toolCount ?? 0}|${SUMMARY_VERSION}|${tz}`
}

export function newSession(agent, key, id) {
  return {
    key,
    agent,
    id: id ?? key,
    title: '',
    cwd: '',
    project: '',
    branch: '',
    model: '',
    origin: '',
    start: 0,
    end: 0,
    promptCount: 0,
    prompts: [],
    toolCount: 0,
    tools: {},
    fileCount: 0,
    files: [],
    commands: [],
    testRuns: 0,
    testFails: 0,
    commits: 0,
    delegates: 0,
    errors: 0,
    llmCount: 0,
    tokens: 0,
    recent: [],
    turns: [],
    ai: null,
  }
}

export function addPrompt(session, t, text) {
  const value = cleanText(text)
  if (!value || isInjectedPrompt(value)) return
  const last = session.prompts[session.prompts.length - 1]
  if (last?.text === value) return
  session.promptCount++
  session.turns ??= [] // records from older index versions have no turns yet
  session.turns.push({ n: session.promptCount, t, llm: 0, tools: 0, errors: 0, tokens: 0 })
  if (session.turns.length > MAX_TURNS) session.turns.shift()
  if (session.prompts.length < MAX_PROMPTS) {
    session.prompts.push({ t, text: value.slice(0, 600) })
  } else {
    // Keep the opening requests and let the newest one replace the tail.
    session.prompts[session.prompts.length - 1] = { t, text: value.slice(0, 600) }
  }
  if (!session.start || (t && t < session.start)) session.start = t
  if (t > session.end) session.end = t
}

function noteFile(session, path) {
  const value = String(path ?? '').trim()
  if (!value || value.length > 500) return
  if (session.files.includes(value)) return
  session.fileCount++
  if (session.files.length < MAX_FILES) session.files.push(value)
}

function patchFiles(text) {
  const paths = []
  for (const match of text.matchAll(PATCH_FILE)) paths.push(match[1])
  for (const match of text.matchAll(PATCH_MOVE)) paths.push(match[1])
  return paths
}

function commandFromCode(text) {
  const match = CMD_IN_CODE.exec(text)
  if (!match) return ''
  const raw = match[1] ?? match[2] ?? match[3] ?? ''
  return raw.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

export function noteToolCall(session, t, name, args, callId) {
  const tool = String(name || 'tool')
  session.toolCount++
  session.tools[tool] = (session.tools[tool] ?? 0) + 1
  const turn = session.turns?.at(-1)
  if (turn) turn.tools++
  const input = parseMaybeJson(args)

  if (input && typeof input === 'object' && !Array.isArray(input)) {
    for (const key of FILE_KEYS) if (input[key]) noteFile(session, input[key])
    for (const key of ['patch', 'input', 'content', 'diff']) {
      if (typeof input[key] === 'string' && input[key].includes('*** ')) for (const path of patchFiles(input[key])) noteFile(session, path)
    }
    const command = COMMAND_KEYS.map((key) => input[key]).find((value) => typeof value === 'string' && value.trim())
    if (command) noteCommand(session, t, tool, command, callId)
  } else if (typeof input === 'string') {
    const command = commandFromCode(input)
    if (command) noteCommand(session, t, tool, command, callId)
    if (input.includes('*** ')) for (const path of patchFiles(input)) noteFile(session, path)
  }

  if (DELEGATE_TOOLS.test(tool)) session.delegates++
  return callId
}

export const MAX_RECENT_STEPS = 24

/**
 * One LLM reply. `tokens` is the reply's totalTokens (input + cache + output), the same
 * figure DSH's Usage footer adds up; `t` is when the reply was written.
 */
export function noteLlmReply(session, t = 0, tokens = 0) {
  session.llmCount = (session.llmCount ?? 0) + 1
  const turn = session.turns?.at(-1)
  if (turn) turn.llm++
  if (!(tokens > 0)) return
  session.tokens = (session.tokens ?? 0) + tokens
  if (turn) turn.tokens = (turn.tokens ?? 0) + tokens
  // The newest replies give the HUD its tokens-per-second speed.
  session.recent ??= []
  session.recent.push({ t, tokens })
  if (session.recent.length > MAX_RECENT_STEPS) session.recent.shift()
}

export function noteCommand(session, t, tool, command, callId) {
  const text = cleanText(command)
  if (!text) return
  const entry = { t, tool, text: oneLine(text, 240), callId }
  session.commands.push(entry)
  if (session.commands.length > MAX_COMMANDS) session.commands.shift()
  if (TEST_COMMAND.test(text)) session.testRuns++
  if (/\bgit\s+commit\b/.test(text)) session.commits++
}

export function noteToolResult(session, callId, failed) {
  if (!failed) return
  session.errors++
  const turn = session.turns?.at(-1)
  if (turn) turn.errors++
  const command = callId
    ? [...session.commands].reverse().find((entry) => entry.callId === callId)
    : session.commands[session.commands.length - 1]
  if (command) {
    command.ok = false
    if (TEST_COMMAND.test(command.text)) session.testFails++
  }
}

export function finalizeSession(session) {
  if (!session.start) session.start = session.end || Date.now()
  if (!session.end || session.end < session.start) session.end = session.start
  session.project ||= projectName(session.cwd)
  if (!session.title) session.title = oneLine(session.prompts[0]?.text ?? '', 80) || session.project || session.agent
  return session
}
