# 轨迹 Race Log 设计文档

- 状态：Draft v0.2，已根据 Gemini 4 Argon 与 Opus 5.5 对 v0.1 的评审修订
- 版本：0.2
- 日期：2026-10-19
- 目标版本：Trajecable 0.5.0
- 原型（概念图，非实现规格）：[`preview/race.html`](../preview/race.html) · [`preview/race.png`](../preview/race.png)
- 评审：[Gemini 4 Argon](reviews/gemini-4-argon.md) · [Opus 5.5](reviews/opus-5-5.md)

## 1. 背景

Trajecable 现在是一个 Stage Log：

- 扫描 DSH、Claude Code、Codex、Pi、Epi、Grok、Antigravity 的本地会话；
- 每个 session 一张卡；
- 模型按「问题是否收口」给 session 打分；
- 卡片里有分数、问题、决策、路线和一段评语。

它信息完整，但读起来像后台报表。用户想要的是：

> 把 session 看成一场比赛。模型是车，token 是燃料，任务复杂度是赛道。打开页面先看到一张帅气的赛道图，再决定要不要看细节。

这个文档定义 Race Log 的产品目标、页面、数据、评分、token 采集、自动总结、边界和实现阶段。

## 2. 一句话定义

**Race Log 是按 session 展示的本地编码比赛记录：每条 session 是一条赛道，模型是车，token 是燃料，完成度是是否冲线。**

不是排行榜，不是模型评测，不是费用账单。

## 3. 目标与非目标

### 3.1 目标

1. 用户 5 秒内看出「最近哪个 session 最费劲、最费 token、有没有做完」。
2. 保留 Stage Log 的判断力：评语、决策、问题收口，不只画图。
3. 把 token 消耗和任务复杂度变成可比较的视觉量，而不是再放两张表。
4. 自动总结可运行，不要求用户逐条点击。
5. 所有数据留在本地；只有摘要 digest 发给 DSH 当前配置的模型。

### 3.2 非目标

- 不做可排序的模型排行榜；Paddock 只做样本概览，不按分数排序。不同任务的赛道不可直接比较。
- 不把分数当代码质量或人的绩效。
- 不做账单。token 是处理量，不是美元成本。
- 不把赛道画成真实地理路线；它是示意，不是遥测。
- 不保存完整 transcript 到索引。
- 不为 Antigravity 伪造 token 或工具数据。

## 4. 术语

| 术语 | 含义 |
| --- | --- |
| session | 一个本地 agent 会话文件。评分、卡片、赛道的最小单位。 |
| run / race | 本文里和 session 同义。 |
| track | 一场 session 的示意赛道。 |
| car | 这个 session 使用的模型。 |
| fuel | 这个 session 的 token 处理量。 |
| complexity | 由提示、工具、文件、跨天数、问题数算出的任务复杂度。 |
| turn | 赛道上的一个弯，对应一个决策点。 |
| pit | 绕路、返工或走偏，画成进站支路。 |
| checkpoint | 一个已收口的问题或一个验证节点。 |
| finish | 所有问题收口，或用户明确结束。 |
| problem | 用户想解决的一个独立问题、bug 或问题单。不是待办事项。 |
| completion | 已解决问题数 / 问题总数，以及未收口状态。 |
| session final | 一个 session 的唯一最终分。 |
| day score | session 在某个活动日的分数，只用于曲线和过程展示，不直接进入历史均分。 |
| history score | 所有已结算 session final 的均分。 |
| engineer comment | 模型对这场 session 的判断、建议和风险，显示成车队无线电。 |
| auto score | 页面打开后自动排队给未评分 session 打分。 |

## 5. 用户故事

1. 我打开 Trajectory，先看到最近 7 天的赛道和分数，知道哪几场值得看。
2. 我看到一场 session 的 token 是 182k，复杂度 7.2，3 个问题只收口 2 个；我想点开看是哪 1 个没做完。
3. 我看到同一个模型在不同 session 的 token/收口比差距很大；我想按模型筛选。
4. 我不想逐条点 Summarize；我打开页面后它自动给最近的未评分 session 排队打分，并显示进度。
5. 我在暗色主题下能看清赛道、节点和文字；不靠颜色也能区分 agent 决策和用户决策。
6. 我发现某场 session 评分不对；我可以重新评分，旧结果不进入历史均分。

## 6. 产品原则

