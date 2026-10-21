// Ask the configured model to review one session for the Stage Log.
// The result is cached in the index against the session's latest activity.
import { randomUUID } from 'node:crypto'
import { oneLine, summaryCacheKey, freshSummary } from './util.js'
import { parseEvaluation, buildAi } from './scoring.js'
import { readDigest } from './transcript.js'

const PROMPT_SYSTEM = `You review one coding-agent session for a work log. Return one JSON object and nothing else:
{
  "summary": "1-2 sentences, at most 240 characters: what this session actually did",
  "state": "done|ongoing|blocked",
  "problems": [{"title":"a distinct user goal, bug or question","status":"solved|partial|open|abandoned","evidence":"short factual evidence"}],
  "decisions": [{"type":"tech|scope|risk|detour","by":"agent|user","title":"the decision","reason":"why it was made"}],
  "days": [{"date":"YYYY-MM-DD","did":"what happened that local day","closed":["problem titles closed that day"],"evidence":"short evidence","weight":1-10,"scores":{"decision":0-100,"execution":0-100,"risk":0-100,"verification":0-100,"focus":0-100}}],
  "comment": {"tone":"good|watch|bad","verdict":"short verdict","judgement":"your own judgement, 1-2 sentences","advice":"one concrete next step","risk":"the main risk, empty if none"}
}
Rules:
- problems are outcomes, not chores. Mark solved only when the transcript shows the work was finished. A session that closes several problems is better than one that stops halfway.
- days only list active local dates. Use the timestamps in the transcript. weight reflects how much work happened that day, not how long the session was open.
- scores judge the work done that day. Do not reward activity alone. An unfinished session must not receive a high completion score.
- comment is your opinion, not a description. Use the main language of the user's messages.
- Do not invent files, results or problems. Do not mention prompt or tool counts. Return JSON only, no markdown.`

const PROMPT_TAIL = `Write in the main language of the user's messages. Do not invent work that is not in the transcript.`

export function findSource(store, key) {
  for (const [path, record] of Object.entries(store.snapshot().files)) {
    if (record.key === key) return path
    if (record.agent === 'antigravity' && key.startsWith(record.key)) return path
  }
  return ''
}

export async function buildSummaryInput(session, source, tz = 'UTC') {
  const digest = await readDigest(session, source, tz)
  const parts = [
    `Agent: ${session.agent}`,
    `Title: ${oneLine(session.title || 'untitled', 160)}`,
    `Project: ${session.project || '(none)'}`,
    `Time zone: ${tz}`,
    `Started: ${session.start ? new Date(session.start).toISOString() : 'unknown'}`,
    `Ended: ${session.end ? new Date(session.end).toISOString() : 'unknown'}`,
    '',
    'Conversation and work:',
    digest || '(only metadata is available)',
    '',
    PROMPT_TAIL,
  ]
  return parts.join('\n')
}

export const DEFAULT_SUMMARY_PROVIDER = 'deepseek-official'
export const DEFAULT_SUMMARY_MODEL = 'deepseek-flash'

export function createSummarizer({ ctx, store, config = {}, log }) {
  const inFlight = new Map()
  // Every DSH install ships the official DeepSeek provider, so reviews do not follow the chat's model.
  const route = {
    provider: config.summaryProvider ?? DEFAULT_SUMMARY_PROVIDER,
    model: config.summaryModel ?? DEFAULT_SUMMARY_MODEL,
  }
  const maxTokens = config.summaryMaxTokens ?? 2000
  const timeoutMs = config.summaryTimeoutMs ?? 90_000

  async function callModel(input) {
    const llm = ctx.get('llm')
    if (!llm) throw new Error('no model service is available')
    const signal = AbortSignal.timeout(timeoutMs)
    const call = await llm.prepareCall({ provider: route.provider, model: route.model, maxTokens }, signal)
    const messages = [{
      id: randomUUID(),
      role: 'user',
      content: [{ type: 'text', text: input }],
      source: { kind: 'dsh-trajecable-summary' },
    }]
    const options = { ...call.config, messages, system: PROMPT_SYSTEM, purpose: 'trajecable-summary', signal }
    let output = ''
    let finish
    for await (const chunk of call.stream(options)) {
      if (chunk.type === 'text-delta') output += chunk.text
      else if (chunk.type === 'block-end' && chunk.block?.type === 'text' && !output) output += chunk.block.text
      else if (chunk.type === 'finish') finish = chunk.reason
    }
    if (finish?.kind === 'error' || finish?.kind === 'aborted') {
      const error = new Error(finish.failure?.message ?? 'summary request failed')
      error.code = finish.failure?.code
      throw error
    }
    return { text: output, provider: route.provider, model: route.model }
  }

  async function run(session, { force = false, tz = 'UTC' } = {}) {
    if (!force) {
      const fresh = freshSummary(session)
      if (fresh && fresh.tz === tz) return { ai: fresh, cached: true }
    }
    if (inFlight.has(session.key)) return inFlight.get(session.key)
    const task = (async () => {
      const source = findSource(store, session.key)
      const input = await buildSummaryInput(session, source, tz)
      const result = await callModel(input)
      const evaluation = parseEvaluation(result.text)
      if (!evaluation) throw new Error('the model returned an invalid review')
      const ai = buildAi(evaluation, session, tz)
      ai.key = summaryCacheKey(session, tz)
      ai.at = Date.now()
      ai.model = `${result.provider}/${result.model}`
      session.ai = ai
      await store.save()
      return { ai, cached: false }
    })().finally(() => inFlight.delete(session.key))
    inFlight.set(session.key, task)
    return task
  }

  return { run, fresh: freshSummary, source: (session) => findSource(store, session.key) }
}
