# 从一个节点重新开始：rewind 插件的设计

这份文档说明 rewind 插件怎样让一段对话从中间的某一步重新生成。读完这一份就够了，不需要打开别的文件。

## 目标

一段对话跑到一半出错时，用户想回到出错之前那一步，让模型在那里重新采样一遍，而不是从第 0 句重放整段历史。

要求三条：

1. 只保留目标节点**之前**的历史，包括之前每个工具调用的调用与输出。
2. 目标节点**之后**的一切全部丢弃。
3. 新会话立刻以一条「继续」作为用户输入，触发一次 prefill，让模型从这个位置重新生成。

## 术语

| 术语 | 意思 |
| --- | --- |
| 事件 | 会话日志里一条不可变的记录，带 `seq`（序号，从 0 递增）、`type`、`time`、`data` |
| 会话 | 一串事件。磁盘上是 `~/.dsh/sessions/<项目>/<会话id>/session.v4.jsonl.zstd` |
| turn（轮） | 用户发一句话到模型答完，由 `turn/start` … `turn/end` 包住。`turn/end` 的 `data.reason.kind` 是 `completed`、`error`、`forked` 等 |
| step（步） | turn 里的一轮模型请求，由 `step/start` … `step/end` 包住。一个 turn 有多步：模型说一句、调工具、看结果、再说一句 |
| 前缀 | 从 seq 0 到某个边界（含边界）的事件副本 |
| fork（分叉） | 复制前缀，生成一个新会话，父会话不动 |
| 子会话 | fork 出来的那个会话，`isSeeded: true`，带 `parentSession` 和 `inheritedEventCount` |
| prefill | 把历史渲染成请求内容、让模型接着生成的那一段输入 |
| 折叠 | billion-context 把旧消息换成摘要块（compress），减少 prefill |

一个 turn 的事件长这样（取自一条真实失败会话）：

```
1589 step/start
1590 assistant/message      ← 模型决定这一步要做什么
1591 tool/call  compress    ← 工具节点
1592 tool/result            ← 工具输出
1593 step/end
1594 step/start             ← 下一步，这里撞上了 400
```

## 一次 resume 的步骤

| 步 | 谁做 | 做什么 |
| --- | --- | --- |
| 1 | 插件 | 从 Chat 快照里列出可重跑的节点，算出分叉边界 |
| 2 | 用户在弹窗里选一行 | 选中的行带着边界 `seq` |
| 3 | 插件 | `ctx.sessions.fork({ sessionId, atSeq, increaseTitle: true })`，得到子会话 id |
| 4 | 插件 | `ctx.uiWorkspace.openSession(childId)`，把界面切到子会话 |
| 5 | 插件 | `ctx.sessions.using(childId, { source: 'rewind' }, ref => ref.binding.ctx.conversation.send('继续'))` |
| 6 | DSH | 子会话把前缀 + 「继续」渲染成请求，prefill 一次，模型开始生成 |
| 7 | 宿主 | 插件补一个 `session/end-seed` 事件，再用 `openTurnClosers` 把前缀里那个开口的 turn 和 step 关掉，原因写 `forked` |

第 7 步很重要：前缀是在 turn 中间截断的，所以复制过来的 turn 没有结尾。DSH 必须给它补一个收尾，否则日志不合法。

## 为什么边界是「这一步开始之前」

边界取的是**这一步的 `step/start` 事件的 seq 减 1**，也就是这一整步都不进子会话。

这条规则试过三个版本，前两个都错：

| 版本 | 边界 | 结果 |
| --- | --- | --- |
| 0.3.0 | 工具调用节点自己的 `anchorSeq` | 边界落在工具调用的 seq 上，于是「决定调用这个工具」的那条 assistant 消息还留在前缀里，工具调用和结果被丢掉。DSH 补一条**失败的**工具结果把这一步收尾。模型看到的是「我调过这个工具，它失败了」，不是重新采样 |
| 中途试过 | 工具的 `anchorSeq - 2` | 假设「工具调用前面那条事件是 assistant 消息」。实测 321 次工具调用，前一条是 `assistant/message` 只有 233 次，`tool/result` 53 次，`tool/call` 28 次。所以减 2 一般不对 |
| 0.4.0 起 | 包含该节点的那一步的 `step/start` 减 1 | 这一步的消息、调用、结果全丢，后面也全丢。模型拿到同样的输入，重新采样这一步 |

