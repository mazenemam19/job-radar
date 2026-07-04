#!/usr/bin/env ts-node
// scripts/cron-log.ts
//
// Cross-platform replacement for the old cron:log script:
//   "mkdir -p logs && pnpm cron 2>&1 | tee logs/cron-$(date +%Y%m%d-%H%M%S).log"
// That was bash-only syntax. pnpm/npm run scripts through cmd.exe on Windows
// regardless of which shell you typed the command in, so `$(date ...)` never
// expanded and `tee` silently failed to write a file (see issue #52 handover,
// 2026-07-04). This runs the same way on Windows, macOS, and Linux.
//
// Run with:
//   pnpm run cron:log

import { spawn } from "child_process";
import { createWriteStream, mkdirSync } from "fs";
import path from "path";

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const logsDir = path.resolve(process.cwd(), "logs");
mkdirSync(logsDir, { recursive: true });

const logPath = path.join(logsDir, `cron-${timestamp()}.log`);
const logFile = createWriteStream(logPath);

// shell: true resolves to pnpm.cmd on Windows and pnpm on POSIX — no extra
// dependency (e.g. cross-spawn) needed for that alone.
const child = spawn("pnpm", ["cron"], { shell: true });

// end: false on both — otherwise the first stream to finish auto-closes
// logFile (default pipe() behavior) before the other has written its data.
child.stdout.pipe(process.stdout);
child.stdout.pipe(logFile, { end: false });
child.stderr.pipe(process.stderr);
child.stderr.pipe(logFile, { end: false });

child.on("error", (err) => {
  console.error("[cron:log] Failed to start `pnpm cron`:", err);
  process.exit(1);
});

// 'close' (not 'exit') — 'exit' can fire before the stdio pipes have
// finished flowing their data to logFile.
child.on("close", (code) => {
  console.log(`\n[cron:log] Wrote ${logPath}`);
  logFile.end(() => process.exit(code ?? 1));
});
