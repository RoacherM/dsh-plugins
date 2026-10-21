var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};

// src/host/store.js
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";
var VERSION = 6;
var SAVE_SOON_MS = 5e3;
function createStore({ dir }) {
  const state = { version: VERSION, lastScanAt: 0, files: {}, sessions: {} };
  let loaded = false;
  let queue = Promise.resolve();
  async function load() {
    if (loaded) return;
    loaded = true;
    try {
      const parsed = JSON.parse(await readFile(join(dir, "index.json"), "utf8"));
      if (parsed?.version === VERSION && parsed.sessions && parsed.files) {
        state.lastScanAt = parsed.lastScanAt ?? 0;
        state.files = parsed.files;
        state.sessions = parsed.sessions;
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  function file(path) {
    return state.files[path];
  }
  function setFile(path, record) {
    state.files[path] = record;
  }
  function session(key) {
    return state.sessions[key];
  }
  function setSession(record) {
    state.sessions[record.key] = record;
  }
  function removeSession(key) {
    delete state.sessions[key];
  }
  function lastScanAt() {
    return state.lastScanAt;
  }
  function finishScan(at = Date.now()) {
    state.lastScanAt = at;
  }
  function snapshot() {
    return state;
  }
  function save() {
    const run2 = queue.then(async () => {
      await mkdir(dir, { recursive: true });
      const temp = join(dir, `index.json.${process.pid}.${randomBytes(3).toString("hex")}.tmp`);
      await writeFile(temp, JSON.stringify(state));
      await rename(temp, join(dir, "index.json"));
    });
    queue = run2.catch(() => {
    });
    return run2;
  }
  let soon = null;
  function saveSoon(delay = SAVE_SOON_MS) {
    if (soon) return;
    soon = setTimeout(() => {
      soon = null;
      save().catch(() => {
      });
    }, delay);
    soon.unref?.();
  }
  return { load, file, setFile, session, setSession, removeSession, lastScanAt, finishScan, snapshot, save, saveSoon, dir };
}
function defaultDataDir() {
  return process.env.DSH_TRAJECABLE_DIR ?? join(homedir(), ".dsh", "plugin-data", "trajecable");
}

// src/host/scan.js
import { createReadStream as createReadStream2 } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename as basename6, dirname as dirname2, join as join3 } from "node:path";
import { homedir as homedir2 } from "node:os";

// src/host/adapters/dsh.js
var dsh_exports = {};
__export(dsh_exports, {
  agent: () => agent,
  create: () => create,
  feed: () => feed,
  keyOf: () => keyOf,
  readSession: () => readSession
});
import { readFile as readFile2 } from "node:fs/promises";
import { basename, dirname } from "node:path";

// src/host/util.js
var MAX_PROMPTS = 12;
var MAX_FILES = 60;
var MAX_COMMANDS = 24;
var MAX_TURNS = 200;
var NOISE_PREFIXES = [
  "<system-reminder",
  "<local-command",
  "<command-name",
  "<command-message",
  "<command-args",
  "<command-stdout",
  "<environment_context",
  "<recommended_plugins",
  "<permissions instructions",
  "<user_instructions",
  "<turn_aborted",
  "<synara_host_context",
  "Current runtime context",
  "The following workspace instructions may be relevant",
  "The following is the Codex agent history",
  "Caveat: The messages below",
  "The approval policy changed",
  "The user declined",
  "background job ",
  "Background subagent ",
  "The user approved",
  "The user switched this session to plan mode",
  "[model changed:",
  "[autoproject]",
  "Repeated tool call detected",
  "You are repeating the exact same tool call",
  "You ran the identical",
  "This is an automatically generated checkpoint",
  "Time sampled while preparing turn",
  "[Request interrupted",
  "This session is being continued from a previous conversation"
];
var NOISE_PATTERNS = [
  /^Agent (?:session-)?[0-9a-f][0-9a-f-]{7,} sent a message:/i,
  /^\[\d+\] tool exec call:/,
  /^\[\d+\] (?:assistant|user|system):/
];
var FILE_KEYS = ["file_path", "filePath", "path", "notebook_path", "target_file"];
var COMMAND_KEYS = ["command", "cmd"];
var DELEGATE_TOOLS = /^(subagent|subagent_fork|task|agent|delegate)$/i;
var TEST_COMMAND = /(?:^|[\s;&|])(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test\b|(?:^|[\s;&|])(?:npx\s+)?(?:vitest|jest|mocha|pytest|playwright|cypress)\b|\bnode\s+--test\b|\bgo\s+test\b|\bcargo\s+test\b|\bdeno\s+test\b/;
var PATCH_FILE = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm;
var PATCH_MOVE = /^\*\*\* Move to: (.+)$/gm;
var CMD_IN_CODE = /\b(?:cmd|command)\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|`([^`]*)`)/s;
function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  const text2 = value.trim();
  if (!text2.startsWith("{") && !text2.startsWith("[")) return value;
  try {
    return JSON.parse(text2);
  } catch {
    return value;
  }
}
function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (typeof part === "string") return part;
    if (part?.type === "text" || part?.type === "input_text" || part?.type === "output_text") return part.text ?? "";
    return "";
  }).filter(Boolean).join("\n");
}
function cleanText(text2) {
  return String(text2 ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function oneLine(text2, max = 120) {
  const line = cleanText(text2).replace(/\s+/g, " ");
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}\u2026` : line;
}
function isInjectedPrompt(text2) {
  const value = cleanText(text2);
  if (!value) return true;
  if (value.startsWith("# AGENTS.md")) return true;
  if (NOISE_PREFIXES.some((prefix) => value.startsWith(prefix))) return true;
  return NOISE_PATTERNS.some((pattern) => pattern.test(value));
}
function toTime(value, fallback = 0) {
  if (value === void 0 || value === null || value === "") return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return value < 1e12 ? value * 1e3 : value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function projectName(cwd) {
  if (!cwd) return "";
  const parts = String(cwd).split("/").filter(Boolean);
  const at = parts.findIndex((part) => part === "worktrees" || part === ".worktrees");
  if (at >= 0 && parts[at + 1]) return parts[at + 1];
  return parts[parts.length - 1] || "";
}
var SUMMARY_VERSION = 2;
function freshSummary(session) {
  const ai = session?.ai;
  if (!ai || ai.version !== SUMMARY_VERSION) return null;
  if (ai.key !== summaryCacheKey(session, ai.tz ?? "")) return null;
  if (ai.state === "done" && ai.completion && ai.completion.solved < ai.completion.total) {
    return { ...ai, state: "ongoing" };
  }
  return ai;
}
function summaryCacheKey(session, tz = "") {
  return `${session.end ?? 0}|${session.promptCount ?? 0}|${session.toolCount ?? 0}|${SUMMARY_VERSION}|${tz}`;
}
function newSession(agent7, key, id) {
  return {
    key,
    agent: agent7,
    id: id ?? key,
    title: "",
    cwd: "",
    project: "",
    branch: "",
    model: "",
    origin: "",
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
    ai: null
  };
}
function addPrompt(session, t, text2) {
  const value = cleanText(text2);
  if (!value || isInjectedPrompt(value)) return;
  const last = session.prompts[session.prompts.length - 1];
  if (last?.text === value) return;
  session.promptCount++;
  session.turns ??= [];
  session.turns.push({ n: session.promptCount, t, llm: 0, tools: 0, errors: 0, tokens: 0 });
  if (session.turns.length > MAX_TURNS) session.turns.shift();
  if (session.prompts.length < MAX_PROMPTS) {
    session.prompts.push({ t, text: value.slice(0, 600) });
  } else {
    session.prompts[session.prompts.length - 1] = { t, text: value.slice(0, 600) };
  }
  if (!session.start || t && t < session.start) session.start = t;
  if (t > session.end) session.end = t;
}
function noteFile(session, path) {
  const value = String(path ?? "").trim();
  if (!value || value.length > 500) return;
  if (session.files.includes(value)) return;
  session.fileCount++;
  if (session.files.length < MAX_FILES) session.files.push(value);
}
function patchFiles(text2) {
  const paths = [];
  for (const match of text2.matchAll(PATCH_FILE)) paths.push(match[1]);
  for (const match of text2.matchAll(PATCH_MOVE)) paths.push(match[1]);
  return paths;
}
function commandFromCode(text2) {
  const match = CMD_IN_CODE.exec(text2);
  if (!match) return "";
  const raw = match[1] ?? match[2] ?? match[3] ?? "";
  return raw.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}
function noteToolCall(session, t, name2, args, callId) {
  const tool = String(name2 || "tool");
  session.toolCount++;
  session.tools[tool] = (session.tools[tool] ?? 0) + 1;
  const turn = session.turns?.at(-1);
  if (turn) turn.tools++;
  const input = parseMaybeJson(args);
  if (input && typeof input === "object" && !Array.isArray(input)) {
    for (const key of FILE_KEYS) if (input[key]) noteFile(session, input[key]);
    for (const key of ["patch", "input", "content", "diff"]) {
      if (typeof input[key] === "string" && input[key].includes("*** ")) for (const path of patchFiles(input[key])) noteFile(session, path);
    }
    const command = COMMAND_KEYS.map((key) => input[key]).find((value) => typeof value === "string" && value.trim());
    if (command) noteCommand(session, t, tool, command, callId);
  } else if (typeof input === "string") {
    const command = commandFromCode(input);
    if (command) noteCommand(session, t, tool, command, callId);
    if (input.includes("*** ")) for (const path of patchFiles(input)) noteFile(session, path);
  }
  if (DELEGATE_TOOLS.test(tool)) session.delegates++;
  return callId;
}
var MAX_RECENT_STEPS = 24;
function noteLlmReply(session, t = 0, tokens = 0) {
  session.llmCount = (session.llmCount ?? 0) + 1;
  const turn = session.turns?.at(-1);
  if (turn) turn.llm++;
  if (!(tokens > 0)) return;
  session.tokens = (session.tokens ?? 0) + tokens;
  if (turn) turn.tokens = (turn.tokens ?? 0) + tokens;
  session.recent ??= [];
  session.recent.push({ t, tokens });
  if (session.recent.length > MAX_RECENT_STEPS) session.recent.shift();
}
function noteCommand(session, t, tool, command, callId) {
  const text2 = cleanText(command);
  if (!text2) return;
  const entry = { t, tool, text: oneLine(text2, 240), callId };
  session.commands.push(entry);
  if (session.commands.length > MAX_COMMANDS) session.commands.shift();
  if (TEST_COMMAND.test(text2)) session.testRuns++;
  if (/\bgit\s+commit\b/.test(text2)) session.commits++;
}
function noteToolResult(session, callId, failed) {
  if (!failed) return;
  session.errors++;
  const turn = session.turns?.at(-1);
  if (turn) turn.errors++;
  const command = callId ? [...session.commands].reverse().find((entry) => entry.callId === callId) : session.commands[session.commands.length - 1];
  if (command) {
    command.ok = false;
    if (TEST_COMMAND.test(command.text)) session.testFails++;
  }
}
function finalizeSession(session) {
  if (!session.start) session.start = session.end || Date.now();
  if (!session.end || session.end < session.start) session.end = session.start;
  session.project ||= projectName(session.cwd);
  if (!session.title) session.title = oneLine(session.prompts[0]?.text ?? "", 80) || session.project || session.agent;
  return session;
}

// src/host/zstd.js
import { zstdDecompressSync } from "node:zlib";
var MAGIC = [40, 181, 47, 253];
function decodeFrames(raw) {
  const starts = [];
  for (let i = 0; i <= raw.length - 4; i++) {
    if (raw[i] === MAGIC[0] && raw[i + 1] === MAGIC[1] && raw[i + 2] === MAGIC[2] && raw[i + 3] === MAGIC[3]) starts.push(i);
  }
  if (!starts.length) return "";
  const parts = [];
  let from = 0;
  for (let k = 1; k <= starts.length; k++) {
    const end = k < starts.length ? starts[k] : raw.length;
    try {
      parts.push(zstdDecompressSync(raw.subarray(starts[from], end)));
      from = k;
    } catch (error) {
      if (k === starts.length) {
        if (parts.length) break;
        throw error;
      }
    }
  }
  return Buffer.concat(parts).toString("utf8");
}
function parseLines(text2) {
  const records = [];
  for (const line of text2.split("\n")) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
    }
  }
  return records;
}

