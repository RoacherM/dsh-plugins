// Design preview: the real page against synthetic sessions, for browser / headless checks.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { buildTimeline, buildSessionDetail } from '../src/host/timeline.js'
import { makeChatHud } from '../src/client/chat-hud.jsx'
import { makePage } from '../src/client/page.jsx'
import { CSS } from '../src/client/styles.js'
import DATA from './data.json'

const params = new URLSearchParams(location.search)
const theme = params.get('theme') || 'dark'
document.documentElement.dataset.theme = theme
const countParam = Number(params.get('count') || 0)

const NOW = Date.now()
const DAY_MS = 86_400_000

const AI_MAP = {
  'dsh:a': {
    version: 2,
    tz: 'Asia/Shanghai',
    key: 'dsh:a',
    summary: '45° 俯视镜头与赛控台双栏定稿，北向标与车载光环就位。',
    score: 86,
    grade: 'A',
    base: 88,
    dimensions: { decision: 88, execution: 86, risk: 84, verification: 86, focus: 86 },
    days: [
      { date: new Date(NOW - 3 * DAY_MS).toISOString().slice(0, 10), score: 78, weight: 1 },
      { date: new Date(NOW - 2 * DAY_MS).toISOString().slice(0, 10), score: 81, weight: 1 },
      { date: new Date(NOW - 1 * DAY_MS).toISOString().slice(0, 10), score: 84, weight: 1 },
      { date: new Date(NOW).toISOString().slice(0, 10), score: 86, weight: 1 },
    ],
    problems: [
      { title: '45° 俯视 Sector Cam 几何', status: 'solved', evidence: 'live-hud-opus.png' },
      { title: '简化全局双栏结构', status: 'solved', evidence: 'global-simple.png' },
      { title: '0.5.0 代码合入与验收', status: 'partial', evidence: '进行中' },
    ],
    decisions: [
      { type: 'tech', by: 'user', title: '定 248×264 纵横比与 45° 俯视', reason: '消除圆环仪表盘噪音' },
      { type: 'scope', by: 'user', title: '去掉行内缩略图与展开手风琴', reason: '聚焦单实例 Sector Cam' },
      { type: 'detour', by: 'agent', title: '首版整条赛道亮白无进度切分', reason: '改为前灰后白切分' },
      { type: 'tech', by: 'agent', title: '路面内嵌黄旗与砂石偏航区', reason: '事件直接画在路面上' },
    ],
    completion: { total: 4, solved: 3, partial: 1, open: 0, abandoned: 0, rate: 68 },
    comment: {
      tone: 'watch',
      verdict: '镜头方向明确',
      judgement: '前两轮在全赛道闭合和圆角盒上绕了弯，切到开放赛段 + 45° 俯视后立住。',
      advice: '把未收口的那一项收掉即可封板。',
      risk: '',
    },
    state: 'ongoing',
  },
  'claude:b': {
    version: 2,
    tz: 'Asia/Shanghai',
    key: 'claude:b',
    summary: 'KV cache 量化至 8-bit 并在 24GB 机器通过压测。',
    score: 91,
    grade: 'A+',
    base: 91,
    dimensions: { decision: 92, execution: 90, risk: 88, verification: 92, focus: 92 },
    days: [{ date: new Date(NOW).toISOString().slice(0, 10), score: 91, weight: 1 }],
    problems: [
      { title: '定位 22GB 显存峰值', status: 'solved', evidence: 'profiler' },
      { title: '实现 KV cache 量化', status: 'solved', evidence: 'tests pass' },
    ],
    decisions: [
      { type: 'tech', by: 'agent', title: '采用分组 int8 KV 量化', reason: 'API 零改动' },
      { type: 'tech', by: 'agent', title: '补 24GB 内存上限回归测试', reason: '防止回退' },
    ],
    completion: { total: 2, solved: 2, partial: 0, open: 0, abandoned: 0, rate: 100 },
    comment: {
      tone: 'good',
      verdict: '一次收口',
      judgement: '问题边界清晰，量化后显存降到 14.2GB，全部测试一次通过。',
      advice: '保持。',
      risk: '',
    },
    state: 'done',
  },
}