同一步里的多个工具调用合并成一行，因为它们本来一起重跑。

边界按 turn 分桶计算 `step/start`；不分桶会把第 2 轮的工具调用错误地划到第 1 轮的步起点。

## 为什么必须发一条「继续」

`fork` 只复制前缀，不发起任何模型请求。复制过来的 turn 立刻被按 `forked` 收尾，于是子会话看起来「已完成」——就是你看到的 `Completed in 1s` 那个空 turn。没有任何东西在跑，因为要等一条新消息才会开新的 turn。

客户端接口里没有「不发消息就让模型继续」的方法（只有 `prompt`、`fork`、`page`、`follow`），所以子会话收到一条真实的用户消息 `继续`。代价：模型能在历史里看见这句「继续」。这一条写进了 README 的限制里。

0.6.0 起，选择器里**每一行**都会发这条消息，包括「本轮结束（保留整轮）」。之前那行只分叉不发消息，结果就是上面那个空 turn。

## 选择器的内容

| 范围 | 列出什么 |
| --- | --- |
| 本轮 | 按按钮那个 turn 的每一步，另加一行「本轮结束（保留整轮）」 |
| 整个会话 | 边界之前的每一轮的每一步，按轮分组，最新的轮在前 |

- 筛选框匹配文字、工具名或 `#序号`。
- 超过 300 行只显示前 300 行，提示你缩小范围。
- 工具调用失败的那一行标 `✗ bash 失败（exit-1）`，原因取自工具结果自己的 `isError` 和错误码；没有错误码就取输出的第一行。还在跑的工具不标记。
- 分叉或发送失败时，错误显示在弹窗**里面**，弹窗不关，可以重试。

## 已知的坑

- **子会话可能继承父会话的折叠状态。** 某些会话重新 prefill 时会撞上和父会话一样的 400：`thinking or redacted_thinking blocks in the latest assistant message cannot be modified`。这是折叠（billion-context）改写了带 thinking 块的消息导致的，不是分叉本身。临时绕法：以 `BILI_RESUME_INHERITANCE=0` 启动 DSH。
- **只有装载过的轮才有行。** 选择器读的是 Chat 快照，界面没加载的轮不会出现。想看很旧的轮，先在界面里往回翻。
- **Client 插件只在页面加载时读取。** 改完插件必须刷新窗口（⌘R），否则跑的还是旧的那份。
- **profile 里存的是拷贝。** `~/.dsh/profiles/desktop/node_modules/@local/dsh-rewind/` 是安装时复制过去的。改源码后要重装：先 `remove_bundle`，再 `install_bundle file:/Users/byronwayne/Projects/sides/dsh-plugins/rewind-plugin`（直接装已存在的包会返回 `already-installed`）。
- **重跑不撤销副作用。** 这一步的工具写过的文件还在，起的后台任务还在跑。

## 版本

| 版本 | 变化 |
| --- | --- |
| 0.3.0 | 轮末加「从某一步重新执行」入口，边界 = 节点自己的 seq（错的） |
| 0.4.0 | 边界改成「步起点减 1」，这一步整步重新采样 |
| 0.5.0 | 加「整个会话」范围和筛选框 |
| 0.5.1 | 分叉后自动发「继续」 |
| 0.5.2 | 失败的工具调用在行上标出来 |
| 0.6.0 | 每一行都发「继续」；分叉失败的错误显示在弹窗内 |

## 怎么验证

```sh
cd rewind-plugin
node --check client.js
node --test          # 24 项
```

测试在 vm 里加载 `client.js`，用假的 `window.__ModuleLoader__`、假的 `document` 和假上下文，断言：

- 分叉边界落在步起点之前（工具调用与 assistant 消息两条都断言）；
- 同一步的两个工具合并成一行；
- 分叉后依次调用 `fork`、`openSession`、`using`、`send('继续')`；
- 失败的工具调用被标出，且一行只标一次；
- 弹窗在收到 error 时把原因画在内部。

真实窗口里的点击没有自动化测试，只能手动看。