1. **session 是唯一评分单位。** 不按 task，不按天，不按周。
2. **完成度优先于能力分。** 没做完的 session 不能拿高分，活动量大也不行。
3. **评语和事实分开。** summary、problems、decisions 是事实层；comment 是模型观点层。
4. **token 不能猜。** 没有真实 usage 就显示 `—`，不填 0，不用估算冒充真实值。
5. **赛道是示意图。** 不暗示地理、真实路径或精确时间比例。
6. **颜色不是唯一编码。** 决策类型同时有颜色、节点形状和文字标签；agent/用户用实心/空心区分。
7. **自动可以停。** 自动评分有并发上限、可见性暂停、取消入口和明确的调用数量。
8. **历史只结算一次。** 一个跨 5 天的 session 只贡献一个 final，不贡献 5 个日均分。

## 7. 信息架构

单列布局，最大宽度 1180px。没有左侧栏。

```
┌─────────────────────────────────────────────────────────────────────┐
│ 轨迹  RACE LOG        range  agent  model  project  search           │
├─────────────────────────────────────────────────────────────────────┤
│ HERO 不是模型榜。是一条条赛道。       [ 日分点 + session 结算圈 ]    │
│      94 sessions · 3.8M fresh tokens · 7 models · 10 cleared        │
├─────────────────────────────────────────────────────────────────────┤
│ RECENT FORM  最近 8 场：标题 · 分数 · 收口 · fresh token · 状态     │
├─────────────────────────────────────────────────────────────────────┤
│ RACES                                                               │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ RACE 07  title                        73 B   ONGOING            │ │
│ │ [ 开放赛道：start → turns → finish，无随机闭环 ]                │ │
│ │ [ fresh fuel | processed | complexity | dimensions | checkpoints]│ │
│ │ [ RACE ENGINEER comment ]                                        │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ [ 未评分 session：紧凑行，不画空赛道 ]                              │
├─────────────────────────────────────────────────────────────────────┤
│ PADDOCK  车型样本，不排名：model · sessions · fresh fuel · 收口     │
├─────────────────────────────────────────────────────────────────────┤
│ FUEL MAP  complexity × fresh tokens，对数轴                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.1 页面层级

1. **Header**：标题、范围、agent、模型、项目、搜索、自动评分状态。
2. **Hero**：一句话定位、总量、右侧交互式 `dayScore + sessionFinal` 时间线。没有装饰性假赛道。
3. **Recent Form**：最近 8 场的紧凑行。5 秒内回答「哪场最贵、是否做完」。
4. **Races**：已评分 session 的完整 race card；未评分 session 用紧凑行，不占整卡。
5. **Paddock**：车型样本；不排名。
6. **Fuel Map**：复杂度 × fresh token 散点；点击定位。
7. **Card detail**：展开后保留 Stage Log 的问题证据、决策日志、五维条、提示、文件、命令。

### 7.2 默认视图

Race Log 成为 Trajectory 默认视图。Stage Log 的细节不删除：完整卡展开后保留原 decision log、dimensions、prompts、files、commands。未评分 session 默认是紧凑行；评分完成后替换为完整卡。

### 7.3 未评分状态

- 页面首次打开、自动评分关闭或尚未跑完时，绝大多数 session 没有 `ai`。
- 未评分行只显示扫描器已有事实：标题、项目、agent、时间、prompt/tool/file 数、fresh token（若有）、复杂度（若有）、`Summarize`。
- 不画空赛道、不显示 0 分、不显示空的五维条。
- 这是「未评分」，不是「0 个决策/0 个问题」；文案必须分开。

### 7.4 5 秒目标

用户先看 Hero 时间线和 Recent Form。两者都在首屏；不需要滚到 Fuel Map 才知道哪场最贵。Paddock 和 Fuel Map 是第二层。

## 8. 视觉方向

### 8.1 气质

深色、低饱和、像夜间转播的赛车遥测，不像游戏商城。

- 背景接近 `#111316`，卡片 `#191c20`；
- 文字主色 `#e7e9ec`，次要 `#9aa0a8`；
- 发光只给赛道线和当前车辆，不给所有卡片；
- 不用大面积渐变、玻璃拟态、霓虹紫。

### 8.2 颜色

车型色（按 model id 稳定映射，不表示排名）。车型色低饱和；决策色高饱和，二者分属不同明度/饱和度区间，避免 DeepSeek V4 与 scope 撞色：

| 模型类别 | 颜色 |
| --- | --- |
| DeepSeek Flash | `#45c8d6` 青 |
| Claude Opus | `#c68a67` 陶橙 |
| DeepSeek V4 | `#7d78b8` 灰紫 |
| GPT | `#8cb86a` 灰绿 |
| Grok | `#b8a85a` 旧金 |
| Pi / Epi | `#d77f9f` 粉 |
| 其他 | 由 model id 哈希到 8 色之一 |

