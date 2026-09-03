#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

const require = createRequire(import.meta.url);
const eveBin = join(dirname(require.resolve("eve/package.json")), "bin", "eve.js");

const evePort = process.env.EVE_PORT ?? "2010";
const children = [];
let shuttingDown = false;
const MEMORY_CHOICES = [
  { key: "1", label: "middleware", mode: "middleware", blurb: "createNams().wrap() — memory the model can't see" },
  { key: "2", label: "provider", mode: "provider", blurb: "createNamsProvider() — same, one level up" },
  { key: "3", label: "tools", mode: "tools", blurb: "createNamsMemoryTools() — the model calls query_memory / store_memory itself" },
  { key: "4", label: "hooks", mode: "hooks", blurb: "eve hooks + dynamic instructions — the runtime remembers, the model has no say" },
];

// Pick memory on/off (and which mode) for this run instead of hand-editing
// .env. The choice is exported as MEMORY_MODE to both child processes below;
process.env.MEMORY_MODE = await chooseMemoryMode();
announceMemory(process.env.MEMORY_MODE);

console.log(`\n  Starting the agent on port ${evePort}…`);

const agent = spawn(process.execPath, [eveBin, "dev", "--no-ui", "--port", evePort], {
  stdio: ["ignore", "pipe", "pipe"],
});
children.push(agent);

let origin;
try {
  origin = await waitForServerUrl(agent);
} catch (error) {

  console.error(`\n  \x1b[31mThe agent didn't start.\x1b[0m ${error.message}\n`);
  console.error("  Things to try:");
  console.error("    • npm run check          — are your keys set?");
  console.error("    • npx eve dev            — run the agent on its own to see the real error");
  console.error(`    • EVE_PORT=2020 npm run dev  — in case port ${evePort} is taken`);
  console.error("    • close other apps       — this needs roughly 2 GB of free memory\n");
  shutdown(1);
}

console.log(`  Agent ready at ${origin}\n`);

const web = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev"], {
  stdio: "inherit",
  env: { ...process.env, EVE_BASE_URL: origin },
});
children.push(web);

web.on("exit", (code) => shutdown(code ?? 0));
agent.on("exit", (code) => shutdown(code ?? 1));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}

function waitForServerUrl(child) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let buffer = "";

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`The agent didn't start within 3 minutes. Its output is above.`));
      }
    }, 180_000);

    const onChunk = (chunk) => {
      const text = chunk.toString("utf8");
      buffer += text;
      process.stdout.write(prefix(text));

      const match = /listening at\s+(https?:\/\/[^\s/]+)/i.exec(buffer);
      if (match && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve(match[1]);
      }
    };

    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);

    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`The agent exited with code ${code} before it was ready. See its output above.`));
    });
  });
}

function prefix(text) {
  return text
    .split("\n")
    .map((line) => (line.trim() ? `  \x1b[2m[agent]\x1b[0m ${line}` : line))
    .join("\n");
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(code);
}

async function chooseMemoryMode() {
  const fromEnv = (process.env.MEMORY_MODE ?? readEnvVar(".env", "MEMORY_MODE") ?? "off")
    .trim()
    .toLowerCase();
  const current = ["off", "provider", "middleware", "tools", "hooks"].includes(fromEnv)
    ? fromEnv
    : "off";

  // No prompt without a terminal (CI, piped input) — honour .env as-is.
  if (!stdin.isTTY) return current;

  const currentChoice = MEMORY_CHOICES.find((c) => c.mode === current) ?? MEMORY_CHOICES[0];
  const rl = createInterface({ input: stdin, output: stdout });
  // If stdin ends mid-prompt (Ctrl+D, piped input), keep whatever .env had.
  const ask = (q) => rl.question(q).then((s) => s.trim().toLowerCase(), () => null);

  try {
    const onByDefault = current !== "off";
    const answer = await ask(`\n  Memory on? ${onByDefault ? "[Y/n]" : "[y/N]"} `);
    if (answer === null) return current;
    const on = answer === "" ? onByDefault : answer.startsWith("y");
    if (!on) return "off";

    console.log("\n  Which mode?");
    for (const c of MEMORY_CHOICES) {
      const here = c === currentChoice ? "  ← current" : "";
      console.log(`    ${c.key}) ${c.label.padEnd(10)} ${c.blurb}${here}`);
    }
    const pick = await ask(`\n  Pick 1-4 or a name [${currentChoice.label}] `);
    if (pick === null || pick === "") return currentChoice.mode;

    const chosen = MEMORY_CHOICES.find((c) => c.key === pick || c.label === pick || c.mode === pick);
    if (chosen) return chosen.mode;

    console.log(`  "${pick}" isn't one of them — using ${currentChoice.label}.`);
    return currentChoice.mode;
  } finally {
    rl.close();
    stdin.pause();
  }
}

function announceMemory(mode) {
  if (mode === "off") {
    console.log("\n  Memory: off — the agent starts fresh every chat.");
    return;
  }
  const label = MEMORY_CHOICES.find((c) => c.mode === mode)?.label ?? mode;
  console.log(`\n  Memory: on · ${label}  (MEMORY_MODE=${mode})`);
  if (!process.env.MEMORY_API_KEY && !readEnvVar(".env", "MEMORY_API_KEY")) {
    console.log("  \x1b[33m⚠ MEMORY_API_KEY isn't set — run `npm run check` before you chat.\x1b[0m");
  }
}

function readEnvVar(file, key) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.replace(/\r$/, "").match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (match && match[1] === key) return match[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env yet — fall through to the caller's default
  }
  return undefined;
}