// src/host/adapters/dsh.js
var agent = "dsh";
function keyOf(file) {
  return `dsh:${basename(dirname(file))}`;
}
function create(file) {
  return newSession(agent, keyOf(file), basename(dirname(file)));
}
function feed(session, event) {
  const time = toTime(event.time);
  if (time) {
    if (!session.start) session.start = time;
    if (time > session.end) session.end = time;
  }
  const data = event.data ?? {};
  switch (event.type) {
    case "session": {
      session.cwd ||= event.cwd ?? data.cwd ?? "";
      session.origin ||= event.origin ?? data.origin ?? "";
      const createdAt = event.createdAt ?? data.createdAt;
      if (createdAt) {
        const created = toTime(createdAt);
        if (created) session.start = created;
      }
      break;
    }
    case "session/title": {
      if (data.title) session.title = String(data.title);
      break;
    }
    case "user/message": {
      addPrompt(session, time, contentText(data.content));
      break;
    }
    case "assistant/message": {
      session.model ||= data.message?.source?.model ?? "";
      noteLlmReply(session, time, Number(data.usage?.totalTokens) || 0);
      break;
    }
    case "tool/call": {
      noteToolCall(session, time, data.name, data.arguments, data.callId);
      break;
    }
    case "tool/result": {
      noteToolResult(session, data.toolCallId ?? data.message?.toolCallId, Boolean(data.error || data.message?.isError));
      break;
    }
  }
}
async function readSession(file) {
  const raw = await readFile2(file);
  const text2 = file.endsWith(".zstd") ? decodeFrames(raw) : raw.toString("utf8");
  const session = create(file);
  for (const event of parseLines(text2)) feed(session, event);
  finalizeSession(session);
  return session;
}

// src/host/adapters/claude.js
var claude_exports = {};
__export(claude_exports, {
  agent: () => agent2,
  create: () => create2,
  feed: () => feed2,
  finalize: () => finalize,
  keyOf: () => keyOf2
});
import { basename as basename2 } from "node:path";
var agent2 = "claude";
function keyOf2(file) {
  const rest = file.split("/.claude/projects/")[1] ?? basename2(file);
  return `claude:${rest.replace(/\.jsonl$/, "")}`;
}
function create2(file) {
  return newSession(agent2, keyOf2(file), basename2(file, ".jsonl"));
}
function feed2(session, record) {
  const time = toTime(record.timestamp);
  if (time && !session.end) session.end = time;
  if (time && time > session.end) session.end = time;
  if (record.cwd) session.cwd ||= record.cwd;
  if (record.gitBranch) session.branch = record.gitBranch;
  if (record.isSidechain) session.origin = "subagent";
  switch (record.type) {
    case "custom-title": {
      if (record.customTitle) session.title = String(record.customTitle);
      break;
    }
    case "ai-title": {
      if (record.aiTitle) session.title = String(record.aiTitle);
      break;
    }
    case "summary": {
      if (record.summary && !session.title) session.title = oneLine(record.summary, 80);
      break;
    }
    case "user": {
      if (record.isMeta) break;
      const content = record.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "tool_result" && block.is_error) noteToolResult(session, block.tool_use_id, true);
        }
      }
      if (Array.isArray(content) && content.some((block) => block?.type === "tool_result")) break;
      if (record.origin?.kind && record.origin.kind !== "human") break;
      const prompt = contentText(content);
      if (prompt) addPrompt(session, time, prompt);
      if (!session.start && time) session.start = time;
      break;
    }
    case "assistant": {
      session.model = record.message?.model ?? session.model;
      const content = record.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "tool_use") noteToolCall(session, time, block.name, block.input, block.id);
        }
      }
      break;
    }
    case "system": {
      if (record.subtype === "turn_duration" && record.durationMs) session.end = Math.max(session.end, time);
      break;
    }
  }
}
function finalize(session) {
  return finalizeSession(session);
}

// src/host/adapters/codex.js
var codex_exports = {};
__export(codex_exports, {
  agent: () => agent3,
  create: () => create3,
  feed: () => feed3,
  finalize: () => finalize2,
  keyOf: () => keyOf3
});
import { basename as basename3 } from "node:path";
var agent3 = "codex";
function keyOf3(file) {
  return `codex:${basename3(file, ".jsonl")}`;
}
function create3(file) {
  return newSession(agent3, keyOf3(file), basename3(file, ".jsonl"));
}
function outputFailed(output) {
  const text2 = Array.isArray(output) ? contentText(output) : String(output ?? "");
  if (!text2) return false;
  const exit = /"exit_code"\s*:\s*(-?\d+)/.exec(text2);
  if (exit && Number(exit[1]) !== 0) return true;
  if (/Script failed|Traceback \(most recent call last\)/.test(text2)) return true;
  try {
    const parsed = JSON.parse(text2);
    return Boolean(parsed && typeof parsed === "object" && (parsed.success === false || parsed.error));
  } catch {
    return false;
  }
}
function feed3(session, record) {
  const time = toTime(record.timestamp);
  if (time && time > session.end) session.end = time;
  const payload = record.payload ?? {};
  switch (record.type) {
    case "session_meta": {
      session.id = payload.id ?? session.id;
      session.cwd ||= payload.cwd ?? "";
      session.origin ||= payload.thread_source ?? "";
      if (payload.timestamp) session.start = toTime(payload.timestamp, session.start);
      break;
    }
    case "turn_context": {
      session.cwd ||= payload.cwd ?? "";
      session.model = payload.model ?? session.model;
      break;
    }
    case "event_msg": {
      if (payload.type === "user_message" && payload.message) addPrompt(session, time, payload.message);
      break;
    }
    case "response_item": {
      switch (payload.type) {
        case "message": {
          if (payload.role !== "user") break;
          const prompt = contentText(payload.content);
          if (prompt) addPrompt(session, time, prompt);
          break;
        }
        case "function_call":
        case "custom_tool_call": {
          noteToolCall(session, time, payload.name, payload.arguments ?? payload.input, payload.call_id);
          break;
        }
        case "function_call_output":
        case "custom_tool_call_output": {
          noteToolResult(session, payload.call_id, outputFailed(payload.output));
          break;
        }
      }
      break;
    }
  }
}
function finalize2(session) {
  return finalizeSession(session);
}

