#!/usr/bin/env node
/* =========================================================
   tools/textures/textures.mjs
   The game's pictures as PNG files (textures/), made and checked by the
   game itself, run in a headless Chrome or Edge.

     node tools/textures/textures.mjs check
         Boots the game and makes sure every file in textures/index.json
         loads. Run it after editing or moving pictures.

     node tools/textures/textures.mjs check --legacy
         The same, and boots the game as it was before textures/ (from
         git) beside it, comparing every picture pixel by pixel: flat
         and in menus at 1x, 2x and 3x, hearts, boss faces, cursors and
         stickers. It only passes for pictures you haven't repainted, so
         it's for proving a conversion, not for everyday edits.

     node tools/textures/textures.mjs export [set] [--force]
         Writes a set of pictures into textures/ from the old game (from
         git) and adds them to textures/index.json, keeping every other
         entry. Sets: icons (the letter-array pictures: items, foes,
         hearts...), rooms (the picture rooms: their backgrounds, lights,
         flames and marks). This is how textures/ was made; it won't
         overwrite a file that's there unless you add --force, and then
         repainted ones are lost too.

   Options:
     --legacy-ref <commit>   which commit is "the old game" (default: the
                             newest one that still has the letter arrays)
     --browser <path>        Chrome or Edge to use (or set SNAKE_BROWSER)
     --show                  don't start a browser: print the address, open
                             it yourself and watch

   It serves the folder on a free local port, the old game (unpacked from
   git into a temp folder) under /legacy/, and adds its page script to
   index.html as it serves it. Nothing in the game loads anything from here.
   ========================================================= */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEXTURES = path.join(ROOT, "textures");
const args = process.argv.slice(2);
const cmd = args[0];
const flag = name => args.includes(name);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

if (!["export", "check"].includes(cmd)) {
  console.log("usage: node tools/textures/textures.mjs export [icons|rooms|shops|keepers|home|coins|frames|map|emblems|stops|tree|npc|story|board] [--force] | check [--legacy]   (see the top of this file)");
  process.exit(2);
}

/* ----- The old game, from git ----- */
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 }).trim();
function legacyRef() {
  const given = opt("--legacy-ref");
  if (given) return git("rev-parse", given);
  const file = "src/engine/render/pixel-icons.js";
  const has = c => { try { return git("show", `${c}:${file}`).includes("const SPRITES = {"); } catch { return false; } };
  if (has("HEAD")) return git("rev-parse", "HEAD");
  // the commit that took the arrays out: its parent is the last one with them
  for (const c of git("rev-list", "HEAD", "--", file).split("\n").filter(Boolean)) if (!has(c) && has(c + "^")) return git("rev-parse", c + "^");
  throw new Error("no commit has the old letter-array pictures (src/engine/render/pixel-icons.js with SPRITES)");
}
function unpackLegacy(ref) {
  const dir = path.join(os.tmpdir(), "snake-legacy-" + ref.slice(0, 12));
  if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  fs.mkdirSync(dir, { recursive: true });
  const tar = path.join(dir, "..", `snake-legacy-${ref.slice(0, 12)}.tar`);
  execFileSync("git", ["archive", "--format=tar", "-o", tar, ref], { cwd: ROOT });
  execFileSync("tar", ["-xf", path.basename(tar), "-C", path.basename(dir)], { cwd: path.dirname(tar) });
  fs.rmSync(tar, { force: true });
  return dir;
}

/* ----- A browser to run it in ----- */
function findBrowser() {
  const given = opt("--browser") || process.env.SNAKE_BROWSER;
  if (given) return given;
  const pf = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = pf.flatMap(p => [path.join(p, "Google/Chrome/Application/chrome.exe"), path.join(p, "Microsoft/Edge/Application/msedge.exe")])
    .concat(["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge"]);
  return candidates.find(p => fs.existsSync(p)) || null;
}

/* ----- The server ----- */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav" };
function serve(legacyDir, pageScripts, onResult) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "POST") {
      let body = "";
      req.on("data", d => { body += d; });
      req.on("end", () => {
        res.end("ok");
        let data = {};
        try { data = JSON.parse(body); } catch { /* not ours */ }
        if (url.pathname === "/__tool/log") console.log("  " + data.msg);
        else if (url.pathname === "/__tool/result") onResult(data);
      });
      return;
    }
    let rel = decodeURIComponent(url.pathname);
    let base = ROOT;
    if (rel.startsWith("/legacy/")) { base = legacyDir; rel = rel.slice("/legacy".length); }
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.normalize(path.join(base, rel));
    if (!base || !file.startsWith(path.normalize(base))) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { "Cache-Control": "no-store" }); res.end(); return; }
      if (path.basename(file) === "index.html" && url.searchParams.has("tool")) {
        const tags = pageScripts.map(s => `<script src="${s}"></script>`).join("");
        buf = Buffer.from(buf.toString("utf8").replace("</body>", tags + "</body>"));
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(buf);
    });
  });
}

/* ----- Run the page, wait for its answer ----- */
async function run(legacyDir, pagePath, pageScripts, timeoutSec = 300) {
  let done;
  const result = new Promise(r => { done = r; });
  const server = serve(legacyDir, pageScripts, done);
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const address = `http://localhost:${server.address().port}${pagePath}`;
  let browser = null, profile = null;
  if (flag("--show")) console.log(`Open ${address} in Chrome or Edge and leave it open until this finishes.`);
  else {
    const exe = findBrowser();
    if (!exe) throw new Error("no Chrome or Edge found: pass --browser <path>, or --show and open the address yourself");
    profile = fs.mkdtempSync(path.join(os.tmpdir(), "snake-textures-browser-"));
    browser = spawn(exe, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--mute-audio",
      "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
      "--window-size=1280,800", `--user-data-dir=${profile}`, address], { stdio: "ignore" });
    console.log(`  started ${path.basename(exe)} (headless) on ${address}`);
  }
  const timer = new Promise(r => setTimeout(() => r({ ok: false, error: `no answer from the page after ${timeoutSec} seconds` }), timeoutSec * 1000));
  const answer = await Promise.race([result, timer]);
  if (browser) browser.kill();
  server.closeAllConnections();
  server.close();
  if (profile) {
    // the browser lets go of its profile folder a moment after it's stopped
    await new Promise(r => setTimeout(r, 1500));
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* still held: it's in the temp folder anyway */ }
  }
  return answer;
}

