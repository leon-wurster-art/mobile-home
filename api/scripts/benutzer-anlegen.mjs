#!/usr/bin/env node
/* Legt einen Zugang für die Verwaltungsseite an oder setzt dessen Passwort neu.
   Gespeichert wird nur ein PBKDF2-Hash – das Passwort selbst landet nirgends.

   Aufruf:  npm run benutzer:local  -- <name>     (lokale Test-Datenbank)
            npm run benutzer:remote -- <name>     (echte Datenbank bei Cloudflare)
   Das Passwort wird danach verdeckt abgefragt – direkt aus Keeper einfügen.
   (Übergabe per stdin nur für automatische Tests; Passwörter nie mit echo, in Skripten oder Dateien ablegen.)
   Passwort bitte im Passwortmanager (Keeper) erzeugen und dort ablegen. */

import { pbkdf2Sync, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import readline from "node:readline";

const args = process.argv.slice(2);
const ziel = args.includes("--remote") ? "--remote" : "--local";
const name = args.find(a => !a.startsWith("--"));
if (!name || !/^[A-Za-z0-9._-]{2,40}$/.test(name)) {
  console.error("Bitte Namen angeben (2–40 Zeichen, nur Buchstaben, Ziffern, . _ -):\n  npm run benutzer:local -- anna");
  process.exit(1);
}

function frage(text) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.startsWith(text)) process.stdout.write(text); };   // Eingabe nicht anzeigen
    rl.question(text, a => { rl.close(); process.stdout.write("\n"); resolve(a); });
  });
}
async function lesePasswort() {
  if (!process.stdin.isTTY) {
    let s = ""; for await (const c of process.stdin) s += c;
    return s.replace(/\r?\n$/, "");
  }
  const a = await frage("Passwort: ");
  const b = await frage("Passwort wiederholen: ");
  if (a !== b) { console.error("Die Passwörter stimmen nicht überein."); process.exit(1); }
  return a;
}

const passwort = await lesePasswort();
if (passwort.length < 12) { console.error("Das Passwort muss mindestens 12 Zeichen haben."); process.exit(1); }

const ITER = 100000;   // muss zur API passen (Obergrenze der Workers-Laufzeit)
const salt = randomBytes(16);
const hash = pbkdf2Sync(passwort, salt, ITER, 32, "sha256");
const pwHash = `pbkdf2$${ITER}$${salt.toString("base64")}$${hash.toString("base64")}`;

const dir = mkdtempSync(join(tmpdir(), "mh-"));
const datei = join(dir, "benutzer.sql");
writeFileSync(datei,
  `INSERT INTO benutzer (name, pw_hash, erstellt_am) VALUES ('${name}', '${pwHash}', '${new Date().toISOString()}')
   ON CONFLICT(name) DO UPDATE SET pw_hash = excluded.pw_hash;\n`);
try {
  const win = process.platform === "win32";   // unter Windows braucht npx eine Shell → Pfad quoten
  const r = spawnSync("npx", ["wrangler", "d1", "execute", "mobile-home", ziel, "--file", win ? `"${datei}"` : datei],
    { stdio: ["ignore", "inherit", "inherit"], shell: win });
  if (r.status !== 0) process.exit(r.status || 1);
  console.log(`\nZugang "${name}" gespeichert (${ziel === "--remote" ? "Cloudflare" : "lokal"}).`);
} finally {
  unlinkSync(datei);
}