// src/host/adapters/pi.js
var pi_exports = {};
__export(pi_exports, {
  agent: () => agent4,
  create: () => create4,
  feed: () => feed4,
  finalize: () => finalize3,
  readSession: () => readSession2
});
import { readFile as readFile3 } from "node:fs/promises";
import { basename as basename4 } from "node:path";
var agent4 = "pi";
function create4(key, agentName = "pi") {
  const id = /_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/.exec(key)?.[1] ?? basename4(key, ".jsonl");
  return newSession(agentName, `${agentName}:${id}`, id);
}
function feed4(session, record) {
  const time = toTime(record.timestamp);
  if (record.type === "session") {
    session.cwd ||= record.cwd ?? "";
    session.start ||= time;
    if (record.id) {
      session.id = record.id;
      session.key = `${session.agent}:${record.id}`;
    }
    return;
  }
  if (record.type === "model_change") {
    session.model = record.modelId || session.model;
    return;
  }
  if (record.type !== "message") return;
  const message = record.message ?? {};
  const at = toTime(message.timestamp ?? record.timestamp, time);
  if (message.role === "user") {
    addPrompt(session, at, contentText(message.content));
    return;
  }
  if (message.role === "assistant") {
    if (message.model) session.model = message.model;
    if (message.stopReason === "error") session.errors++;
    for (const block of message.content ?? []) {
      if (block?.type === "toolCall") {
        noteToolCall(session, at, block.name, block.arguments, block.id);
      }
    }
    return;
  }
  if (message.role === "toolResult" && message.isError) {
    noteToolResult(session, message.toolCallId, true);
  }
}
function finalize3(session) {
  return finalizeSession(session);
}
async function readSession2(file, agentName = "pi") {
  const session = create4(file, agentName);
  for (const line of (await readFile3(file, "utf8")).split("\n")) {
    if (!line.trim()) continue;
    try {
      feed4(session, JSON.parse(line));
    } catch {
    }
  }
  return finalize3(session);
}

// src/host/adapters/epi.js
var epi_exports = {};
__export(epi_exports, {
  agent: () => agent5,
  create: () => create5,
  feed: () => feed5,
  finalize: () => finalize4,
  readSession: () => readSession3
});
var agent5 = "epi";
function create5(key) {
  return create4(key, "epi");
}
var feed5 = feed4;
var finalize4 = finalize3;
function readSession3(file) {
  return readSession2(file, "epi");
}