决策颜色（固定语义，全站一致）：

| 类型 | 颜色 | 含义 |
| --- | --- | --- |
| tech | `#4c8dff` 蓝 | 技术选型、实现方案 |
| scope | `#c06ad9` 洋红 | 范围、产品、取舍 |
| risk | `#d99a35` 琥珀 | 风险、权衡、阻塞 |
| detour | `#e05a4f` 红 | 走偏、返工、回退 |

- agent 决策：实心。
- 用户决策：同形状的空心外环。
- 决策类型用形状区分：tech 圆、scope 菱形、risk 三角、detour 方形。
- 状态：只用文字和中性色，不再用绿色表示 done，避免和「收口」语义冲突。
- 对比度：正文 ≥ 4.5:1；小标签 ≥ 3:1；颜色之外必须有形状和文字。

### 8.3 字体与密度

- 标题 22–24px，卡片标题 15px，正文 13px，辅助 11px。
- 只对时间、token、路径、模型 id 用等宽字体。
- 不使用全大写英文标签作为主要信息；保留 `RACE 07` 这类编号即可。
- 卡片只有一层边框；不在卡片里再套深色块。评语用左侧 2px 色条，不用整块深色。

### 8.4 赛道

- 开放的点到点赛道，不是随机闭环：左 start，右 finish。闭环会让 0% 和 100% 落在同一点，已完成 session 看起来像没出发。
- 4–6 个确定性模板，按 session key 选模板；长度和弯度按 complexity 缩放，不按随机控制点生成。
- 节点沿路径等距或按决策顺序占槽；标签有固定上下槽位，最多 8 个汉字，超出省略。
- 已完成部分实线，未完成部分虚线；车辆位置 = completion rate（0–100%），不是装饰。
- `detour` 画一条向下再回接的 pit 支路；不显示没有数据支持的「浪费 12 分钟」。
- 赛道形状是示意，不表示真实地理或时间比例。
- SVG 标记 `aria-hidden="true"`；可访问内容用下面的决策/检查点文本列表，键盘可操作列表项。

### 8.5 形状编码

| 类型 | 形状 | agent | user |
| --- | --- | --- | --- |
| tech | 圆 | 实心 | 空心 |
| scope | 菱形 | 实心 | 空心 |
| risk | 三角 | 实心 | 空心 |
| detour | 方形 + pit 支路 | 实心 | 空心 |

颜色之外必须有形状和文字。图例同时展示形状和颜色。

### 8.6 亮色主题

亮色不是反色：

- 背景 `#f5f3ee`，卡片 `#fffdf8`，正文 `#1f2328`；
- 赛道线 `#5b616b`，已完成 `#2f6fed`；车辆色降低饱和度；
- 不使用 glow/drop-shadow；
- 所有模型色和决策色在白色背景上 ≥3:1；正文 ≥4.5:1；
- 小屏 <600px 时，赛道变成决策列表 + 进度条，不缩放 SVG 文字。

### 8.7 字体与可访问性

- 最小正文 12px，辅助 11px；赛道内标签不低于 11px；小屏改为列表，不缩字。
- 保留 `RACE 07` 编号，但编号不是稳定 id；数据 key 用 `data-session-key`。
- 键盘：方向键在决策列表移动，Enter 展开；`Summarize` 是原生 button。
- `prefers-reduced-motion` 下不做车辆移动动画。

## 9. Race Card

### 9.1 头部

- `RACE 07`：当前列表序号；筛选后会变，不作为永久 id。
- 标题、项目、agent、开始时间、prompt 数。
- 分数 + 等级：`73 B`；未评分显示 `—`。
- 状态：`ongoing`、`done`、`blocked`；进行中显示 `临时分`。
- 收口：`2/3 closed`；未收口显示 `−8 · 封顶 84`。

### 9.2 赛道与数据来源

每个视觉元素必须有数据来源：

| 视觉 | 来源 | 缺失/空值 |
| --- | --- | --- |
| 赛道长度/弯度 | `complexity` | 用 prompts/tools/files 估算；标注估算 |
| 节点 | `ai.decisions` | 未评分不画赛道 |
| 节点颜色/形状 | `decision.type` + `decision.by` | 默认 tech/agent，仍显示文字 |
| pit 支路 | `decision.type=detour` | 无 |
| 车辆位置 | `completion.rate` | 未评分不画 |
| start/finish | `start` / `state` | 进行中 finish 空心 |
| 收口标签 | `completion.solved/total` | 未评分不显示 |
| 时间 | `start`/`end` | 显示日期 |
| 阶段 | `ai.days.length`，仅 >1 时显示 | 不显示 |

