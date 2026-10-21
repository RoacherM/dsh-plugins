/**
 * Page wording in Chinese and English, following DSH's language setting live. {name} in a
 * string is replaced from the values passed to t(). Any non-Chinese locale falls back to English.
 */
import React from 'react';

export const DICT = {
  zh: {
    panel: 'Formula', title: 'Formula', subtitle: '本地 coding agent 的每日工作线索',
    raceControl: '赛控台',
    range_today: '1D', range_1d: '1D', range_7d: '7D', range_30d: '30D', range_90d: '90D', range_all: 'ALL',
    rangeLong_today: '1D', rangeLong_1d: '1D', rangeLong_7d: '7D', rangeLong_30d: '30D', rangeLong_90d: '90D', rangeLong_all: 'ALL',
    allAgents: '全部代理', allProjects: '全部项目',
    agent_dsh: 'DSH', agent_claude: 'Claude Code', agent_codex: 'Codex',
    agent_pi: 'Pi', agent_epi: 'Epi', agent_grok: 'Grok', agent_antigravity: 'Antigravity',
    search: '搜索标题、评语、文件', loading: '加载中…', retry: '重试',
    scan: '扫描', scanning: '正在扫描 {done}/{total}', scanningShort: '扫描中',
    scanIdle: '更新于 {time}', scanNever: '尚未扫描', scanFailed: '扫描失败：{error}',
    indexed: '已索引 {n} 个会话',
    loadFailed: '加载失败：{error}',
    sessionsUnit: '个会话',
    sessions: '会话',
    scoredShort: '已评',
    clearedShort: '收口',
    avg: '均分',
    dayAvg: '日均 {n}',
    sectorCam: '赛段镜头',
    openSession: '打开会话',
    filter: '筛选',
    closedRatio: '{solved}/{total} 收口',
    noSelection: '选择一条会话查看赛段',
    rangeSummary: '{range} · {days} 个活跃日 · {projects} 个项目 · {prompts} 次提示',
    statFiles: '改动文件', statTests: '测试', statCommits: '提交', statDelegates: '委派', statErrors: '失败',
    testFailedShort: '失败 {n}',
    activity: '每日会话',
    today: '今天', yesterday: '昨天',
    daySessions: '{n} 个会话，主要在 {project}', dayFiles: '改动 {n} 个文件', dayTests: '运行 {n} 次测试',
    dayCommits: '提交 {n} 次', dayErrors: '失败 {n} 次',
    commitsChip: '提交 {n}', testFailsChip: '测试失败 {n}', errorsChip: '失败 {n}', delegatesChip: '委派 {n}',
    groupSessions: '{n} 个会话', groupFiles: '{n} 个文件', showMore: '再显示 {n} 个会话',
    noProject: '未命名项目',
    sessionPrompts: '{n} 提示', sessionFiles: '{n} 文件', sessionTests: '{n} 测试',
    sessionCommits: '{n} 提交', sessionErrors: '失败 {n}',
    subagent: '子代理', guardian: '审查',
    openInDsh: '在 DSH 中打开',
    summaryTitle: 'AI 总结', summaryGenerate: '让 agent 总结', summaryRegenerate: '重新总结',
    summaryGenerating: '正在总结…', summaryFailed: '总结失败：{error}', summaryEmpty: '还没有总结。',
    summaryProgress: '进度：{text}', summaryState_done: '已完成', summaryState_ongoing: '进行中', summaryState_blocked: '受阻',
    summaryHint: '根据这段会话的对话和工具记录生成。',
    summaryAll: '总结 {n} 个',
    summaryAllBusy: '总结中 {done}/{total}',
    detailLoading: '读取会话…', detailFailed: '读取失败：{error}',
    model: '模型', branch: '分支', origin: '来源', period: '时间', cwd: '目录',
    originUser: '本人', originSubagent: '子代理', originGuardian: '审查', originOther: '其他',
    promptsTitle: '你说了什么', filesTitle: '改动的文件', commandsTitle: '运行的命令',
    noPrompts: '没有可读的提示记录，可能是自动任务。', noFiles: '没有记录到文件改动。', noCommands: '没有记录到命令。',
    failedMark: '失败', moreFiles: '还有 {n} 个文件', moreCommands: '还有 {n} 条命令',
    emptyTitle: '这段时间没有会话', emptyHint: '开始用本地 coding agent 工作后，每日轨迹会出现在这里。',
    clearFilters: '清空筛选',
    scanNote: '数据只保存在本机，来自本地 coding agent 的会话日志。',
    stageLog: '关卡日志', season: '赛季', seasonMeta: '{n} 个 session · {decisions} 个决策 · {detours} 个弯路',
    scored: '已评分 {n}/{total}', pass: '通关 {n}/{total}', sampleLow: '样本不足',
    noScores: '还没有评分。点“总结”让 agent 先看最近几个会话。',
    dayScore: '日分', chartLegend: '点 = 日分 · 圈 = session 结算', score: '评分', scoreUnrated: '未评分',
    summarize: '总结', summarizing: '总结中…', summarizeAll: '总结 {n} 个', summarizeBusy: '总结中 {done}/{total}',
    summaryError: '总结失败：{error}',
    myComment: '我的判断', problems: '问题', decisionLog: '决策日志', route: '路线',
    solved: '已收口', partial: '部分', openProblem: '未收口', abandoned: '放弃',
    stateDone: '完成', stateOngoing: '进行中', stateBlocked: '受阻',
    state_done: '完成', state_ongoing: '进行中', state_blocked: '受阻',
    tone_good: '稳健', tone_watch: '留意', tone_bad: '风险',
    hudLive: 'LIVE', hudFinal: 'FINAL', hudUnscored: '未评分', hudIdle: 'IDLE',
    hudSpeedUnit: 'tok/s', hudTotal: '共 {n} tok', hudTurnShort: 'T{n} · {llm} 步', hudTurnLine: 'T{n} · {llm} 步 · {tools} 工具', hudCondWaiting: '等你输入', hudOldHost: '重启 DSH',
    hudCondOpen: '{n} 未收口', hudCondErrors: '失败 ×{n}', hudCondDetours: '走偏 ×{n}', hudCondWatch: '待收口',
    antigravityMeta: 'Antigravity 仅记录会话元数据，无轨迹几何与评分。',
    gate: '{solved}/{total} 收口', tempScore: '临时分', scoreNote: '评分说明',
    dimensions: '五维评分', dim_decision: '决策', dim_execution: '执行', dim_risk: '风险', dim_verification: '验证', dim_focus: '聚焦', decisionTech: '技术', decisionScope: '范围', decisionRisk: '风险', decisionDetour: '走偏',
    byAgent: 'agent 自主', byUser: '你拍板', start: '开始', now: '当前', done: '收口',
    showDetails: '展开决策与评分', hideDetails: '收起', openRecord: '打开原始记录',
    noComment: '还没有评论。', noProblems: '没有识别出问题清单。',
    advice: '建议', risk: '风险', verdict: '判断',
    justNow: '刚刚', minutesAgo: '{n} 分钟前', hoursAgo: '{n} 小时前', daysAgo: '{n} 天前',
    circuit: '赛道全图', lap: '圈进度 {n}%', lapUnknown: '未评分 · 虚线为未跑', stops: '进站 · 你的提示',
    stopsMore: '还有 {n} 次提示', decisionsTitle: '决策',
    legendDone: '已跑', legendTodo: '未跑', legendStop: '提示', hudShow: '显示赛段镜头', hudHide: '隐藏赛段镜头',
    notIndexed: '未索引',
    lessThanMinute: '不到 1 分钟', minutes: '{n} 分钟', hours: '{n} 小时', hoursMinutes: '{h} 小时 {m} 分',
  },
  en: {
    panel: 'Formula', title: 'Formula', subtitle: 'A daily trail of your local coding agents',
    raceControl: 'RACE CONTROL',
    range_today: '1D', range_1d: '1D', range_7d: '7D', range_30d: '30D', range_90d: '90D', range_all: 'ALL',
    rangeLong_today: '1D', rangeLong_1d: '1D', rangeLong_7d: '7D', rangeLong_30d: '30D', rangeLong_90d: '90D', rangeLong_all: 'ALL',
    allAgents: 'All agents', allProjects: 'All projects',
    agent_dsh: 'DSH', agent_claude: 'Claude Code', agent_codex: 'Codex',
    agent_pi: 'Pi', agent_epi: 'Epi', agent_grok: 'Grok', agent_antigravity: 'Antigravity',
    search: 'Search titles, notes, files', loading: 'Loading…', retry: 'Retry',
    scan: 'Scan', scanning: 'Scanning {done}/{total}', scanningShort: 'Scanning',
    scanIdle: 'Updated {time}', scanNever: 'Not scanned yet', scanFailed: 'Scan failed: {error}',
    indexed: '{n} sessions indexed', indexed_one: '{n} session indexed', indexed_other: '{n} sessions indexed',
    loadFailed: 'Failed to load: {error}',
    sessionsUnit: 'sessions',
    sessions: 'sessions',
    scoredShort: 'scored',
    clearedShort: 'cleared',
    avg: 'avg',
    dayAvg: 'day {n}',
    sectorCam: 'SECTOR CAM',
    openSession: 'Open session',
    filter: 'Filter',
    closedRatio: '{solved}/{total} closed',
    noSelection: 'Select a session',
    rangeSummary: '{range} · {days} active days · {projects} projects · {prompts} prompts',
    statFiles: 'Files', statTests: 'Tests', statCommits: 'Commits', statDelegates: 'Delegates', statErrors: 'Failures',
    testFailedShort: '{n} failed',
    activity: 'Sessions per day',
    today: 'Today', yesterday: 'Yesterday',
    daySessions: '{n} sessions, mostly in {project}', daySessions_one: '{n} session, mostly in {project}', daySessions_other: '{n} sessions, mostly in {project}',
    dayFiles: '{n} files changed', dayFiles_one: '{n} file changed', dayFiles_other: '{n} files changed',
    dayTests: '{n} test runs', dayTests_one: '{n} test run', dayTests_other: '{n} test runs',
    dayCommits: '{n} commits', dayCommits_one: '{n} commit', dayCommits_other: '{n} commits',
    dayErrors: '{n} failures', dayErrors_one: '{n} failure', dayErrors_other: '{n} failures',
    commitsChip: '{n} commits', commitsChip_one: '{n} commit', commitsChip_other: '{n} commits',
    testFailsChip: '{n} test failures', testFailsChip_one: '{n} test failure', testFailsChip_other: '{n} test failures',
    errorsChip: '{n} failures', errorsChip_one: '{n} failure', errorsChip_other: '{n} failures',
    delegatesChip: '{n} delegates', delegatesChip_one: '{n} delegate', delegatesChip_other: '{n} delegates',
    groupSessions: '{n} sessions', groupSessions_one: '{n} session', groupSessions_other: '{n} sessions', showMore: 'Show {n} more', 
    groupFiles: '{n} files', groupFiles_one: '{n} file', groupFiles_other: '{n} files',
    noProject: 'Untitled project',
    sessionPrompts: '{n} prompts', sessionPrompts_one: '{n} prompt', sessionPrompts_other: '{n} prompts',
    sessionFiles: '{n} files', sessionFiles_one: '{n} file', sessionFiles_other: '{n} files',
    sessionTests: '{n} tests', sessionTests_one: '{n} test', sessionTests_other: '{n} tests',
    sessionCommits: '{n} commits', sessionCommits_one: '{n} commit', sessionCommits_other: '{n} commits',
    sessionErrors: '{n} failed',
    subagent: 'subagent', guardian: 'review',
    openInDsh: 'Open in DSH',
    summaryTitle: 'AI summary', summaryGenerate: 'Summarize with agent', summaryRegenerate: 'Summarize again',
    summaryGenerating: 'Summarizing…', summaryFailed: 'Summary failed: {error}', summaryEmpty: 'No summary yet.',
    summaryProgress: 'Progress: {text}', summaryState_done: 'done', summaryState_ongoing: 'ongoing', summaryState_blocked: 'blocked',
    summaryHint: 'Written from this session conversation and tool record.',
    summaryAll: 'Summarize {n}',
    summaryAllBusy: 'Summarizing {done}/{total}',
    detailLoading: 'Reading session…', detailFailed: 'Failed to read: {error}',
    model: 'Model', branch: 'Branch', origin: 'Origin', period: 'Time', cwd: 'Directory',
    originUser: 'you', originSubagent: 'subagent', originGuardian: 'review', originOther: 'other',
    promptsTitle: 'What you asked', filesTitle: 'Files changed', commandsTitle: 'Commands run',
    noPrompts: 'No readable prompts; this may be an automated task.', noFiles: 'No file changes recorded.', noCommands: 'No commands recorded.',
    failedMark: 'failed',
    moreFiles: '{n} more files', moreFiles_one: '{n} more file', moreFiles_other: '{n} more files',
    moreCommands: '{n} more commands', moreCommands_one: '{n} more command', moreCommands_other: '{n} more commands',
    emptyTitle: 'No sessions in this period', emptyHint: 'Once you work with a local coding agent, the daily trail shows up here.',
    clearFilters: 'Clear filters',
    scanNote: 'Stored on this machine only, from local coding-agent session logs.',
    stageLog: 'Stage log', season: 'SEASON', seasonMeta: '{n} sessions · {decisions} decisions · {detours} detours',
    seasonMeta_one: '{n} session · {decisions} decisions · {detours} detours',
    seasonMeta_other: '{n} sessions · {decisions} decisions · {detours} detours',
    scored: 'Scored {n}/{total}', pass: 'Cleared {n}/{total}', sampleLow: 'Not enough scores',
    noScores: 'No scores yet. Summarize a few recent sessions to start the season.',
    dayScore: 'Day score', chartLegend: 'dot = day · ring = session final', score: 'Score', scoreUnrated: 'Not scored',
    summarize: 'Summarize', summarizing: 'Summarizing…', summarizeAll: 'Summarize {n}', summarizeBusy: 'Summarizing {done}/{total}',
    summaryError: 'Summary failed: {error}',
    myComment: 'MY COMMENT', problems: 'Problems', decisionLog: 'Decision log', route: 'Route',
    solved: 'closed', partial: 'partial', openProblem: 'open', abandoned: 'dropped',
    stateDone: 'done', stateOngoing: 'ongoing', stateBlocked: 'blocked',
    state_done: 'done', state_ongoing: 'ongoing', state_blocked: 'blocked',
    tone_good: 'good', tone_watch: 'watch', tone_bad: 'risk',
    hudLive: 'LIVE', hudFinal: 'FINAL', hudUnscored: 'UNSCORED', hudIdle: 'IDLE',
    hudSpeedUnit: 'tok/s', hudTotal: '{n} tok', hudTurnShort: 'T{n} · {llm} steps', hudTurnLine: 'T{n} · {llm} steps · {tools} tools', hudCondWaiting: 'your turn', hudOldHost: 'restart DSH',
    hudCondOpen: '{n} open', hudCondErrors: 'fail ×{n}', hudCondDetours: 'detour ×{n}', hudCondWatch: 'ongoing',
    antigravityMeta: 'Antigravity records session metadata only; no track geometry or score.',
    gate: '{solved}/{total} closed', tempScore: 'provisional', scoreNote: 'Score note',
    dimensions: 'Dimensions', dim_decision: 'Decision', dim_execution: 'Execution', dim_risk: 'Risk', dim_verification: 'Verification', dim_focus: 'Focus', decisionTech: 'tech', decisionScope: 'scope', decisionRisk: 'risk', decisionDetour: 'detour',
    byAgent: 'agent', byUser: 'you', start: 'start', now: 'now', done: 'done',
    showDetails: 'Decisions and scores', hideDetails: 'Collapse', openRecord: 'Open raw record',
    noComment: 'No comment yet.', noProblems: 'No problems were identified.',
    advice: 'Advice', risk: 'Risk', verdict: 'Verdict',
    justNow: 'just now', minutesAgo: '{n} min ago', hoursAgo: '{n} h ago', daysAgo: '{n} d ago',
    circuit: 'CIRCUIT', lap: 'lap {n}%', lapUnknown: 'not scored · dashed = not driven', stops: 'STOPS · YOUR PROMPTS',
    stopsMore: '{n} more prompts', stopsMore_one: '{n} more prompt', stopsMore_other: '{n} more prompts', decisionsTitle: 'DECISIONS',
    legendDone: 'driven', legendTodo: 'to go', legendStop: 'prompt', hudShow: 'Show Sector Cam', hudHide: 'Hide Sector Cam',
    notIndexed: 'not indexed',
    lessThanMinute: 'under a minute', minutes: '{n} min', hours: '{n} h', hoursMinutes: '{h} h {m} min',
  },
};