function buildPreviewSessions() {
  const base = DATA.sessions.map((session, idx) => {
    const offsetMs = idx * 3600_000
    const start = NOW - offsetMs - 2400_000
    const end = NOW - offsetMs
    const ai = idx === 0
      ? AI_MAP['dsh:a']
      : idx === 1
        ? AI_MAP['claude:b']
        : null
    // Old preview data has no live counts; spread the prompts and tools over turns.
    const promptCount = Math.max(1, session.promptCount ?? 1)
    const turns = session.turns ?? Array.from({ length: promptCount }, (_, i) => {
      const tools = Math.round((session.toolCount ?? 0) / promptCount) + (i % 3)
      return { n: i + 1, t: start + i * 60_000, llm: tools + 1, tools, errors: i === promptCount - 2 && session.errors ? 1 : 0, tokens: (tools + 1) * 60_000 }
    })
    // Replies of the running turn: one every 8 s, about 60k tokens each (cache included).
    const recent = Array.from({ length: 6 }, (_, i) => ({ t: NOW - (6 - i) * 8_000, tokens: 52_000 + i * 3_000 }))
    if (params.get('running')) turns[turns.length - 1] = { ...turns[turns.length - 1], t: NOW - 90_000 }
    return {
      ...session,
      turns,
      llmCount: session.llmCount ?? turns.reduce((sum, turn) => sum + turn.llm, 0),
      tokens: turns.reduce((sum, turn) => sum + turn.tokens, 0),
      recent,
      start,
      end,
      ai,
      summaryKey: ai ? `${end}|${session.promptCount}|${session.toolCount}` : '',
    }
  })

  if (!countParam || countParam <= base.length) return base

  const expanded = []
  for (let i = 0; i < countParam; i += 1) {
    const proto = base[i % base.length]
    const start = NOW - (i + 1) * 300_000
    const end = start + 180_000
    expanded.push({
      ...proto,
      key: `${proto.key}-row-${i}`,
      id: `${proto.id || 's'}-${i}`,
      title: `${proto.title} #${i + 1}`,
      start,
      end,
    })
  }
  return expanded
}

const PREVIEW_SESSIONS = buildPreviewSessions()

window.fetch = async (url, options = {}) => {
  const target = new URL(url, location.href)
  const q = target.searchParams
  const ok = (value) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
  if (target.pathname.endsWith('/timeline')) {
    const range = q.get('range') ?? '7d'
    const from = range === 'all' ? 0 : Number(q.get('from') ?? 0)
    return ok(buildTimeline({
      sessions: PREVIEW_SESSIONS,
      from,
      to: Number(q.get('to') ?? Date.now()) + DAY_MS,
      tz: q.get('tz'),
      agent: q.get('agent') || undefined,
      project: q.get('project') || undefined,
      q: q.get('q') || undefined,
      indexed: { ...DATA.indexed, sessions: PREVIEW_SESSIONS.length },
      scan: { ...DATA.scan, lastScanAt: NOW - 180_000 },
    }))
  }
  if (target.pathname.endsWith('/summary')) {
    const body = options.body ? JSON.parse(options.body) : {}
    const session = PREVIEW_SESSIONS.find((item) => item.key === body.key)
    return ok({
      key: body.key,
      ai: session?.ai ?? null,
      cached: true,
    })
  }
  if (target.pathname.endsWith('/session')) {
    const session = PREVIEW_SESSIONS.find((item) => item.key === q.get('key'))
    if (!session) return new Response(JSON.stringify({ error: 'session not found' }), { status: 404 })
    return ok({ ...buildSessionDetail(session, q.get('tz')), ai: session.ai })
  }
  if (target.pathname.endsWith('/status')) {
    return ok({
      scan: { ...DATA.scan, lastScanAt: NOW - 180_000 },
      indexed: { ...DATA.indexed, sessions: PREVIEW_SESSIONS.length },
    })
  }
  if (target.pathname.endsWith('/scan')) return ok({ ok: true, scan: { ...DATA.scan, scanning: false } })
  return ok({})
}

const style = document.createElement('style')
style.textContent = CSS
document.head.appendChild(style)

const locale = { getSnapshot: () => ({ active: params.get('lang') ?? 'zh-CN' }), subscribe: () => () => {} }
const Page = makePage({ openSession: () => {}, locale })
const ChatHud = makeChatHud({ locale })
// ?running=1 shows the HUD while a turn runs.
const status = new Map()
const useSessionStatus = (select) => select(status)
// ?view=chat shows a stand-in chat header with the Sector Cam toggle.
const chatId = params.get('session') ?? PREVIEW_SESSIONS.find((s) => s.agent === 'dsh')?.id
if (params.get('running')) status.set(chatId, { running: true })
createRoot(document.getElementById('root')).render(params.get('view') === 'chat' ? (
  <div style={{ height: '100%', background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)' }}>
    <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 20px', borderBottom: '1px solid var(--dsw-alias-border-l1)' }}>
      <span style={{ marginRight: 'auto' }}>Chat · Formula</span>
      <ChatHud sessionId={chatId} useSessionStatus={useSessionStatus} />
    </div>
  </div>
) : <Page />)