不写没有来源的值：不写「14 turns」「3 stages」当卡内只有一个 session；不写「浪费 12 分钟」；不写「62% distance」除非就是 `completion.rate`。

### 9.3 遥测

| 指标 | 来源 | 缺失时 |
| --- | --- | --- |
| Fresh fuel | `tokens.fresh` | `—` |
| Processed | `tokens.processed` | `—` |
| Cached | `tokens.cachedRead` + 百分比 | 不显示 |
| fresh / closed | `fresh / max(1, solved)` | `—`（solved=0 也显示 `—`，不显示 0） |
| Complexity | 公式见 11.2 | `—` 或估算标记 |
| Time on track | `end - start` + active days | 显示日期 |
| Dimensions | `ai.dimensions` | 未评分隐藏 |
| Checkpoints | `ai.problems` | 未评分隐藏 |
| 多模型 | `tokens.models[]`；`car` 取 token 最多者 | 标 `mixed` |

### 9.4 Race Engineer

复用 `ai.comment`，不额外调用模型。

- `RACE ENGINEER` + tone（good/watch/bad）。
- 判断、建议、风险三行；最多 3 行正文。
- 语气像车队无线电：短、具体、有判断；不写空泛鼓励。
- 可折叠；未评分不显示空话。

### 9.5 未评分卡

见 7.3。紧凑行高度约 64px，包含：

```
● 标题（1 行省略）
  project · agent · time · 7 prompts · 22 tools · fresh 18.2k
  [Summarize]  queued #3
```

不画空赛道，不显示分数，不显示五维条。

### 9.6 交互

- 点击赛道节点展开 decision log 并滚动到对应行。
- 点击 `Summarize` 单条评分；`AUTO SCORE` 控制队列。
- 点击顶部小点滚动到日期；点击大圈滚动到 session。
- 卡片展开保留原 Stage Log 详情。
- 错误只在卡片内显示，不弹全局错误。

## 10. Paddock 与 Fuel Map

### 10.1 Paddock

- 按 `car.id` 聚合当前范围；只显示车型名和稳定颜色。
- 只在「已评分且 token 非空」的 session 上算平均值；样本 <3 显示 `样本不足`。
- 不按平均分排序；按 session 数或车型名排序；不显示 FAST/PRECISION 这类没有数据支持的标签。
- `tokens / closed` 的分子分母都只取有 token 且有 `ai` 的 session；分母为 0 显示 `—`。
- 混合模型 session 不计入单一车型均分；单独显示 `N mixed`。
- 文案：`车型样本，不是模型排名`。

### 10.2 Fuel Map

- x = complexity（1–10），y = fresh tokens（对数轴）。
- 点大小 = 持续时长（封顶），颜色 = 车型。
- 点击点滚动到 session；hover 显示标题/分数/收口。
- 无 token 的 session 不画点，在下方显示「N 个 session 没有 token 数据」。
- `HIGH LOAD` 只标 token/复杂度高，不标「价值高」。

## 11. 数据与计算

### 11.1 新增 session 字段

```ts
type TokenUsage = {
  fresh: number | null          // 未命中缓存的输入 + 输出，Fuel 主值
  processed: number | null      // 所有处理 token，含缓存读取
  input: number | null
  output: number | null
  cachedRead: number | null
  cacheWrite: number | null
  reasoning: number | null
  source: 'provider' | 'derived'
  coverage: { callsWithUsage: number; modelCalls: number } // 部分覆盖时标 ≥
  partial: boolean
  models?: Record<string, number> // model -> processed tokens
}

type SessionRace = {
  tokens: TokenUsage | null
  complexity: number               // 1–10，一位小数；不依赖 ai
  car: { id: string; label: string; color: string; mixed: boolean }
}
```

### 11.2 复杂度

复杂度描述「这场 session 花了多少工程动作」，不是任务固有难度。它必须在评分前可算，不能因为 `problems` 出现而跳变。

```
raw = 1.1 * log10(1 + prompts)
    + 1.6 * log10(1 + toolCalls)
    + 1.2 * log10(1 + files)
    + 0.6 * min(4, activeDays)
complexity = clamp(1, 10, 1 + 1.15 * raw)
```

