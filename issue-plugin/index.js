/**
 * Host half of dsh-issue: one POST route that writes an issue bundle to disk.
 *
 * The browser half sends what only the page can see (console ring, layout
 * landmarks, DOM). This half adds what only the Host can see (versions, git
 * state, a real screen capture) and writes everything into one folder.
 */
import { execFile } from 'node:child_process';
import { appendFile, copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { arch, homedir, platform, release } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import { dirName, formatConsole, redact, renderReport } from './report.js';

export const name = 'dsh-issue';
export const inject = ['connection'];

const exec = promisify(execFile);
const CONSOLE_LIMIT = 500;
const SESSION_LOG_LIMIT = 32 * 1024 * 1024;

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const sizeOf = async (file) => {
  try {
    return (await stat(file)).size;
  } catch {
    return 0;
  }
};

/** `<app>.asar/dsh <profile> <runtime>`: the profile is the argument ending in `/profiles/<name>`. */
const profileFromArgv = (argv) => argv.find((arg) => /[\\/]profiles[\\/][^\\/]+$/.test(arg));

async function installedPlugins(profile) {
  if (profile === undefined) return [];
  try {
    return (await readdir(join(profile, 'node_modules', '@local'))).sort();
  } catch {
    return [];
  }
}

async function gitFacts(cwd) {
  if (typeof cwd !== 'string' || cwd === '') return {};
  const run = async (args) => (await exec('git', ['-C', cwd, ...args], { timeout: 5000 })).stdout.trim();
  try {
    const branch = await run(['rev-parse', '--abbrev-ref', 'HEAD']);
    const head = await run(['rev-parse', '--short', 'HEAD']);
    const dirty = await run(['status', '--porcelain']);
    return { branch, head, changed: dirty === '' ? 0 : dirty.split('\n').length };
  } catch {
    return {};
  }
}

/** Full-screen capture. Returns undefined when this platform has no capture tool. */
async function captureScreen(file) {
  if (platform() !== 'darwin') return undefined;
  await exec('screencapture', ['-x', '-t', 'png', file], { timeout: 15000 });
  const bytes = await sizeOf(file);
  if (bytes === 0) throw new Error('screencapture wrote no image (screen recording permission?)');
  return { file, bytes };
}

/**
 * Copy the session log next to the report. The log is the full event stream:
 * every message, tool call and result. It may still be appended to.
 */
async function copySessionLog(sessionId, sessionsRoot, dir, warnings) {
  if (typeof sessionId !== 'string' || sessionId === '') return undefined;
  let workspaces = [];
  try {
    workspaces = await readdir(sessionsRoot);
  } catch {
    return undefined;
  }
  for (const workspace of workspaces) {
    const sessionDir = join(sessionsRoot, workspace, sessionId);
    let names = [];
    try {
      names = await readdir(sessionDir);
    } catch {
      continue;
    }
    const file = names.find((name) => /^session\.v\d+\.jsonl(\.zstd)?$/.test(name));
    if (file === undefined) continue;
    const source = join(sessionDir, file);
    const bytes = await sizeOf(source);
    if (bytes > SESSION_LOG_LIMIT) {
      warnings.push(`session log is ${Math.round(bytes / 1024 / 1024)} MiB, not copied`);
      return undefined;
    }
    const target = join(dir, file.endsWith('.zstd') ? 'session-log.jsonl.zstd' : 'session-log.jsonl');
    await copyFile(source, target);
    return { name: target.slice(dir.length + 1), bytes };
  }
  return undefined;
}

async function writeIndex(root, at, title, name) {
  const path = join(root, 'index.md');
  try {
    await stat(path);
  } catch {
    await writeFile(path, '# Issues\n\nOne folder per report, newest last. Open `report.md` first.\n\n');
  }
  const line = `- ${at.toISOString()} · ${redact(title) || '(no description)'} · \`${name}\`\n`;
  await appendFile(path, line);
}

/**
 * Build one bundle. Every step that can fail is recorded in `warnings`, so a
 * missing screenshot never loses the report.
 */
/** A free folder name for this second: `dir`, `dir-2`, `dir-3`, … */
async function freeDir(root, base) {
  for (let index = 1; index < 10; index++) {
    const name = index === 1 ? base : `${base}-${index}`;
    try {
      await stat(join(root, name));
    } catch {
      return name;
    }
  }
  return `${base}-${Date.now()}`;
}

async function saveIssue({ root, sessionsRoot, payload }) {
  const at = new Date();
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  await mkdir(root, { recursive: true });
  const name = await freeDir(root, dirName(at, title));
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });

  const warnings = [];

  // The screenshot is the only fact that decays, so it is captured first.
  let screenshot;
  if (payload.options?.screenshot !== false) {
    try {
      screenshot = await captureScreen(join(dir, 'screenshot.png'));
      if (screenshot === undefined) warnings.push(`no screen capture on ${platform()}`);
    } catch (error) {
      warnings.push(`screen capture failed: ${error.message}`);
    }
  }

  const consoleLog = Array.isArray(payload.console) ? payload.console.slice(-CONSOLE_LIMIT) : [];
  const consoleText = consoleLog.map(formatConsole).join('\n');
  const consoleBytes = consoleText === '' ? 0 : Buffer.byteLength(consoleText + '\n');
  await writeFile(join(dir, 'console.txt'), consoleBytes === 0 ? '' : consoleText + '\n');

  let domBytes;
  const dom = typeof payload.dom === 'string' ? payload.dom : '';
  if (dom !== '') {
    const gzipped = gzipSync(Buffer.from(dom, 'utf8'));
    await writeFile(join(dir, 'dom.html.gz'), gzipped);
    domBytes = gzipped.length;
  } else {
    warnings.push('page snapshot not included');
  }

  let sessionLog;
  try {
    sessionLog = await copySessionLog(payload.session?.id, sessionsRoot, dir, warnings);
  } catch (error) {
    warnings.push(`session log not copied: ${error.message}`);
  }

  const client = {
    page: payload.page,
    release: payload.release,
    window: payload.window,
    session: payload.session,
    view: payload.view,
    landmarks: payload.landmarks,
    transcript: payload.transcript,
    console: consoleLog,
  };
  const host = {
    platform: platform(),
    release: release(),
    arch: arch(),
    node: process.versions.node,
    profile: profileFromArgv(process.argv),
    plugins: await installedPlugins(profileFromArgv(process.argv)),
    git: await gitFacts(payload.session?.cwd),
    screenshot: screenshot === undefined ? undefined : { bytes: screenshot.bytes },
  };

  // `report.md` is listed before it is drawn: its own size cannot be known.
  const files = [
    'report.md',
    'report.json',
    ...(screenshot === undefined ? [] : ['screenshot.png']),
    'console.txt',
    ...(domBytes === undefined ? [] : ['dom.html.gz']),
    ...(sessionLog === undefined ? [] : [sessionLog.name]),
  ];
  const reportJson = JSON.stringify({
    name, at: at.toISOString(), title: redact(title), client, host, files, warnings,
  }, null, 2);
  await writeFile(join(dir, 'report.json'), reportJson);

  const listed = [
    { name: 'report.md', about: 'this summary' },
    { name: 'report.json', bytes: Buffer.byteLength(reportJson), about: 'the same facts as data, without the DOM' },
    ...(screenshot === undefined ? [] : [{ name: 'screenshot.png', bytes: screenshot.bytes, about: 'whole screen at capture time' }]),
    { name: 'console.txt', bytes: consoleBytes, about: 'browser console ring (warnings and errors)' },
    ...(domBytes === undefined ? [] : [{ name: 'dom.html.gz', bytes: domBytes, about: 'gzipped live document, gunzip to read' }]),
    ...(sessionLog === undefined ? [] : [{ name: sessionLog.name, bytes: sessionLog.bytes, about: 'session event log, copied while the session may still be running' }]),
  ];
  const report = renderReport({ name, at, note: title, client, host, files: listed, warnings });
  await writeFile(join(dir, 'report.md'), report);

  await writeIndex(root, at, title, name);
  return { name, dir, files, warnings };
}

export function apply(ctx, config = {}) {
  const root = config.dir ?? process.env.DSH_ISSUE_DIR ?? join(homedir(), '.dsh', 'issues');
  const sessionsRoot = config.sessionsDir ?? join(homedir(), '.dsh', 'sessions');
  const logger = ctx.logger?.('dsh-issue');

  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/issue/report',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        const result = await saveIssue({ root, sessionsRoot, payload: await request.json() });
        logger?.info?.(`dsh-issue: wrote ${result.dir}`);
        return json(result);
      } catch (error) {
        logger?.warn?.(`dsh-issue: report failed: ${error?.message ?? error}`);
        return json({ error: String(error?.message ?? error) }, 500);
      }
    },
  }), 'dsh-issue: /api/issue/report');
}