// src/host/adapters/grok.js
var grok_exports = {};
__export(grok_exports, {
  agent: () => agent6,
  readSession: () => readSession4
});
import { createReadStream } from "node:fs";
import { readFile as readFile4 } from "node:fs/promises";
import { basename as basename5, join as join2 } from "node:path";
var agent6 = "grok";
var FILE_KINDS = /* @__PURE__ */ new Set(["write", "edit"]);
var NO_FILE_KINDS = /* @__PURE__ */ new Set(["read", "list", "search", "web_fetch", "web_search"]);
async function readJsonl(file, onRecord) {
  let buffer = "";
  const stream = createReadStream(file, { encoding: "utf8" });
  for await (const chunk of stream) {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (line.trim()) onRecord(line);
    }
  }
  if (buffer.trim()) onRecord(buffer);
}
function promptFromChat(text2) {
  const raw = cleanText(text2);
  const match = /<user_query>([\s\S]*?)<\/user_query>/.exec(raw);
  return match ? match[1] : raw;
}
function toolInfo(update) {
  const meta = update._meta?.["x.ai/tool"] ?? {};
  return {
    name: meta.name || update.title || "tool",
    kind: meta.kind || ""
  };
}
async function readSession4(dir) {
  let summary = {};
  try {
    summary = JSON.parse(await readFile4(join2(dir, "summary.json"), "utf8"));
  } catch {
  }
  const id = summary.info?.id || basename5(dir);
  const session = newSession("grok", `grok:${id}`, id);
  session.cwd = summary.info?.cwd ?? "";
  session.branch = summary.head_branch ?? "";
  session.model = summary.current_model_id ?? "";
  session.title = oneLine(summary.generated_title || summary.session_summary || "", 100);
  session.start = toTime(summary.created_at);
  session.end = toTime(summary.updated_at);
  const seenPrompts = /* @__PURE__ */ new Set();
  const failedCalls = /* @__PURE__ */ new Set();
  const updates = join2(dir, "updates.jsonl");
  let readUpdates = false;
  try {
    await readJsonl(updates, (line) => {
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        return;
      }
      const update = record.params?.update;
      if (!update) return;
      readUpdates = true;
      const at = toTime(record.timestamp);
      if (at > session.end) session.end = at;
      if (update.sessionUpdate === "user_message_chunk") {
        const index = update._meta?.promptIndex;
        if (index !== void 0) {
          if (seenPrompts.has(index)) return;
          seenPrompts.add(index);
        }
        addPrompt(session, at, update.content?.text ?? "");
        return;
      }
      if (update.sessionUpdate === "tool_call") {
        const info = toolInfo(update);
        const args = !info.kind || FILE_KINDS.has(info.kind) || !NO_FILE_KINDS.has(info.kind) ? update.rawInput : {};
        noteToolCall(session, at, info.name, args, update.toolCallId);
        return;
      }
      if (update.sessionUpdate === "tool_call_update") {
        const exitCode = update.rawOutput?.exit_code;
        const failed = update.status === "failed" || typeof exitCode === "number" && exitCode !== 0;
        if (failed && update.toolCallId && !failedCalls.has(update.toolCallId)) {
          failedCalls.add(update.toolCallId);
          noteToolResult(session, update.toolCallId, true);
        }
      }
    });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (!readUpdates) {
    try {
      await readJsonl(join2(dir, "chat_history.jsonl"), (line) => {
        let record;
        try {
          record = JSON.parse(line);
        } catch {
          return;
        }
        if (record.type !== "user" || record.synthetic_reason) return;
        addPrompt(session, toTime(record.timestamp), promptFromChat(contentText(record.content)));
        if (!session.model && record.model_id) session.model = record.model_id;
      });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  if (!session.model) {
    try {
      await readJsonl(join2(dir, "chat_history.jsonl"), (line) => {
        if (session.model) return;
        try {
          const record = JSON.parse(line);
          if (record.type === "assistant" && record.model_id) session.model = record.model_id;
        } catch {
        }
      });
    } catch {
    }
  }
  if (!session.title) session.title = oneLine(session.prompts[0]?.text, 80) || session.project || "Grok";
  finalizeSession(session);
  return session;
}

// src/host/adapters/antigravity.js
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
var run = promisify(execFile);
var SQL = `SELECT conversation_id, title, preview, step_count,
  last_modified_time, last_user_input_time, workspace_uris
  FROM conversation_summaries ORDER BY last_modified_time`;
async function query(dbPath) {
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      return db.prepare(SQL).all();
    } finally {
      db.close();
    }
  } catch {
    try {
      const { stdout } = await run("sqlite3", ["-json", dbPath, SQL]);
      return stdout.trim() ? JSON.parse(stdout) : [];
    } catch {
      return [];
    }
  }
}
function sqliteTime(value) {
  if (!value) return 0;
  const parsed = Date.parse(String(value).trim().replace(" ", "T"));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
function workspacePath(uris) {
  let list = [];
  try {
    list = JSON.parse(uris || "[]");
  } catch {
  }
  for (const uri of Array.isArray(list) ? list : []) {
    try {
      const path = fileURLToPath(String(uri));
      if (path) return path;
    } catch {
    }
  }
  return "";
}
async function readSessions(dbPath, sourceTag) {
  const rows = await query(dbPath);
  return rows.map((row) => {
    const id = String(row.conversation_id);
    const start = sqliteTime(row.last_user_input_time);
    const end = sqliteTime(row.last_modified_time);
    if (!start && !end) return void 0;
    const session = newSession("antigravity", `antigravity:${sourceTag}:${id}`, id);
    const preview = oneLine(row.preview ?? "", 600);
    const injectedTitle = oneLine(row.title ?? "", 100);
    session.title = isInjectedPrompt(injectedTitle) ? isInjectedPrompt(preview) ? "" : preview : injectedTitle || preview;
    session.cwd = workspacePath(row.workspace_uris);
    session.project = projectName(session.cwd);
    session.start = start || end;
    session.end = end;
    session.promptCount = session.title ? 1 : 0;
    if (preview && !isInjectedPrompt(preview) && preview !== session.title) {
      session.prompts.push({ t: session.start, text: preview });
    }
    return finalizeSession(session);
  }).filter(Boolean);
}

// src/host/scan.js
var ADAPTERS = { dsh: dsh_exports, claude: claude_exports, codex: codex_exports, pi: pi_exports, epi: epi_exports, grok: grok_exports };
function defaultSources() {
  const home = homedir2();
  return {
    dsh: join3(home, ".dsh", "sessions"),
    claude: join3(process.env.CLAUDE_CONFIG_DIR ?? join3(home, ".claude"), "projects"),
    codex: join3(process.env.CODEX_HOME ?? join3(home, ".codex"), "sessions"),
    pi: process.env.PI_SESSION_DIR ?? join3(home, ".pi", "agent", "sessions"),
    epi: process.env.EPI_SESSION_DIR ?? join3(process.env.EPI_HOME ?? join3(home, ".epi"), "pi", "sessions"),
    grok: join3(home, ".grok", "sessions"),
    antigravity: [
      join3(home, ".gemini", "antigravity", "conversation_summaries.db"),
      join3(home, ".gemini", "antigravity-ide", "conversation_summaries.db"),
      join3(home, ".gemini", "antigravity-cli", "conversation_summaries.db")
    ]
  };
}
async function dirents(dir) {
  if (!dir) return [];
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}
async function fileInfo(agent7, file) {
  try {
    const info = await stat(file);
    return { agent: agent7, file, size: info.size, mtimeMs: info.mtimeMs };
  } catch {
    return void 0;
  }
}
async function dshLogs(root, onlySession) {
  const out = [];
  for (const workspace of await dirents(root)) {
    if (!workspace.isDirectory()) continue;
    for (const session of await dirents(join3(root, workspace.name))) {
      if (!session.isDirectory() || onlySession && session.name !== onlySession) continue;
      const dir = join3(root, workspace.name, session.name);
      const candidates = (await dirents(dir)).filter((entry) => entry.isFile() && /^session\.v(\d+)\.jsonl(\.zstd)?$/.test(entry.name)).map((entry) => ({ name: entry.name, version: Number(/^session\.v(\d+)/.exec(entry.name)[1]) })).sort((a, b) => b.version - a.version || (a.name.endsWith(".zstd") ? -1 : 1));
      if (candidates[0]) out.push(join3(dir, candidates[0].name));
    }
  }
  return out;
}
async function claudeLogs(root) {
  const out = [];
  for (const project of await dirents(root)) {
    if (!project.isDirectory()) continue;
    for (const entry of await dirents(join3(root, project.name))) {
      if (entry.isFile() && entry.name.endsWith(".jsonl")) out.push(join3(root, project.name, entry.name));
    }
  }
  return out;
}
async function piLogs(root) {
  const out = [];
  for (const project of await dirents(root)) {
    if (!project.isDirectory()) continue;
    for (const entry of await dirents(join3(root, project.name))) {
      if (entry.isFile() && entry.name.endsWith(".jsonl")) out.push(join3(root, project.name, entry.name));
    }
  }
  return out;
}
async function codexLogs(root) {
  const out = [];
  for (const year of await dirents(root)) {
    if (!year.isDirectory()) continue;
    for (const month of await dirents(join3(root, year.name))) {
      if (!month.isDirectory()) continue;
      for (const day of await dirents(join3(root, year.name, month.name))) {
        if (!day.isDirectory()) continue;
        for (const entry of await dirents(join3(root, year.name, month.name, day.name))) {
          if (entry.isFile() && entry.name.startsWith("rollout-") && entry.name.endsWith(".jsonl")) {
            out.push(join3(root, year.name, month.name, day.name, entry.name));
          }
        }
      }
    }
  }
  return out;
}
async function grokLogs(root) {
  const out = [];
  for (const cwdDir of await dirents(root)) {
    if (!cwdDir.isDirectory()) continue;
    for (const session of await dirents(join3(root, cwdDir.name))) {
      if (!session.isDirectory()) continue;
      const dir = join3(root, cwdDir.name, session.name);
      const summary = await stat(join3(dir, "summary.json")).catch(() => void 0);
      if (!summary) continue;
      const updates = await stat(join3(dir, "updates.jsonl")).catch(() => void 0);
      out.push({
        agent: "grok",
        file: dir,
        size: summary.size + (updates?.size ?? 0),
        mtimeMs: Math.max(summary.mtimeMs, updates?.mtimeMs ?? 0)
      });
    }
  }
  return out;
}
function antigravityTag(db) {
  const parent = basename6(dirname2(db));
  return parent.replace(/^antigravity-?/, "") || "ide";
}
async function antigravityLogs(paths) {
  const out = [];
  for (const file of paths ?? []) {
    try {
      const info = await stat(file);
      out.push({ agent: "antigravity", file, size: info.size, mtimeMs: info.mtimeMs, tag: antigravityTag(file) });
    } catch {
    }
  }
  return out;
}
async function discover(sources = defaultSources()) {
  const [dshFiles, claudeFiles, codexFiles, piFiles, epiFiles, grokFiles, antigravityFiles] = await Promise.all([
    dshLogs(sources.dsh),
    claudeLogs(sources.claude),
    codexLogs(sources.codex),
    piLogs(sources.pi),
    piLogs(sources.epi),
    grokLogs(sources.grok),
    antigravityLogs(sources.antigravity)
  ]);
  const files = [];
  for (const [agent7, list] of [
    ["dsh", dshFiles],
    ["claude", claudeFiles],
    ["codex", codexFiles],
    ["pi", piFiles],
    ["epi", epiFiles]
  ]) {
    for (const file of list) {
      const info = await fileInfo(agent7, file);
      if (info) files.push(info);
    }
  }
  files.push(...grokFiles, ...antigravityFiles);
  return files.sort((x, y) => y.mtimeMs - x.mtimeMs);
}
async function readRecords(file, start, end, onRecord) {
  if (end <= start) return start;
  const stream = createReadStream2(file, { start, end: end - 1 });
  let buffer = Buffer.alloc(0);
  let consumed = start;
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
    let newline;
    while ((newline = buffer.indexOf(10)) !== -1) {
      const line = buffer.subarray(0, newline).toString("utf8");
      consumed += newline + 1;
      buffer = buffer.subarray(newline + 1);
      if (line.trim()) onRecord(line);
    }
  }
  return consumed;
}
async function scanIncremental(file, adapter, store, log) {
  const key = String(file.file);
  const prev = store.file(key);
  let session = prev?.key ? store.session(prev.key) : void 0;
  let start = prev?.cursor ?? 0;
  if (!session || file.size < start) {
    session = adapter.create(key);
    start = 0;
  }
  let failedLines = 0;
  const consumed = await readRecords(key, start, file.size, (line) => {
    try {
      adapter.feed(session, JSON.parse(line));
    } catch {
      failedLines++;
    }
  });
  if (failedLines) log?.(`trajecable: ${failedLines} unreadable lines in ${basename6(key)}`);
  adapter.finalize(session);
  store.setSession(session);
  store.setFile(key, { agent: file.agent, size: file.size, mtimeMs: file.mtimeMs, cursor: consumed, key: session.key });
  return consumed !== prev?.cursor || !prev;
}
async function scanDsh(file, store, log) {
  const key = String(file.file);
  const prev = store.file(key);
  const current = prev && store.session(prev.key);
  const counted = current?.turns && typeof current.tokens === "number";
  if (prev && prev.size === file.size && prev.mtimeMs === file.mtimeMs && counted) return false;
  const session = await readSession(key);
  store.setSession(session);
  store.setFile(key, { agent: "dsh", size: file.size, mtimeMs: file.mtimeMs, cursor: file.size, key: session.key });
  return true;
}
async function scanGrok(file, store) {
  const key = String(file.file);
  const prev = store.file(key);
  if (prev && prev.size === file.size && prev.mtimeMs === file.mtimeMs) return false;
  const session = await readSession4(key);
  store.setSession(session);
  store.setFile(key, { agent: "grok", size: file.size, mtimeMs: file.mtimeMs, cursor: 0, key: session.key });
  return true;
}
async function scanAntigravity(file, store, log) {
  const key = String(file.file);
  const prev = store.file(key);
  const tag = file.tag ?? antigravityTag(key);
  const sessions = await readSessions(key, tag);
  const prefix = `antigravity:${tag}:`;
  for (const oldKey of Object.keys(store.snapshot().sessions)) {
    if (oldKey.startsWith(prefix)) store.removeSession(oldKey);
  }
  for (const session of sessions) store.setSession(session);
  store.setFile(key, { agent: "antigravity", size: file.size, mtimeMs: file.mtimeMs, cursor: 0, key: prefix });
  log?.(`trajecable: ${sessions.length} Antigravity conversations from ${basename6(dirname2(key))}`);
  return !prev || prev.size !== file.size || prev.mtimeMs !== file.mtimeMs;
}
async function scanDshSession({ store, root = defaultSources().dsh, id }) {
  if (!id || id.includes("/") || id.includes("\\") || id.startsWith(".")) return false;
  const [file] = await dshLogs(root, id);
  const info = file && await fileInfo("dsh", file);
  if (!info) return false;
  if (await scanDsh(info, store)) store.saveSoon();
  return true;
}
async function scanSources({ store, sources = defaultSources(), signal, onProgress, log } = {}) {
  await store.load();
  const files = await discover(sources);
  let done = 0;
  let read = 0;
  for (const file of files) {
    if (signal?.aborted) break;
    try {
      const changed = file.agent === "dsh" ? await scanDsh(file, store, log) : file.agent === "grok" ? await scanGrok(file, store) : file.agent === "antigravity" ? await scanAntigravity(file, store, log) : await scanIncremental(file, ADAPTERS[file.agent], store, log);
      if (changed) read++;
    } catch (error) {
      log?.(`trajecable: cannot read ${file.file}: ${error?.message ?? error}`);
    }
    done++;
    onProgress?.(done, files.length, file);
    if (done % 40 === 0) await store.save();
    await new Promise((resolve) => setImmediate(resolve));
  }
  store.finishScan();
  await store.save();
  return { files: files.length, changed: read, done };
}

