/* =========================================================
   tools/play-check.mjs
   Boots the game in headless Chrome or Edge and runs tools/play-check-page.js
   inside it: every campaign board is built from its .level file, the gem shop
   buys and saves, and nightmare mode unlocks and plays its first tunnel.
   A fresh browser profile each time, so your own save is never touched.

     node tools/play-check.mjs            run every check
     node tools/play-check.mjs --show     print the address and wait for you to open it
     node tools/play-check.mjs --shots <folder>   afterwards, screenshots of the new screens into <folder>
   ========================================================= */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flag = f => process.argv.includes(f);
const SHOTS = flag("--shots") ? path.resolve(process.argv[process.argv.indexOf("--shots") + 1] || "shots") : null;

/* Screenshots through the browser's debugging port: run some code in the page, then capture it */
async function shots(list) {
  const pages = await (await fetch("http://127.0.0.1:9339/json")).json();
  const ws = new WebSocket(pages.find(p => p.type === "page").webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const send = (method, params = {}) => new Promise(res => {
    const my = ++id;
    const on = e => { const m = JSON.parse(e.data); if (m.id === my) { ws.removeEventListener("message", on); res(m.result); } };
    ws.addEventListener("message", on);
    ws.send(JSON.stringify({ id: my, method, params }));
  });
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const [name, code] of list) {
    const r = await send("Runtime.evaluate", { expression: code, awaitPromise: true });
    if (r && r.exceptionDetails) console.log(`  shot ${name}: ${r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text}`);
    await new Promise(res => setTimeout(res, 1400));
    const img = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(SHOTS, name + ".png"), Buffer.from(img.data, "base64"));
    console.log(`  shot ${name}.png`);
  }
  ws.close();
}

function findBrowser() {
  const given = process.env.SNAKE_BROWSER;
  if (given) return given;
  const pf = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = pf.flatMap(p => [path.join(p, "Google/Chrome/Application/chrome.exe"), path.join(p, "Microsoft/Edge/Application/msedge.exe")])
    .concat(["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/microsoft-edge"]);
  return candidates.find(p => fs.existsSync(p)) || null;
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav" };

let done;
const result = new Promise(r => { done = r; });
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "POST") {
    let body = "";
    req.on("data", d => { body += d; });
    req.on("end", () => {
      res.end("ok");
      let data = {};
      try { data = JSON.parse(body); } catch { /* not ours */ }
      if (url.pathname === "/__tool/log") console.log("  " + data.msg);
      else if (url.pathname === "/__tool/result") done(data);
    });
    return;
  }
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    if (path.basename(file) === "index.html" && url.searchParams.has("tool")) {
      buf = Buffer.from(buf.toString("utf8").replace("</body>", `<script src="/tools/play-check-page.js"></script></body>`));
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(buf);
  });
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const address = `http://localhost:${server.address().port}/index.html?tool=play`;
let browser = null, profile = null;
if (flag("--show")) console.log(`Open ${address} and leave it open until this finishes.`);
else {
  const exe = findBrowser();
  if (!exe) { console.error("no Chrome or Edge found: set SNAKE_BROWSER, or use --show"); process.exit(1); }
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "snake-play-check-"));
  browser = spawn(exe, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--mute-audio",
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
    "--window-size=1280,800", `--user-data-dir=${profile}`, ...(SHOTS ? ["--remote-debugging-port=9339"] : []), address], { stdio: "ignore" });
  console.log(`  started ${path.basename(exe)} (headless)`);
}
const timer = new Promise(r => setTimeout(() => r({ ok: false, problems: ["no answer from the page after 300 seconds"] }), 300000));
const answer = await Promise.race([result, timer]);
if (SHOTS && browser) {
  await shots([
    ["nightmare-tunnel", "CAMP.islands.forEach(I => STORY_BEATS.forEach(b => { const id = storyId(I.id, b); if (!camp.storySeen.includes(id)) camp.storySeen.push(id); })); storyQueue = []; storyEl.classList.remove('open'); closeMapGoal(); openScreen('modes'); enterUnder(CAMP.nightmare.order[0]); 1"],
    ["nightmare-surface", "leaveUnder(); 1"],
    ["nightmare-island-2", "enterUnder(CAMP.nightmare.order[1]); 1"],
    ["nightmare-whole", "closePlace(); mapCam = camOn(300, 300, mapFit()); applyCam(mapCam); 1"],
    ["nightmare-roots", "openNmPanel(CAMP.nightmare.order[0], 'roots'); 1"],
    ["nightmare-shop", "closeNmPanel(); merchantStock('crown', true); openCampShop('crown', 'merchant'); 1"],
    ["nightmare-card", "openScreen('modes'); enterUnder(CAMP.nightmare.order[1]); openNmGoal(CAMP.nightmare.order[1], 1); 1"],
    ["gem-shop", "closeMapGoal(); openScreen('modes'); camp.gemDaily = 0; campWalletUpdate(); openGemShop(); 1"],
    ["map-overview", "closeGemShop(); openScreen('modes'); 1"],
    ["map-legend", "openScreen('modes'); mapSel = 'keep'; renderLegend(); 1"],
    ["home", "openNode('keep', 'home'); 1"],
    ["title", "openScreen('main'); renderTitleDeco(); 1"],
    ["sandbox-shelf", "document.getElementById('menu-sandbox').click(); 1"],
    ["sandbox-kit", "document.getElementById('shelf-new').click(); openRules(); const k = sbLevel.kit = { gear: { id: 'flamebrand', r: 'legendary' }, rune: { id: 'fury', r: 'fine' } }; renderRules(); document.querySelector('#rules-list .sb-kit').scrollIntoView(); 1"]
  ]).catch(e => console.log("  shots failed: " + e.message));
}
if (browser) browser.kill();
server.closeAllConnections();
server.close();
if (profile) { await new Promise(r => setTimeout(r, 1500)); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* temp folder */ } }
(answer.passed || []).forEach(p => console.log("  ok    " + p));
(answer.problems || []).forEach(p => console.log("  FAIL  " + p));
console.log(answer.ok ? `All ${answer.passed.length} checks passed.` : `${answer.problems.length} problem(s).`);
process.exit(answer.ok ? 0 : 1);