- 保留一位小数；`activeDays` 来自时间戳，不依赖 AI。
- 没有工具/文件数据的来源（Antigravity）只用 prompts + days，标 `估算`。
- 不在公式里放 `problems`；问题数只影响评分，不影响赛道长度。
- 复杂度不参与 score；它只影响赛道长度和 Fuel Map x 轴。

### 11.3 赛道几何

- 输入：session key、complexity、decisions、completion、state。
- 4–6 个开放模板；key 哈希选模板；complexity 缩放路径长度/弯度。
- 节点按决策顺序占固定槽位；detour 向下 24–40px 再回接。
- 输出 SVG path + 节点坐标；不持久化。
- 无决策时画一条直线 + `没有记录到关键决策`，不画空节点。

### 11.4 token 归一化

先用 provider 的 total；没有 total 才求和。必须按来源去重，缓存不能重复加。

| 来源 | 字段 | input 是否含缓存 | 去重键 | 规则 |
| --- | --- | --- | --- | --- |
| DSH | `assistant/message.data.usage` | 是（OpenAI 风格） | message/call id | `fresh = input - cachedRead + output`；`processed = total ?? input + output` |
| Claude | `assistant.message.usage` | 否（cache 单独字段） | `message.id` / `requestId` | `fresh = input_tokens + output_tokens`；`processed = input + cache_read + cache_creation + output` |
| Codex | `token_count.info.total_token_usage` | 是 | 最后一个累计快照 | `fresh = input_tokens - cached_input_tokens + output_tokens`；`processed = total_tokens` |
| Pi/Epi | `message.usage` | 以 fixture 为准 | message id | 有 total 用 total；否则 fresh = input - cached + output |
| Grok | `usage.json.session` | 是 | session id | `fresh = inputTokens - cachedReadTokens + outputTokens`；`processed = totalTokens` |
| Antigravity | 无 | — | — | `null`，UI `—` |

- `reasoning` 已包含在 OpenAI 的 output 里，不重复加。
- DSH/Pi 的 usage 形状以 Phase 0 的真实 fixture 为准；表中「input 是否含缓存」是待验证项。若 `input` 不含缓存，则 `fresh = input + output`，不要减。
- Claude 一个 message 的多个 content block 可能重复同一 usage；按 `message.id` 只取一次。
- 部分调用有 usage、部分没有：`partial=true`，UI 显示 `≥ 182k`。
- 无 token 不显示 0；显示 `—`。
- Fuel 主值用 `fresh`，因为缓存读取衡量的是上下文长度，不是新工作。
- summary 调用自己的 token 另存 `ai.usage`（可选），不混入 session token。

### 11.5 多模型

- `car` 取 token 最多的模型；`mixed=true`。
- 每个模型 token 存 `tokens.models`；Paddock 不把 mixed 计入单一车型均分。
- 没有 token 但有多个模型时，取 assistant 消息最多的模型。

## 12. 评分与合并

这一节沿用已批准的 Stage Log 规则。

### 12.1 问题收口

模型为每个 session 输出 `problems[]`：

- `solved`：有证据表明完成；
- `partial`：做了一部分；
- `open`：没开始或明确未完成；
- `abandoned`：明确放弃。

### 12.2 最终分

- 五维：decision 25%、execution 25%、risk 15%、verification 20%、focus 15%。
- 每日 part 加权得到 session base；权重 `max(1, prompts + toolCalls)`。
- completion gate：
  - 没有问题或 0 个 solved：封顶 60；
  - 部分收口：`−8`，封顶 84；
  - 全部收口且问题数 >= 2：`+2`；
  - blocked：封顶 50；
  - ongoing：显示临时分。
- 等级：A ≥90，A- ≥85，B+ ≥78，B ≥70，C ≥60，D <60。

### 12.3 日分与历史分

- `dayPart`：session 在一个本地活动日的分数，来自模型当天五维。
- `dayScore`：当天所有 dayPart 的加权平均；只用于顶部曲线和日期行。
- `sessionFinal`：session 所有 dayPart 的加权平均，再过 completion gate；一个 session 只有一个 final。
- `historyScore`：所有已结算 sessionFinal 的等权平均；日分不直接进入历史。
- 跨日 session 只贡献一个 final，挂在最后活动日。earlier days 只显示 continuation marker。
- 未收口/进行中的 session 标 temporary；是否进入历史均分由用户设置决定，默认进入但显示临时。
- 重新评分替换 final；旧版本保留在 `aiHistory`（可选，最多 3 条）用于审计，但绝不重复计入均分。

### 12.4 顶部联动

