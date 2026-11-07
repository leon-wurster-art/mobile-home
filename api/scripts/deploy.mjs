#!/usr/bin/env node
/* Spielt Website + API zu Cloudflare aus.
   Die Versionskennung (Git-Commit) wird an CSS/JS gehängt, damit Browser sofort die neue Fassung laden.
   Aufruf:  npm run deploy   (im Ordner api/) */
import { execSync, spawnSync } from "node:child_process";

let version = "dev";
try {
  version = execSync("git rev-parse --short=8 HEAD").toString().trim();
  // nicht committete Änderungen → eigene Kennung, damit Browser trotzdem neu laden
  if (execSync("git status --porcelain").toString().trim()) version += "-" + Date.now().toString(36);
} catch { /* ohne Git: "dev" */ }

console.log(`Version: ${version}`);
const win = process.platform === "win32";
const r = spawnSync("npx", ["wrangler", "deploy", "--var", `VERSION:${version}`], { stdio: "inherit", shell: win });
process.exit(r.status ?? 1);