// src/host/timeline.js
var DAY_FORMAT = /* @__PURE__ */ new Map();
function dayFormatter(tz) {
  if (!DAY_FORMAT.has(tz)) {
    DAY_FORMAT.set(tz, new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }));
  }
  return DAY_FORMAT.get(tz);
}
function safeTimeZone(tz) {
  if (!tz) return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(0);
    return tz;
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  }
}
function dayKey(ms, tz) {
  const parts = dayFormatter(tz).formatToParts(new Date(ms));
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
var emptyFacts = () => ({ prompts: 0, files: 0, tests: 0, testFails: 0, commits: 0, errors: 0, delegates: 0 });
function addFacts(into, session) {
  into.prompts += session.promptCount ?? 0;
  into.files += session.fileCount ?? 0;
  into.tests += session.testRuns ?? 0;
  into.testFails += session.testFails ?? 0;
  into.commits += session.commits ?? 0;
  into.errors += session.errors ?? 0;
  into.delegates += session.delegates ?? 0;
}
function compact(session) {
  const fresh = freshSummary(session);
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
    firstPrompt: oneLine(session.prompts?.[0]?.text ?? "", 260),
    ...fresh ? { ai: fresh } : {}
  };
}
function matches(session, { project, q }) {
  if (project && session.project !== project) return false;
  if (!q) return true;
  const needle = q.toLowerCase();
  const haystack = [
    session.title,
    session.project,
    session.cwd,
    ...(session.prompts ?? []).map((prompt) => prompt.text),
    ...session.files ?? [],
    ...(session.commands ?? []).map((command) => command.text),
    session.ai?.summary ?? "",
    ...(session.ai?.problems ?? []).map((item) => item.title),
    session.ai?.comment?.judgement ?? ""
  ].join("\n").toLowerCase();
  return haystack.includes(needle);
}
function isMeaningful(session) {
  return (session.promptCount ?? 0) > 0 || (session.toolCount ?? 0) > 0 || (session.fileCount ?? 0) > 0 || (session.commands?.length ?? 0) > 0;
}
function buildTimeline({ sessions, from = 0, to = Date.now(), tz, agent: agent7, project, q, indexed, scan }) {
  const zone = safeTimeZone(tz);
  const agents = agent7 ? new Set(String(agent7).split(",").filter(Boolean)) : void 0;
  const meaningful = sessions.filter(isMeaningful);
  const selected = meaningful.filter((session) => session.start <= to && (session.end || session.start) >= from).filter((session) => !agents || agents.has(session.agent)).filter((session) => matches(session, { project, q })).sort((a, b) => a.start - b.start);
  const days = /* @__PURE__ */ new Map();
  const totals = { sessions: 0, projects: 0, ...emptyFacts() };
  const totalAgents = {};
  const projectSet = /* @__PURE__ */ new Set();
  const daySet = /* @__PURE__ */ new Set();
  for (const session of selected) {
    const anchor = session.end || session.start;
    const date = dayKey(anchor, zone);
    daySet.add(date);
    projectSet.add(session.project || "");
    totalAgents[session.agent] = (totalAgents[session.agent] ?? 0) + 1;
    totals.sessions++;
    addFacts(totals, session);
    let day = days.get(date);
    if (!day) {
      day = { date, sessions: [], facts: emptyFacts(), agents: {}, projects: /* @__PURE__ */ new Map(), first: session.start, last: session.start };
      days.set(date, day);
    }
    day.sessions.push(session);
    day.first = Math.min(day.first, session.start);
    day.last = Math.max(day.last, anchor);
    day.agents[session.agent] = (day.agents[session.agent] ?? 0) + 1;
    addFacts(day.facts, session);
    const name2 = session.project || "";
    let group = day.projects.get(name2);
    if (!group) {
      group = { name: name2, cwd: session.cwd, sessions: [], last: session.start, facts: emptyFacts() };
      day.projects.set(name2, group);
    }
    group.sessions.push(session);
    group.last = Math.max(group.last, anchor);
    if (session.cwd) group.cwd = session.cwd;
    addFacts(group.facts, session);
  }
  const dayList = [...days.values()].sort((a, b) => a.date < b.date ? 1 : -1).map((day) => ({
    date: day.date,
    first: day.first,
    last: day.last,
    sessions: day.sessions.length,
    agents: day.agents,
    facts: day.facts,
    projects: [...day.projects.values()].sort((a, b) => b.last - a.last).map((group) => ({
      name: group.name,
      cwd: group.cwd,
      last: group.last,
      sessions: group.sessions.sort((a, b) => b.start - a.start).map(compact),
      facts: group.facts
    }))
  }));
  totals.days = daySet.size;
  totals.projects = projectSet.size;
  const projectIndex = /* @__PURE__ */ new Map();
  for (const session of meaningful) {
    const name2 = session.project || "";
    const entry = projectIndex.get(name2) ?? { name: name2, count: 0, last: 0, agents: /* @__PURE__ */ new Set() };
    entry.count++;
    entry.last = Math.max(entry.last, session.end || session.start);
    entry.agents.add(session.agent);
    projectIndex.set(name2, entry);
  }
  return {
    tz: zone,
    from,
    to,
    totals,
    agents: totalAgents,
    days: dayList,
    projects: [...projectIndex.values()].sort((a, b) => b.last - a.last).slice(0, 200).map((entry) => ({ name: entry.name, count: entry.count, last: entry.last, agents: [...entry.agents] })),
    indexed,
    scan
  };
}
function buildSessionDetail(session, tz) {
  if (!session) return void 0;
  return { ...session, ai: freshSummary(session) ?? void 0, day: dayKey(session.end || session.start, safeTimeZone(tz)) };
}