export const langOf = (active) => (String(active ?? '').toLowerCase().startsWith('zh') ? 'zh' : 'en');

const EN_PLURAL = new Intl.PluralRules('en');

export function translator(lang) {
  const dict = DICT[lang] ?? DICT.en;
  return (key, values = {}) => {
    let resolvedKey = key;
    if (lang === 'en' && values.n !== undefined) {
      const count = Number(String(values.n).replace(/[^0-9.-]/g, ''));
      const form = EN_PLURAL.select(Number.isFinite(count) ? count : 0);
      const candidate = `${key}_${form}`;
      if (dict[candidate] !== undefined) resolvedKey = candidate;
    }
    return String(dict[resolvedKey] ?? dict[key] ?? DICT.zh[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => (values[name] ?? ''));
  };
}

const I18n = React.createContext({ lang: 'zh', t: translator('zh') });

/** Wrap a tree so it re-renders when DSH's language changes. `locale` is ctx.locale (may be absent in tests). */
export function withI18n(locale, Component) {
  const subscribe = (fn) => locale?.subscribe?.(fn) ?? (() => {});
  const snapshot = () => (locale?.getSnapshot?.() ?? locale?.getLocale?.())?.active ?? '';
  return function Localized(props) {
    const lang = langOf(React.useSyncExternalStore(subscribe, snapshot));
    const value = React.useMemo(() => ({ lang, t: translator(lang) }), [lang]);
    return <I18n.Provider value={value}><Component {...props} /></I18n.Provider>;
  };
}

export const useI18n = () => React.useContext(I18n);
