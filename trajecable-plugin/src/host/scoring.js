// Turn one model evaluation into the scores shown on the Stage Log.
// The model supplies evidence and per-day dimension scores; this file does all arithmetic.
import { oneLine } from './util.js'

export const SUMMARY_VERSION = 2
export const DIMENSIONS = ['decision', 'execution', 'risk', 'verification', 'focus']
export const DIMENSION_WEIGHT = { decision: 0.25, execution: 0.25, risk: 0.15, verification: 0.2, focus: 0.15 }

const DAY = /^\d{4}-\d{2}-\d{2}$/
const DECISION_TYPES = new Set(['tech', 'scope', 'risk', 'detour'])
const DECISION_BY = new Set(['agent', 'user'])
const STATES = new Set(['done', 'ongoing', 'blocked'])
const TONES = new Set(['good', 'watch', 'bad'])
const PROBLEM_STATUS = new Set(['solved', 'partial', 'open', 'abandoned'])

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)))
const text = (value, max) => oneLine(value ?? '', max)

export function gradeFor(score) {
  if (score >= 90) return 'A'
  if (score >= 85) return 'A-'
  if (score >= 78) return 'B+'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  return 'D'
}

function localDay(ms, tz) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms))
  const get = (type) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function closeTruncatedJson(input) {
  let inString = false
  let escaped = false
  const stack = []
  for (const char of input) {
    if (escaped) { escaped = false; continue }
    if (inString) {
      if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{' || char === '[') stack.push(char)
    else if (char === '}' || char === ']') stack.pop()
  }
  let output = input
  if (inString) output += '"'
  while (stack.length) output += stack.pop() === '{' ? '}' : ']'
  return output
}

function parseObject(raw) {
  const source = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = source.indexOf('{')
  if (start < 0) return undefined
  const body = source.slice(start)
  const lastBrace = body.lastIndexOf('}')
  const candidates = [
    body,
    closeTruncatedJson(body),
    lastBrace > 0 ? closeTruncatedJson(body.slice(0, lastBrace + 1)) : '',
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate)
      if (value && typeof value === 'object' && !Array.isArray(value)) return value
    } catch { /* try the repaired tail */ }
  }
  return undefined
}

function normalizeProblems(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => ({
      title: text(item?.title ?? item?.problem ?? '', 110),
      status: PROBLEM_STATUS.has(item?.status) ? item.status : 'open',
      evidence: text(item?.evidence ?? '', 180),
    }))
    .filter((item) => item.title)
    .slice(0, 8)
}

function normalizeDecisions(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => ({
      type: DECISION_TYPES.has(item?.type) ? item.type : 'tech',
      by: DECISION_BY.has(item?.by) ? item.by : 'agent',
      title: text(item?.title ?? '', 100),
      reason: text(item?.reason ?? item?.impact ?? '', 180),
    }))
    .filter((item) => item.title)
    .slice(0, 8)
}

function normalizeScores(value) {
  const scores = {}
  for (const key of DIMENSIONS) scores[key] = clamp(value?.[key] ?? 70)
  return scores
}

function normalizeDays(value, session, tz, fallbackText) {
  const fallbackDate = localDay(session.end || session.start || Date.now(), tz)
  const rows = Array.isArray(value) ? value : []
  const days = rows
    .map((item) => ({
      date: DAY.test(item?.date ?? '') ? item.date : '',
      did: text(item?.did ?? item?.work ?? '', 220),
      closed: Array.isArray(item?.closed) ? item.closed.map((entry) => text(entry, 100)).filter(Boolean).slice(0, 6) : [],
      evidence: text(item?.evidence ?? '', 220),
      weight: clamp(item?.weight ?? 1, 1, 10),
      scores: normalizeScores(item?.scores),
    }))
    .filter((item) => item.date)
    .slice(0, 40)
  if (!days.length) {
    days.push({
      date: fallbackDate,
      did: fallbackText,
      closed: [],
      evidence: '',
      weight: 1,
      scores: normalizeScores(undefined),
    })
  }
  return days
}

function normalizeComment(value) {
  return {
    tone: TONES.has(value?.tone) ? value.tone : 'watch',
    verdict: text(value?.verdict ?? '', 40),
    judgement: text(value?.judgement ?? value?.text ?? '', 260),
    advice: text(value?.advice ?? '', 220),
    risk: text(value?.risk ?? '', 220),
  }
}

export function parseEvaluation(raw) {
  const value = parseObject(raw)
  if (!value) return undefined
  const summary = text(value.summary ?? value.headline ?? '', 300)
  const state = STATES.has(value.state) ? value.state : ''
  const problems = normalizeProblems(value.problems)
  const days = Array.isArray(value.days) ? value.days : []
  if (!summary && !problems.length && !days.length) return undefined
  return {
    summary,
    state,
    problems,
    decisions: normalizeDecisions(value.decisions),
    days,
    comment: normalizeComment(value.comment),
  }
}

function weighted(rows, pick) {
  const total = rows.reduce((sum, row) => sum + row.weight, 0)
  if (!total) return 0
  return rows.reduce((sum, row) => sum + pick(row) * row.weight, 0) / total
}

export function buildAi(evaluation, session, tz) {
  const days = normalizeDays(evaluation.days, session, tz, evaluation.summary)
  for (const day of days) {
    day.score = DIMENSIONS.reduce((sum, key) => sum + day.scores[key] * DIMENSION_WEIGHT[key], 0)
    day.score = clamp(day.score)
  }

  const dimensions = {}
  for (const key of DIMENSIONS) dimensions[key] = clamp(weighted(days, (day) => day.scores[key]))
  const base = clamp(weighted(days, (day) => day.score))

  const problems = evaluation.problems ?? []
  const solved = problems.filter((item) => item.status === 'solved').length
  const partial = problems.filter((item) => item.status === 'partial').length
  const abandoned = problems.filter((item) => item.status === 'abandoned').length
  const totalProblems = problems.length
  const declared = evaluation.state || (totalProblems && solved === totalProblems ? 'done' : 'ongoing')
  const state = declared === 'done' && solved < totalProblems ? 'ongoing' : declared
  const notes = []

  let score = base
  let cap = 100
  if (!totalProblems) {
    cap = 60
    notes.push('没有明确收口 · 封顶 60')
  } else if (!solved) {
    cap = 60
    notes.push('0 个问题收口 · 封顶 60')
  } else if (solved < totalProblems) {
    score -= 8
    cap = 84
    notes.push(`未收口 −8 · 封顶 84`)
  } else if (totalProblems >= 2) {
    score += 2
    notes.push('多问题收口 +2')
  }
  if (state === 'blocked') {
    cap = Math.min(cap, 50)
    notes.push('受阻 · 封顶 50')
  }
  if (state === 'ongoing') notes.push('临时分')
  score = clamp(Math.min(score, cap))

  return {
    version: SUMMARY_VERSION,
    tz,
    summary: evaluation.summary || '',
    score,
    grade: gradeFor(score),
    base,
    dimensions,
    days: days.map((day) => ({
      date: day.date,
      score: day.score,
      weight: day.weight,
      did: day.did,
      closed: day.closed,
      evidence: day.evidence,
      scores: day.scores,
    })),
    problems,
    decisions: evaluation.decisions ?? [],
    completion: {
      total: totalProblems,
      solved,
      partial,
      open: totalProblems - solved - partial - abandoned,
      abandoned,
      rate: totalProblems ? Math.round((solved / totalProblems) * 100) : 0,
    },
    comment: evaluation.comment,
    state,
    scoreNote: notes.join(' · '),
  }
}