- Hero 右侧是交互式时间线：小点 = dayScore，大圈 = sessionFinal，画在最后活动日。
- 点击小点滚动到当天；点击大圈滚动到 session 卡。
- 顶部均分、雷达、pass 统计只使用 sessionFinal。
- `Scored 28/94`；少于 3 个已评分时显示「样本不足」，不画雷达。
- 未评分 session 不画 final 圈。

## 13. 自动评分

### 13.1 现状

- 页面打开后自动评分最新 6 个未评分 session；
- `Summarize 30` 一次最多 30 个；
- 单卡可手动评分/重新评分；
- 一次模型调用 2–7 秒，大型 session 可能更久。

### 13.2 目标行为

- **默认关闭**。首次点 `AUTO SCORE` 时显示：将评分 N 个 session、每次调用会发送 digest、预计调用数；用户确认后开启，状态存 localStorage。
- 开启后按「最后活动时间倒序」排队当前范围内未评分 session；初始 12 个。
- 并发 2；手动评分也占用并发，不额外开第三条。
- 页面隐藏时暂停；回到页面继续；范围/筛选变化清空队列。
- 顶部显示 `scoring 3/12`、当前标题、取消按钮。
- 评分完成只更新对应卡和顶部聚合，不整页闪烁。
- 未评分/stale ongoing 分开：正在进行的 session 不自动重评，除非用户点 `重新评分`。
- Antigravity 不自动评分；无 prompt/tool 的 session 不自动评分。

### 13.3 失败与缓存

- 服务端 `inFlight` 按 key 加锁；两个标签页不会同时评分同一 session。
- 失败按 `summaryKey` 记忆；自动队列不反复重试同一失败。
- auth/quota/rate-limit 停止队列并显示原因；解析失败可手动重试。
- 手动重新评分优先于队列；强制刷新替换 final。
- 连续失败定义：同一队列批次内 3 个不同 key 失败即暂停（并发下按完成顺序计数）。

### 13.4 成本

- 每次 digest 最多约 24k 字符；实际 token 取决于模型。
- 首次 consent 显示调用数，不显示美元；可选显示估算 token。
- summary 的 token 存储在 `ai.usage`，不与 session fuel 相加。

## 14. 摘要输入与输出

### 14.1 输入

- 结构化元数据：agent、title、project、时区、开始/结束。
- digest：用户/助手文本、工具名/参数、错误，带本地时间戳。
- 上限：头 16,000 字符 + 尾 8,000 字符；单条消息 1,200；单工具 320。
- 不包含完整工具输出、不包含图片二进制。

### 14.2 输出 schema

```json
{
  "summary": "1-2 sentences, <=240 chars",
  "state": "done|ongoing|blocked",
  "problems": [
    { "title": "...", "status": "solved|partial|open|abandoned", "evidence": "..." }
  ],
  "decisions": [
    { "type": "tech|scope|risk|detour", "by": "agent|user", "title": "...", "reason": "..." }
  ],
  "days": [
    {
      "date": "2026-10-19",
      "did": "...",
      "closed": ["..."],
      "evidence": "...",
      "weight": 1,
      "scores": { "decision": 80, "execution": 70, "risk": 60, "verification": 75, "focus": 65 }
    }
  ],
  "comment": {
    "tone": "good|watch|bad",
    "verdict": "...",
    "judgement": "...",
    "advice": "...",
    "risk": "..."
  }
}
```

- 代码负责所有算术、封顶、等级、历史合并；模型不直接给最终分。
- 模型被要求使用用户主语言；不编造文件/结果。
- 解析失败显示错误；截断 JSON 允许修复，但不猜内容。
- 缓存 key：`end | promptCount | toolCount | version | tz`。

## 15. API

现有接口保持不变，扩展字段。

### 15.1 `GET /api/trajecable/timeline`

新增 query：

- `model`：按模型筛选；
- `view=race|stage`（可选，默认 race）。

compact session 增加：

```json
{
  "tokens": { "total": 182400, "input": 150000, "output": 12000, "cachedRead": 20000, "cacheWrite": 0, "reasoning": 0, "source": "provider" },
  "complexity": 7.2,
  "car": { "id": "deepseek-flash", "label": "DeepSeek Flash", "color": "#45c8d6" }
}
```

### 15.2 `POST /api/trajecable/summary`

请求：`{ key, tz, force }`；返回：`{ key, ai, cached }`。

### 15.3 批量/队列

v0 不做服务端持久队列；客户端顺序调用 summary，刷新页面后从索引里的 `ai` 恢复。若后续需要后台继续，再加 `POST /summary/queue`。

## 16. 存储