// src/host/routes.js
var json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
var toNumber = (value, fallback) => {
  if (value === null || value === void 0 || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
function registerRoutes(ctx, { store, ready, scan, maybeScan, summarizer, indexDshSession }) {
  const indexed = () => {
    const state = store.snapshot();
    return {
      sessions: Object.values(state.sessions).filter(isMeaningful).length,
      files: Object.keys(state.files).length
    };
  };
  const scanMeta = () => ({ ...scan.state(), lastScanAt: store.lastScanAt() });
  const timeline = (url) => {
    const q = url.searchParams;
    const range = q.get("range") ?? "7d";
    const to = toNumber(q.get("to"), Date.now());
    const from = range === "all" ? 0 : toNumber(q.get("from"), to - 7 * 864e5);
    const sessions = Object.values(store.snapshot().sessions);
    return buildTimeline({
      sessions,
      from,
      to,
      tz: q.get("tz") ?? void 0,
      agent: q.get("agent") || void 0,
      project: q.get("project") || void 0,
      q: q.get("q")?.trim() || void 0,
      indexed: indexed(),
      scan: scanMeta()
    });
  };
  async function handleTimeline(url) {
    await ready;
    maybeScan("page").catch(() => {
    });
    return timeline(url);
  }
  async function handleSession(url) {
    await ready;
    const key = url.searchParams.get("key");
    if (!key) return json({ error: "missing key" }, 400);
    if (key.startsWith("dsh:") && indexDshSession) await indexDshSession(key.slice(4));
    const session = buildSessionDetail(store.session(key), url.searchParams.get("tz") ?? void 0);
    return session ? json(session) : json({ error: "session not found" }, 404);
  }
  async function handleSummary(request) {
    await ready;
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid body" }, 400);
    }
    const key = body?.key;
    if (!key) return json({ error: "missing key" }, 400);
    const session = store.session(key);
    if (!session) return json({ error: "session not found" }, 404);
    try {
      const tz = typeof body?.tz === "string" ? body.tz : void 0;
      const result = await summarizer.run(session, { force: Boolean(body?.force), tz });
      return { key, ...result };
    } catch (error) {
      return json({ error: error?.message ?? String(error) }, 503);
    }
  }
  const routes = [
    ["POST", "/api/trajecable/summary", (request) => handleSummary(request)],
    ["GET", "/api/trajecable/timeline", (request, url) => handleTimeline(url)],
    ["GET", "/api/trajecable/session", (request, url) => handleSession(url)],
    ["GET", "/api/trajecable/status", async () => {
      await ready;
      return { scan: scanMeta(), indexed: indexed() };
    }],
    ["POST", "/api/trajecable/scan", async () => {
      await ready;
      scan.run().catch(() => {
      });
      return { started: true, scan: scanMeta() };
    }]
  ];
  for (const [method, path, fn] of routes) {
    ctx.effect(() => ctx.connection.fetch.register({
      path,
      methods: [method],
      requestBody: "buffered",
      fetch: async (request) => {
        try {
          const result = await fn(request, new URL(request.url));
          return result instanceof Response ? result : json(result);
        } catch (error) {
          return json({ error: error?.message ?? String(error) }, 500);
        }
      }
    }), "dsh-trajecable: " + path);
  }
}

// src/host/summarize.js
import { randomUUID } from "node:crypto";

// src/host/scoring.js
var SUMMARY_VERSION2 = 2;
var DIMENSIONS = ["decision", "execution", "risk", "verification", "focus"];
var DIMENSION_WEIGHT = { decision: 0.25, execution: 0.25, risk: 0.15, verification: 0.2, focus: 0.15 };
var DAY = /^\d{4}-\d{2}-\d{2}$/;
var DECISION_TYPES = /* @__PURE__ */ new Set(["tech", "scope", "risk", "detour"]);
var DECISION_BY = /* @__PURE__ */ new Set(["agent", "user"]);
var STATES = /* @__PURE__ */ new Set(["done", "ongoing", "blocked"]);
var TONES = /* @__PURE__ */ new Set(["good", "watch", "bad"]);
var PROBLEM_STATUS = /* @__PURE__ */ new Set(["solved", "partial", "open", "abandoned"]);
var clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
var text = (value, max) => oneLine(value ?? "", max);
function gradeFor(score) {
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 78) return "B+";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}
function localDay(ms, tz) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms));
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function closeTruncatedJson(input) {
  let inString = false;
  let escaped = false;
  const stack = [];
  for (const char of input) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{" || char === "[") stack.push(char);
    else if (char === "}" || char === "]") stack.pop();
  }
  let output = input;
  if (inString) output += '"';
  while (stack.length) output += stack.pop() === "{" ? "}" : "]";
  return output;
}
function parseObject(raw) {
  const source = String(raw ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = source.indexOf("{");
  if (start < 0) return void 0;
  const body = source.slice(start);
  const lastBrace = body.lastIndexOf("}");
  const candidates = [
    body,
    closeTruncatedJson(body),
    lastBrace > 0 ? closeTruncatedJson(body.slice(0, lastBrace + 1)) : ""
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === "object" && !Array.isArray(value)) return value;
    } catch {
    }
  }
  return void 0;
}
function normalizeProblems(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    title: text(item?.title ?? item?.problem ?? "", 110),
    status: PROBLEM_STATUS.has(item?.status) ? item.status : "open",
    evidence: text(item?.evidence ?? "", 180)
  })).filter((item) => item.title).slice(0, 8);
}
function normalizeDecisions(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    type: DECISION_TYPES.has(item?.type) ? item.type : "tech",
    by: DECISION_BY.has(item?.by) ? item.by : "agent",
    title: text(item?.title ?? "", 100),
    reason: text(item?.reason ?? item?.impact ?? "", 180)
  })).filter((item) => item.title).slice(0, 8);
}
function normalizeScores(value) {
  const scores = {};
  for (const key of DIMENSIONS) scores[key] = clamp(value?.[key] ?? 70);
  return scores;
}
function normalizeDays(value, session, tz, fallbackText) {
  const fallbackDate = localDay(session.end || session.start || Date.now(), tz);
  const rows = Array.isArray(value) ? value : [];
  const days = rows.map((item) => ({
    date: DAY.test(item?.date ?? "") ? item.date : "",
    did: text(item?.did ?? item?.work ?? "", 220),
    closed: Array.isArray(item?.closed) ? item.closed.map((entry) => text(entry, 100)).filter(Boolean).slice(0, 6) : [],
    evidence: text(item?.evidence ?? "", 220),
    weight: clamp(item?.weight ?? 1, 1, 10),
    scores: normalizeScores(item?.scores)
  })).filter((item) => item.date).slice(0, 40);
  if (!days.length) {
    days.push({
      date: fallbackDate,
      did: fallbackText,
      closed: [],
      evidence: "",
      weight: 1,
      scores: normalizeScores(void 0)
    });
  }
  return days;
}
function normalizeComment(value) {
  return {
    tone: TONES.has(value?.tone) ? value.tone : "watch",
    verdict: text(value?.verdict ?? "", 40),
    judgement: text(value?.judgement ?? value?.text ?? "", 260),
    advice: text(value?.advice ?? "", 220),
    risk: text(value?.risk ?? "", 220)
  };
}
function parseEvaluation(raw) {
  const value = parseObject(raw);
  if (!value) return void 0;
  const summary = text(value.summary ?? value.headline ?? "", 300);
  const state = STATES.has(value.state) ? value.state : "";
  const problems = normalizeProblems(value.problems);
  const days = Array.isArray(value.days) ? value.days : [];
  if (!summary && !problems.length && !days.length) return void 0;
  return {
    summary,
    state,
    problems,
    decisions: normalizeDecisions(value.decisions),
    days,
    comment: normalizeComment(value.comment)
  };
}
function weighted(rows, pick) {
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + pick(row) * row.weight, 0) / total;
}
function buildAi(evaluation, session, tz) {
  const days = normalizeDays(evaluation.days, session, tz, evaluation.summary);
  for (const day of days) {
    day.score = DIMENSIONS.reduce((sum, key) => sum + day.scores[key] * DIMENSION_WEIGHT[key], 0);
    day.score = clamp(day.score);
  }
  const dimensions = {};
  for (const key of DIMENSIONS) dimensions[key] = clamp(weighted(days, (day) => day.scores[key]));
  const base = clamp(weighted(days, (day) => day.score));
  const problems = evaluation.problems ?? [];
  const solved = problems.filter((item) => item.status === "solved").length;
  const partial = problems.filter((item) => item.status === "partial").length;
  const abandoned = problems.filter((item) => item.status === "abandoned").length;
  const totalProblems = problems.length;
  const declared = evaluation.state || (totalProblems && solved === totalProblems ? "done" : "ongoing");
  const state = declared === "done" && solved < totalProblems ? "ongoing" : declared;
  const notes = [];
  let score = base;
  let cap = 100;
  if (!totalProblems) {
    cap = 60;
    notes.push("\u6CA1\u6709\u660E\u786E\u6536\u53E3 \xB7 \u5C01\u9876 60");
  } else if (!solved) {
    cap = 60;
    notes.push("0 \u4E2A\u95EE\u9898\u6536\u53E3 \xB7 \u5C01\u9876 60");
  } else if (solved < totalProblems) {
    score -= 8;
    cap = 84;
    notes.push(`\u672A\u6536\u53E3 \u22128 \xB7 \u5C01\u9876 84`);
  } else if (totalProblems >= 2) {
    score += 2;
    notes.push("\u591A\u95EE\u9898\u6536\u53E3 +2");
  }
  if (state === "blocked") {
    cap = Math.min(cap, 50);
    notes.push("\u53D7\u963B \xB7 \u5C01\u9876 50");
  }
  if (state === "ongoing") notes.push("\u4E34\u65F6\u5206");
  score = clamp(Math.min(score, cap));
  return {
    version: SUMMARY_VERSION2,
    tz,
    summary: evaluation.summary || "",
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
      scores: day.scores
    })),
    problems,
    decisions: evaluation.decisions ?? [],
    completion: {
      total: totalProblems,
      solved,
      partial,
      open: totalProblems - solved - partial - abandoned,
      abandoned,
      rate: totalProblems ? Math.round(solved / totalProblems * 100) : 0
    },
    comment: evaluation.comment,
    state,
    scoreNote: notes.join(" \xB7 ")
  };
}