/* ----- export ----- */
const SETS = ["icons", "rooms", "shops", "keepers", "home", "coins", "frames", "map", "emblems", "stops", "tree", "npc", "story", "board"];
const fileOf = v => (typeof v === "string" ? v : v.file);
/* index.json, one entry a line, grouped by folder */
function writeIndex(textures) {
  const ids = Object.keys(textures).sort((a, b) => { const fa = fileOf(textures[a]), fb = fileOf(textures[b]); return fa < fb ? -1 : fa > fb ? 1 : a < b ? -1 : 1; });
  const line = v => (typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v, null, 1).replace(/\s*\n\s*/g, " ").replace(/\[ /g, "[").replace(/ \]/g, "]"));
  const about = [
    "Which picture file each thing in the game uses: \"id\": \"path under textures/\".",
    "Move or rename a file, then change its line here. See textures/README.md.",
    "An entry can also be an object: { \"file\": ..., \"keep\": [colors menus don't light], \"ink\": [colors that count as outline], \"menu\": a file shown in menus instead, \"badge\": a corner mark, \"light\": false, \"frames\": frames side by side in a sprite sheet, \"keys\": { \"#ff00ff\": \"name\" } colors the game swaps }."
  ];
  const text = "{\n  \"_about\": [\n" + about.map(a => "    " + JSON.stringify(a)).join(",\n") + "\n  ],\n  \"textures\": {\n" +
    ids.map(id => `    ${JSON.stringify(id)}: ${line(textures[id])}`).join(",\n") + "\n  }\n}\n";
  fs.writeFileSync(path.join(TEXTURES, "index.json"), text);
  return ids.length;
}
async function exportTextures() {
  const set = SETS.includes(args[1]) ? args[1] : "icons";
  const indexPath = path.join(TEXTURES, "index.json");
  const existing = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")).textures || {} : {};
  if (set === "icons" && Object.keys(existing).length && !flag("--force")) {
    console.log("textures/ already has the icons. Exporting them again overwrites every one, repainted ones too: add --force if you mean it.");
    process.exit(1);
  }
  const ref = legacyRef();
  console.log(`Exporting the ${set} of ${ref.slice(0, 7)} (${git("log", "-1", "--format=%s", ref)})`);
  const legacyDir = unpackLegacy(ref);
  const answer = await run(legacyDir, `/legacy/index.html?tool=export&set=${set}`, ["/tools/textures/legacy-ref.js", "/tools/textures/legacy-scenes.js", "/tools/textures/export-page.js"]);
  if (!answer.ok) { console.error("Export failed:\n" + answer.error); process.exit(1); }
  const there = Object.keys(answer.files).filter(rel => fs.existsSync(path.join(TEXTURES, rel)));
  if (set !== "icons" && there.length && !flag("--force")) {
    console.log(`${there.length} of these files are already in textures/ (${there.slice(0, 3).join(", ")}...). Add --force to overwrite them, repainted ones too.`);
    process.exit(1);
  }
  for (const [rel, url] of Object.entries(answer.files)) {
    const out = path.join(TEXTURES, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
  }
  // the icons replace the whole index; any other set is added to it
  const n = writeIndex(set === "icons" ? Object.assign({}, Object.fromEntries(Object.entries(existing).filter(([, v]) => /^scenes\//.test(fileOf(v)))), answer.index) : Object.assign({}, existing, answer.index));
  console.log(`textures/: wrote ${Object.keys(answer.files).length} files; index.json has ${n} ids`);
  answer.notes.forEach(note => console.log("  note: " + note));
  if (answer.unused && answer.unused.length) console.log(`  not exported (no picture used them): ${answer.unused.join(", ")}`);
}

/* ----- check ----- */
async function check() {
  const legacy = flag("--legacy") || !!opt("--legacy-ref");
  let legacyDir = null;
  if (legacy) {
    const ref = legacyRef();
    console.log(`Comparing with ${ref.slice(0, 7)} (${git("log", "-1", "--format=%s", ref)})`);
    legacyDir = unpackLegacy(ref);
  }
  const answer = await run(legacyDir, `/index.html?tool=check${legacy ? "&legacy=1" : ""}`, ["/tools/textures/check-page.js"]);
  if (answer.error) { console.error("Check failed:\n" + answer.error); process.exit(1); }
  const c = answer.counts;
  console.log(`  ${c.files} files loaded` + (answer.legacy ? `; compared ${c.flat} flat pictures, ${c.menu} menu pictures, ${c.html} hearts, faces, cursors, stickers and rune stones, ${c.scenes || 0} scene pictures (rooms at many moments, marks), ${c.board || 0} board pictures (at 1x, 2x and 3x)` : ""));
  if (answer.ok) { console.log("All pictures OK" + (answer.legacy ? ": every one matches the old game pixel for pixel." : ".")); return; }
  console.log(`${answer.problems.length} problem(s):`);
  answer.problems.forEach(p => console.log("  " + p));
  process.exit(1);
}

(cmd === "export" ? exportTextures() : check()).then(() => process.exit(0), e => { console.error(e.message || e); process.exit(1); });