- 索引：`~/.dsh/plugin-data/trajecable/index.json`
- **不提升 `VERSION` 来强制重建。** 当前 `store.js` 版本不匹配会丢弃全部 session（包括 `ai`），升级会把 94 个已评分 session 清空，自动评分重新付费。
- 迁移策略：保持 `VERSION=6`，扫描时给旧 session 补 `tokens/complexity/car`；`ai` 原样保留。若某字段必须重建，逐 key 合并，保留 `ai`。
- 索引只保存：计数、摘要、ai、tokens、complexity、car；不保存 transcript。
- `aiHistory` 可选，最多 3 条；不进均分。
- 原子写：temp + rename；单进程 single-flight。

## 17. 安全与隐私

- 全部日志在本机读取；索引在本机。
- 摘要调用会把 digest 发给 DSH 当前配置的 provider；这是唯一的网络请求。
- digest 可能包含用户提示、文件路径、命令；不包含完整文件内容。仍可能含敏感信息。
- **自动评分默认关闭，首次启用必须显式确认**；确认文案说明发送内容、调用数和可停止。
- 不把 token 或摘要上传到第三方服务；不使用云端存储。
- 日志路径、模型 id、项目名可以脱敏显示；默认原样本地展示。

## 18. 性能

- 当前约 713 文件、1.26GB；首次扫描 18s，增量 <1s。
- token 提取在扫描时增量完成；Grok 的 usage.json 很小；Claude 需要按 message id 去重。
- 赛道几何在客户端计算，O(decisions)，不写索引。
- 94 张完整卡约 40,000px 高；未评分用紧凑行，先控制高度。虚拟列表暂不需要，但需要实测。
- 自动评分是主要延迟；并发 2，单批 12。

## 19. 实现阶段

### Phase 0：数据（1–2 天）

- 各 adapter 增加 token 提取；fixture 覆盖有/无 usage。
- `tokens` 写入索引；保持 `VERSION=6`，旧索引原地补字段，保留 `ai`。
- 复杂度函数 + 测试。
- 真实扫描对比：按来源统计有 usage 的 session 数、缺失数、部分覆盖数；把结果写回本文档。

### Phase 1：Race UI（2–3 天）

- 新组件：Hero（交互时间线）、RecentForm、Paddock、RaceCard、Track、Telemetry、Comment、FuelMap。
- 保留 Stage Log 展开详情。
- 双主题；先暗色，后亮色。
- 空值/未评分/扫描中状态。

### Phase 2：自动评分（1–2 天）

- 客户端队列、并发 2、暂停/取消、进度。
- 失败重试与停止。
- 范围切换清空队列。
- 首次显式 consent；失败记忆；服务端 per-key 锁。

### Phase 3：打磨（1 天）

- 可访问性、键盘、对比度。
- 性能与长 prompt。
- README、截图、迁移说明。
- 23+ 测试；真实数据回归。

## 20. 验收标准

1. 真实数据下，Race Log 能显示 7 个来源的 session；Antigravity 显示 `—` token。
2. 未评分 session 显示紧凑行，不画空赛道、不显示 0 分；评分后替换为完整卡。
3. 每个已评分 session 有：分数/等级、收口、问题、comment、赛道、fresh token 或 `—`、processed token 或 `—`。
4. 顶部小点=日分，大圈=session final；点击能跳到对应日期/卡片。
5. 自动评分默认关闭；首次启用有明确 consent；开启后对当前范围最新 12 个未评分排队，并发 2，可取消；页面隐藏暂停；切范围清空。
6. 未收口 session 分数不超过 84；0 收口不超过 60；多问题全收口 +2；blocked 不超过 50。
7. 跨日 session 只有一个 final；历史均分不含日分；ongoing 不自动重评。
8. 颜色之外，形状和文字能区分 tech/scope/risk/detour 与 agent/user；四种类型形状不同。
9. 暗色/亮色主题正文对比度 ≥4.5:1；小屏 <600px 赛道退化为列表；页面可滚动；无横向溢出。
10. 旧索引升级不丢 `ai`；token 部分覆盖显示 `≥`；无 token 显示 `—`。
11. `npm test` 全绿；新增 token 去重/归一化、复杂度、队列、赛道几何、未评分状态测试。
12. README 有截图、数据来源、token 口径、限制和隐私说明。

## 21. 风险与决定

已在 v0.2 决定：

