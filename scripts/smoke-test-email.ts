#!/usr/bin/env ts-node
// scripts/smoke-test-email.ts
//
// One-shot SMTP smoke test. Sends a plain diagnostic email so you can confirm
// the current SMTP credentials + nodemailer version are working before
// swapping to a dedicated sending address (Tier 2b).
//
// Run with:
//   pnpm run smoke-test-email you@example.com
//
// Or with env vars inline:
//   SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=... \
//     pnpm run smoke-test-email you@example.com
//
// Exit codes:
//   0 — email accepted by the SMTP server (check your inbox)
//   1 — missing env vars, bad args, or SMTP error (details printed to stderr)

import nodemailer from "nodemailer";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const NM_VERSION: string = (require("nodemailer/package.json") as { version: string }).version;

async function main() {
  // ── Args ───────────────────────────────────────────────────

  const recipient = process.argv[2];

  if (!recipient || !recipient.includes("@")) {
    console.error("Usage: pnpm run smoke-test-email <recipient@example.com>");
    process.exit(1);
  }

  // ── Env check ──────────────────────────────────────────────

  const missing = (["SMTP_HOST", "SMTP_USER", "SMTP_PASS"] as const).filter((k) => !process.env[k]);

  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  const host = process.env.SMTP_HOST!;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER!;
  const pass = process.env.SMTP_PASS!;
  const secure = port === 465;

  // ── Send ───────────────────────────────────────────────────

  console.log(`\nSMTP smoke test`);
  console.log(`  nodemailer : ${NM_VERSION}`);
  console.log(`  host       : ${host}:${port} (secure=${secure})`);
  console.log(`  from       : ${user}`);
  console.log(`  to         : ${recipient}\n`);

  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

  try {
    // Verify the connection before attempting a send — surfaces auth/TLS
    // errors with a cleaner message than a failed sendMail call would.
    await transporter.verify();
    console.log("✓ SMTP connection verified");

    const info = await transporter.sendMail({
      from: `"Job Radar smoke test" <${user}>`,
      to: recipient,
      subject: `Job Radar — SMTP smoke test (nodemailer ${NM_VERSION})`,
      text: [
        "This is an automated smoke test sent by scripts/smoke-test-email.ts.",
        "",
        `  Host    : ${host}:${port}`,
        `  From    : ${user}`,
        `  Sent at : ${new Date().toISOString()}`,
        "",
        "If you received this, the SMTP path is working correctly.",
        "Safe to proceed with Tier 2b (dedicated sending address swap).",
      ].join("\n"),
    });

    console.log(`✓ Email accepted by server`);
    console.log(`  messageId : ${info.messageId}`);
    if (info.response) console.log(`  response  : ${info.response}`);
    console.log("\nCheck your inbox. If it arrived, you're good for Tier 2b.\n");
  } catch (err) {
    console.error("\n✗ SMTP error:");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