// src/host/transcript.js
import { createReadStream as createReadStream3 } from "node:fs";
import { readFile as readFile5 } from "node:fs/promises";
import { join as join4 } from "node:path";
var MAX_HEAD = 16e3;
var MAX_TAIL = 8e3;
var MAX_MESSAGE = 1200;
var MAX_TOOL = 320;
async function readDigest(session, source, tz = "UTC") {
  const digest = createDigest(tz);
  if (!source) {
    digest.fallback(session);
    return digest.text();
  }
  try {
    if (session.agent === "dsh") await readDsh(source, digest);
    else if (session.agent === "claude") await readClaude(source, digest);
    else if (session.agent === "codex") await readCodex(source, digest);
    else if (session.agent === "pi" || session.agent === "epi") await readPi(source, digest);
    else if (session.agent === "grok") await readGrok(source, digest);
  } catch {
    digest.fallback(session);
  }
  if (!digest.hasConversation()) digest.fallback(session);
  else digest.facts(session);
  return digest.text();
}
function createDigest(tz) {
  const stampFormat = new Intl.DateTimeFormat("en-CA", { timeZone: tz, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const stamp = (at) => {
    if (!at) return "";
    try {
      const parts = stampFormat.formatToParts(new Date(at));
      const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
      return `${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
    } catch {
      return "";
    }
  };
  let head = "";
  let tail = "";
  let truncated = false;
  let conversation = false;
  function line(prefix, value, max = MAX_MESSAGE, at = 0) {
    const text2 = cleanText(value);
    if (!text2) return;
    const time = stamp(at);
    const entry = `${time ? `[${time}] ` : ""}${prefix}: ${oneLine(text2, max)}
`;
    head += entry;
    if (head.length > MAX_HEAD) {
      truncated = true;
      head = head.slice(0, MAX_HEAD);
    }
    tail = (tail + entry).slice(-MAX_TAIL);
    if (prefix === "USER" || prefix === "ASSISTANT") conversation = true;
  }
  return {
    user: (value, at = 0) => {
      const text2 = cleanText(value);
      if (!text2 || isInjectedPrompt(text2)) return;
      line("USER", text2, MAX_MESSAGE, at);
    },
    assistant: (value, at = 0) => line("ASSISTANT", value, MAX_MESSAGE, at),
    tool: (name2, args, at = 0) => {
      const label = oneLine(name2 || "tool", 60);
      let input = args;
      if (input && typeof input === "object") input = JSON.stringify(input);
      line("TOOL", `${label} ${oneLine(input, MAX_TOOL)}`.trim(), MAX_TOOL, at);
    },
    error: (value, at = 0) => line("ERROR", value, 500, at),
    title: (value, at = 0) => line("TITLE", value, 120, at),
    note: (value, at = 0) => line("NOTE", value, 300, at),
    hasConversation: () => conversation,
    facts(session) {
      if (session.files?.length) line("FILES", session.files.slice(0, 30).join(", "), 1600);
      const commands = (session.commands ?? []).slice(0, 12).map((command) => `${command.tool}: ${command.text}`);
      if (commands.length) line("COMMANDS", commands.join(" | "), 1600);
      if (session.prompts?.length) {
        for (const prompt of session.prompts.slice(0, 6)) line("USER", prompt.text);
      }
    },
    fallback(session) {
      if (session.title) line("TITLE", session.title, 120, session.start);
      for (const prompt of session.prompts ?? []) line("USER", prompt.text, MAX_MESSAGE, prompt.t);
      this.facts(session);
    },
    text() {
      if (!head) return "";
      return truncated ? `${head}
\u2026
${tail}` : head;
    }
  };
}
function blockText(content) {
  if (!Array.isArray(content)) return contentText(content);
  return content.filter((block) => block && typeof block === "object" && ["text", "input_text", "output_text"].includes(block.type)).map((block) => block.text ?? "").join("\n");
}
async function readDsh(file, digest) {
  const raw = await readFile5(file);
  const text2 = file.endsWith(".zstd") ? decodeFrames(raw) : raw.toString("utf8");
  for (const event of parseLines(text2)) {
    const data = event.data ?? {};
    const at = toTime(event.time ?? event.timestamp ?? data.time);
    if (event.type === "user/message") digest.user(contentText(data.content), at);
    else if (event.type === "assistant/message") {
      for (const block of data.message?.content ?? []) {
        if (block?.type === "text") digest.assistant(block.text, at);
        else if (block?.type === "tool-call") digest.tool(block.name, block.arguments, at);
      }
    } else if (event.type === "tool/call") digest.tool(data.name, data.arguments, at);
    else if (event.type === "tool/result" && (data.error || data.message?.isError)) {
      digest.error(data.error ?? contentText(data.message?.content) ?? "tool failed", at);
    }
  }
}
async function eachJsonLine(file, onValue) {
  const stream = createReadStream3(file, { encoding: "utf8" });
  let buffer = "";
  for await (const chunk of stream) {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      try {
        onValue(JSON.parse(line));
      } catch {
      }
    }
  }
  if (buffer.trim()) {
    try {
      onValue(JSON.parse(buffer));
    } catch {
    }
  }
}
async function readClaude(file, digest) {
  await eachJsonLine(file, (record) => {
    if (record.isMeta) return;
    const content = record.message?.content;
    const at = toTime(record.timestamp);
    if (record.type === "user") {
      if (typeof content === "string") digest.user(content, at);
      else if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "text") digest.user(block.text, at);
          else if (block?.type === "tool_result" && block.is_error) digest.error(blockText(block.content), at);
        }
      }
    } else if (record.type === "assistant" && Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === "text") digest.assistant(block.text, at);
        else if (block?.type === "tool_use") digest.tool(block.name, block.input, at);
      }
    }
  });
}
async function readCodex(file, digest) {
  await eachJsonLine(file, (record) => {
    const payload = record.payload ?? {};
    const at = toTime(record.timestamp);
    if (record.type === "response_item") {
      if (payload.type === "message") {
        const text2 = blockText(payload.content);
        if (payload.role === "user") digest.user(text2, at);
        else if (payload.role === "assistant") digest.assistant(text2, at);
      } else if (payload.type === "function_call" || payload.type === "custom_tool_call") {
        digest.tool(payload.name, payload.arguments ?? payload.input, at);
      } else if (payload.type === "function_call_output" || payload.type === "custom_tool_call_output") {
        const output = payload.output;
        const text2 = typeof output === "string" ? output : JSON.stringify(output ?? "");
        if (/\"exit_code\"\s*:\s*[1-9]/.test(text2) || /Traceback|Script failed/i.test(text2)) digest.error(text2, at);
      }
    } else if (record.type === "event_msg" && payload.type === "user_message") {
      digest.user(payload.message, at);
    }
  });
}
async function readPi(file, digest) {
  await eachJsonLine(file, (record) => {
    if (record.type !== "message") return;
    const message = record.message ?? {};
    const role = message.role;
    const at = toTime(record.timestamp ?? message.timestamp);
    if (role === "user") digest.user(blockText(message.content), at);
    else if (role === "assistant") {
      const content = message.content;
      if (typeof content === "string") digest.assistant(content, at);
      else if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "text") digest.assistant(block.text, at);
          else if (block?.type === "toolCall") digest.tool(block.name, block.input, at);
        }
      }
    } else if (role === "toolResult" && message.isError) digest.error(blockText(message.content), at);
  });
}
async function readGrok(dir, digest) {
  let summary = {};
  try {
    summary = JSON.parse(await readFile5(join4(dir, "summary.json"), "utf8"));
  } catch {
  }
  if (summary.generated_title) digest.title(summary.generated_title, toTime(summary.created_at));
  let found = false;
  const chat = join4(dir, "chat_history.jsonl");
  await eachJsonLine(chat, (record) => {
    const content = record.content;
    const at = toTime(record.timestamp);
    if (record.type === "user") {
      const value = Array.isArray(content) ? contentText(content) : content;
      const query2 = /<user_query>([\s\S]*?)<\/user_query>/.exec(String(value ?? ""));
      digest.user(query2?.[1] ?? value, at);
      found = true;
    } else if (record.type === "assistant") {
      digest.assistant(typeof content === "string" ? content : contentText(content), at);
      found = true;
    }
  }).catch(() => {
  });
  const updates = join4(dir, "updates.jsonl");
  await eachJsonLine(updates, (record) => {
    const update = record.params?.update ?? {};
    if (update.sessionUpdate === "tool_call") {
      const tool = update._meta?.["x.ai/tool"] ?? {};
      const kind = tool.kind ?? update.kind ?? "";
      const args = kind === "write" || kind === "edit" ? update.rawInput : update.rawInput;
      digest.tool(tool.name ?? kind ?? update.title, args, toTime(record.timestamp));
      found = true;
    } else if (update.sessionUpdate === "tool_call_update") {
      const code = update.rawOutput?.exit_code;
      if (update.status === "failed" || typeof code === "number" && code !== 0) {
        digest.error(update.rawOutput?.output ?? update.title ?? "tool failed", toTime(record.timestamp));
      }
    } else if (!found && update.sessionUpdate === "user_message_chunk") {
      digest.user(update.content?.text, toTime(record.timestamp));
    } else if (!found && update.sessionUpdate === "agent_message_chunk") {
      digest.assistant(update.content?.text, toTime(record.timestamp));
    }
  }).catch(() => {
  });
}

// src/host/summarize.js
var PROMPT_SYSTEM = `You review one coding-agent session for a work log. Return one JSON object and nothing else:
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
- Do not invent files, results or problems. Do not mention prompt or tool counts. Return JSON only, no markdown.`;
var PROMPT_TAIL = `Write in the main language of the user's messages. Do not invent work that is not in the transcript.`;
function findSource(store, key) {
  for (const [path, record] of Object.entries(store.snapshot().files)) {
    if (record.key === key) return path;
    if (record.agent === "antigravity" && key.startsWith(record.key)) return path;
  }
  return "";
}
async function buildSummaryInput(session, source, tz = "UTC") {
  const digest = await readDigest(session, source, tz);
  const parts = [
    `Agent: ${session.agent}`,
    `Title: ${oneLine(session.title || "untitled", 160)}`,
    `Project: ${session.project || "(none)"}`,
    `Time zone: ${tz}`,
    `Started: ${session.start ? new Date(session.start).toISOString() : "unknown"}`,
    `Ended: ${session.end ? new Date(session.end).toISOString() : "unknown"}`,
    "",
    "Conversation and work:",
    digest || "(only metadata is available)",
    "",
    PROMPT_TAIL
  ];
  return parts.join("\n");
}
var DEFAULT_SUMMARY_PROVIDER = "deepseek-official";
var DEFAULT_SUMMARY_MODEL = "deepseek-flash";
function createSummarizer({ ctx, store, config = {}, log }) {
  const inFlight = /* @__PURE__ */ new Map();
  const route = {
    provider: config.summaryProvider ?? DEFAULT_SUMMARY_PROVIDER,
    model: config.summaryModel ?? DEFAULT_SUMMARY_MODEL
  };
  const maxTokens = config.summaryMaxTokens ?? 2e3;
  const timeoutMs = config.summaryTimeoutMs ?? 9e4;
  async function callModel(input) {
    const llm = ctx.get("llm");
    if (!llm) throw new Error("no model service is available");
    const signal = AbortSignal.timeout(timeoutMs);
    const call = await llm.prepareCall({ provider: route.provider, model: route.model, maxTokens }, signal);
    const messages = [{
      id: randomUUID(),
      role: "user",
      content: [{ type: "text", text: input }],
      source: { kind: "dsh-trajecable-summary" }
    }];
    const options = { ...call.config, messages, system: PROMPT_SYSTEM, purpose: "trajecable-summary", signal };
    let output = "";
    let finish;
    for await (const chunk of call.stream(options)) {
      if (chunk.type === "text-delta") output += chunk.text;
      else if (chunk.type === "block-end" && chunk.block?.type === "text" && !output) output += chunk.block.text;
      else if (chunk.type === "finish") finish = chunk.reason;
    }
    if (finish?.kind === "error" || finish?.kind === "aborted") {
      const error = new Error(finish.failure?.message ?? "summary request failed");
      error.code = finish.failure?.code;
      throw error;
    }
    return { text: output, provider: route.provider, model: route.model };
  }
  async function run2(session, { force = false, tz = "UTC" } = {}) {
    if (!force) {
      const fresh = freshSummary(session);
      if (fresh && fresh.tz === tz) return { ai: fresh, cached: true };
    }
    if (inFlight.has(session.key)) return inFlight.get(session.key);
    const task = (async () => {
      const source = findSource(store, session.key);
      const input = await buildSummaryInput(session, source, tz);
      const result = await callModel(input);
      const evaluation = parseEvaluation(result.text);
      if (!evaluation) throw new Error("the model returned an invalid review");
      const ai = buildAi(evaluation, session, tz);
      ai.key = summaryCacheKey(session, tz);
      ai.at = Date.now();
      ai.model = `${result.provider}/${result.model}`;
      session.ai = ai;
      await store.save();
      return { ai, cached: false };
    })().finally(() => inFlight.delete(session.key));
    inFlight.set(session.key, task);
    return task;
  }
  return { run: run2, fresh: freshSummary, source: (session) => findSource(store, session.key) };
}

// src/host/index.js
var name = "dsh-trajecable";
var inject = ["connection"];
function apply(ctx, config = {}) {
  const log = (message) => ctx.logger?.warn?.(message);
  const store = createStore({ dir: config.dataDir ?? defaultDataDir() });
  const ready = store.load().catch((error) => {
    log(`trajecable: cannot load index, rebuilding: ${error?.message ?? error}`);
  });
  const sources = { ...defaultSources() };
  if (config.dshDir) sources.dsh = config.dshDir;
  if (config.claudeDir) sources.claude = config.claudeDir;
  if (config.codexDir) sources.codex = config.codexDir;
  if (config.piDir) sources.pi = config.piDir;
  if (config.epiDir) sources.epi = config.epiDir;
  if (config.grokDir) sources.grok = config.grokDir;
  if (config.antigravityDir) sources.antigravity = [config.antigravityDir];
  if (Array.isArray(config.antigravityDirs)) sources.antigravity = config.antigravityDirs;
  const pageInterval = (config.pageScanIntervalMinutes ?? 2) * 6e4;
  const dailyInterval = (config.scanIntervalHours ?? 24) * 36e5;
  const controller = new AbortController();
  const state = {
    scanning: false,
    startedAt: 0,
    endedAt: 0,
    error: null,
    progress: { done: 0, total: 0 }
  };
  const scan = {
    state: () => ({
      scanning: state.scanning,
      startedAt: state.startedAt,
      endedAt: state.endedAt,
      error: state.error,
      progress: { ...state.progress }
    }),
    async run(reason = "manual") {
      if (state.scanning) return false;
      state.scanning = true;
      state.startedAt = Date.now();
      state.endedAt = 0;
      state.error = null;
      state.progress = { done: 0, total: 0 };
      try {
        const result = await scanSources({
          store,
          sources,
          signal: controller.signal,
          log,
          onProgress: (done, total) => {
            state.progress = { done, total };
          }
        });
        state.endedAt = Date.now();
        log(`trajecable: ${reason} scan read ${result.changed}/${result.files} files`);
        return true;
      } catch (error) {
        state.endedAt = Date.now();
        state.error = error?.message ?? String(error);
        log(`trajecable: scan failed: ${state.error}`);
        return false;
      } finally {
        state.scanning = false;
      }
    }
  };
  async function maybeScan(reason) {
    const age = Date.now() - store.lastScanAt();
    const interval = reason === "daily" ? dailyInterval : reason === "startup" ? 36e5 : pageInterval;
    if (age < interval) return;
    await scan.run(reason);
  }
  const summarizer = createSummarizer({ ctx, store, config, log });
  const indexDshSession = (id) => scanDshSession({ store, root: sources.dsh, id });
  registerRoutes(ctx, { store, ready, scan, maybeScan, summarizer, indexDshSession });
  ready.then(() => {
    maybeScan("startup").catch(() => {
    });
  }).catch((error) => log(`trajecable: cannot load index: ${error?.message ?? error}`));
  const tick = () => {
    maybeScan("daily").catch(() => {
    });
  };
  const timer = setInterval(tick, 60 * 6e4);
  timer.unref?.();
  ctx.effect(() => () => {
    clearInterval(timer);
    controller.abort();
  }, "dsh-trajecable: timers");
}
export {
  apply,
  inject,
  name
};