1. **一个 session 一条赛道。** 多日 = 多个 sector；问题 = checkpoint；不拆成多条并行赛道。若用户坚持多条，另开版本。
2. **token 主值用 fresh。** processed 作为第二行；缓存读取不等于新工作。
3. **自动评分默认关闭。** 首次显式 consent；避免在用户不知情时把本地 prompt/path/command 发给 provider。
4. **不升 index version。** 迁移保留 `ai`，避免清空已评分。
5. **复杂度不含问题数。** 评分前后稳定；它是 effort-weighted，不是任务固有难度。
6. **Paddock 不是排行榜。** 不排序、不评价车型性格；均分只作样本概览。
7. **开放赛道。** 不用随机闭环；完成位置=completion rate。

仍需注意：

- token 覆盖率尚未实测；Phase 0 必须先跑真实扫描，按来源报告有 usage 的 session 比例。
- Claude/Pi 的 usage 可能缺失或重复；以 fixture + 真实样本为准。
- 自动评分的 token 成本尚未估算；consent 先显示调用数。
- 亮色主题、窄屏、键盘/读屏需要单独验收。
- 原型里的合成数字（PIT 12 min、14 turns、3 stages、车型标签）不作为规格；实现时删除。

## 22. 评审问题

给 Gemini 4 Argon 和 Opus 5.5 的问题：

1. 这个设计的核心隐喻是否成立？哪里会误导用户？
2. token/complexity 的计算和缺失处理是否可信？
3. 自动评分队列的默认值、并发、成本提示是否合理？
4. 颜色/形状/标签是否满足可访问性？暗色转亮色有什么风险？
5. 数据模型/API 是否足够支持后续扩展？有没有过度设计？
6. 最大的产品/工程风险是什么？先做哪三件事？

## 23. 评审记录

### 23.1 Gemini 4 Argon

- 结论：GO WITH CHANGES。
- 主要问题：顶部 `dayScore + sessionFinal` 时间线缺失；未评分 session 会变成空的大卡；复杂度公式被 `problems` 改变且饱和；DSH token 可能重复加缓存；Paddock 像排行榜；原型违反自己的可访问性规范；闭环赛道让完成位置难读。
- 三个优先改动：顶部时间线 + 未评分紧凑卡；token/复杂度公式固定；开放赛道 + 四种决策形状 + 最小 11px。

### 23.2 Opus 5.5

- 结论：GO WITH CHANGES。
- 主要问题：`VERSION=7` 会清空已评分 `ai`；Claude 同一 message 多行重复 usage；缓存 token 主导 Fuel；自动评分 consent 不清；复杂度只影响数字不影响赛道；原型有大量无来源数值；决策形状未定义；顶部 final 圈不在布局/prototype；Paddock 与「不是排行榜」冲突；亮色/窄屏/键盘未覆盖。
- 三个优先改动：重写 token 表和迁移；把自动评分写成可执行的 consent/锁/失败规范；建立「视觉元素→数据来源」表并删掉无来源数值。

### 23.3 采纳情况

本 v0.2 已采纳：

- 顶部时间线替换装饰赛道；
- 未评分紧凑行；
- 开放赛道 + 四种形状；
- 复杂度移除 problems，评分前可算；
- fresh/processed 双 token，按来源去重，部分覆盖 `≥`；
- 不升 VERSION，保留 `ai`；
- 自动评分默认关闭、显式 consent、并发 2、失败记忆、范围清空；
- Paddock 不排名、样本不足、mixed 单独；
- 亮色/窄屏/键盘/对比度要求；
- 删除原型中没有来源的数值。

未采纳/待定：

- 是否把 Paddock 完全移除（用户明确想看不同车型；保留但去排名）。
- 是否在 0.5.0 先只做 token + 安全队列、Race 视觉延后（评审建议；产品上仍按 Race 做原型，实施可分阶段）。
- 自动评分的 USD 成本（需要 provider 价格表；v0 不显示）。

## 附录 A：原型与合成数据

- 原型：[`preview/race.html`](../preview/race.html)
- 截图：[`preview/race.png`](../preview/race.png)
- 原型里的 token、复杂度、车型、分数均为合成值；仅用于视觉评审。
- 真实数据来自本地索引；不包含在仓库。

## 附录 B：与当前 Stage Log 的关系

当前 0.4.0 已有：

- 扫描 7 个来源；
- session final + completion gate + day parts；
- AI 结构化输出、缓存、自动 6/批量 30；
- Stage Log 卡片、决策路线、评语、五维条、顶部日分/小结。

Race Log 复用这些能力，新增：

- token 采集与归一化；
- complexity / car；
- Race 视觉层；
- 自动评分队列；
- 顶部 final 圈与卡片的联动。

不重写评分和扫描。
