// Turn indexed sessions into the page's shape: local days -> projects -> compact sessions.
import { freshSummary, oneLine } from './util.js'

const DAY_FORMAT = new Map()

function dayFormatter(tz) {
  if (!DAY_FORMAT.has(tz)) {
    DAY_FORMAT.set(tz, new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }))
  }
  return DAY_FORMAT.get(tz)
}

export function safeTimeZone(tz) {
  if (!tz) return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(0)
    return tz
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'
  }
}

export function dayKey(ms, tz) {
  const parts = dayFormatter(tz).formatToParts(new Date(ms))
  const get = (type) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

const emptyFacts = () => ({ prompts: 0, files: 0, tests: 0, testFails: 0, commits: 0, errors: 0, delegates: 0 })

function addFacts(into, session) {
  into.prompts += session.promptCount ?? 0
  into.files += session.fileCount ?? 0
  into.tests += session.testRuns ?? 0
  into.testFails += session.testFails ?? 0
  into.commits += session.commits ?? 0
  into.errors += session.errors ?? 0
  into.delegates += session.delegates ?? 0
}

function compact(session) {
  const fresh = freshSummary(session)
  return {
    key: session.key,
    agent: session.agent,
    id: session.id,
    title: session.title,
    project: session.project,
    cwd: session.cwd,
    branch: session.branch,
    model: session.model,
    origin: session.origin,
    start: session.start,
    end: session.end,
    promptCount: session.promptCount,
    fileCount: session.fileCount,
    toolCount: session.toolCount,
    tests: session.testRuns,
    commits: session.commits,
    errors: session.errors,
    delegates: session.delegates,
    firstPrompt: oneLine(session.prompts?.[0]?.text ?? '', 260),
    ...(fresh ? { ai: fresh } : {}),
  }
}

function matches(session, { project, q }) {
  if (project && session.project !== project) return false
  if (!q) return true
  const needle = q.toLowerCase()
  const haystack = [
    session.title,
    session.project,
    session.cwd,
    ...(session.prompts ?? []).map((prompt) => prompt.text),
    ...(session.files ?? []),
    ...(session.commands ?? []).map((command) => command.text),
    session.ai?.summary ?? '',
    ...(session.ai?.problems ?? []).map((item) => item.title),
    session.ai?.comment?.judgement ?? '',
  ].join('\n').toLowerCase()
  return haystack.includes(needle)
}

// A session with no prompt, tool, file or command is an empty shell (old or aborted).
export function isMeaningful(session) {
  return (session.promptCount ?? 0) > 0
    || (session.toolCount ?? 0) > 0
    || (session.fileCount ?? 0) > 0
    || (session.commands?.length ?? 0) > 0
}

export function buildTimeline({ sessions, from = 0, to = Date.now(), tz, agent, project, q, indexed, scan }) {
  const zone = safeTimeZone(tz)
  const agents = agent ? new Set(String(agent).split(',').filter(Boolean)) : undefined
  const meaningful = sessions.filter(isMeaningful)
  const selected = meaningful
    .filter((session) => session.start <= to && (session.end || session.start) >= from)
    .filter((session) => !agents || agents.has(session.agent))
    .filter((session) => matches(session, { project, q }))
    .sort((a, b) => a.start - b.start)

  const days = new Map()
  const totals = { sessions: 0, projects: 0, ...emptyFacts() }
  const totalAgents = {}
  const projectSet = new Set()
  const daySet = new Set()

  for (const session of selected) {
    const anchor = session.end || session.start
    const date = dayKey(anchor, zone)
    daySet.add(date)
    projectSet.add(session.project || '')
    totalAgents[session.agent] = (totalAgents[session.agent] ?? 0) + 1
    totals.sessions++
    addFacts(totals, session)

    let day = days.get(date)
    if (!day) {
      day = { date, sessions: [], facts: emptyFacts(), agents: {}, projects: new Map(), first: session.start, last: session.start }
      days.set(date, day)
    }
    day.sessions.push(session)
    day.first = Math.min(day.first, session.start)
    day.last = Math.max(day.last, anchor)
    day.agents[session.agent] = (day.agents[session.agent] ?? 0) + 1
    addFacts(day.facts, session)

    const name = session.project || ''
    let group = day.projects.get(name)
    if (!group) {
      group = { name, cwd: session.cwd, sessions: [], last: session.start, facts: emptyFacts() }
      day.projects.set(name, group)
    }
    group.sessions.push(session)
    group.last = Math.max(group.last, anchor)
    if (session.cwd) group.cwd = session.cwd
    addFacts(group.facts, session)
  }

  const dayList = [...days.values()]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((day) => ({
      date: day.date,
      first: day.first,
      last: day.last,
      sessions: day.sessions.length,
      agents: day.agents,
      facts: day.facts,
      projects: [...day.projects.values()]
        .sort((a, b) => b.last - a.last)
        .map((group) => ({
          name: group.name,
          cwd: group.cwd,
          last: group.last,
          sessions: group.sessions.sort((a, b) => b.start - a.start).map(compact),
          facts: group.facts,
        })),
    }))

  totals.days = daySet.size
  totals.projects = projectSet.size

  const projectIndex = new Map()
  for (const session of meaningful) {
    const name = session.project || ''
    const entry = projectIndex.get(name) ?? { name, count: 0, last: 0, agents: new Set() }
    entry.count++
    entry.last = Math.max(entry.last, session.end || session.start)
    entry.agents.add(session.agent)
    projectIndex.set(name, entry)
  }

  return {
    tz: zone,
    from,
    to,
    totals,
    agents: totalAgents,
    days: dayList,
    projects: [...projectIndex.values()]
      .sort((a, b) => b.last - a.last)
      .slice(0, 200)
      .map((entry) => ({ name: entry.name, count: entry.count, last: entry.last, agents: [...entry.agents] })),
    indexed,
    scan,
  }
}

export function buildSessionDetail(session, tz) {
  if (!session) return undefined
  // Same rule as the timeline: a stale summary is not shown.
  return { ...session, ai: freshSummary(session) ?? undefined, day: dayKey(session.end || session.start, safeTimeZone(tz)) }
}
