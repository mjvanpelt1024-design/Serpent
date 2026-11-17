/* =========================================================
   src/engine/boot.js
   Starts the game: reads content, then the pictures in textures/
   (src/engine/content/textures.js), then loads the scripts listed in
   src/load-order.dat one after another, in that order.

   If something goes wrong (a missing file, a typo in a content file,
   an error in a script), a panel explains what and where, instead of
   leaving a blank screen.
   ========================================================= */
"use strict";

(async () => {
  const panel = document.createElement("div");
  panel.id = "boot-panel";
  panel.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;" +
    "background:#0a1c16;color:#cfe9d8;font:14px/1.5 'Pixelify Sans',monospace;padding:24px;text-align:center";
  panel.innerHTML = `<div><div style="font-size:28px;color:#3ddc3d;letter-spacing:2px">SERPENT</div><div id="boot-line">Loading</div></div>`;
  document.body.appendChild(panel);
  const line = text => { const el = document.getElementById("boot-line"); if (el) el.textContent = text; };

  const problems = [];
  const fail = (title, items, footer = "Fix the files above and reload (F5 in the launcher).") => {
    panel.style.alignItems = "flex-start";
    panel.style.textAlign = "left";
    panel.style.overflow = "auto";
    panel.innerHTML = `<div style="max-width:760px;margin:0 auto">
      <div style="font-size:24px;color:#ff5a61;margin-bottom:8px">${title}</div>
      <ol style="padding-left:20px">${items.map(t => `<li style="margin:6px 0">${t}</li>`).join("")}</ol>
      <p style="opacity:.7">${footer}</p></div>`;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // An error while a script loads names the file and line
  window.addEventListener("error", e => {
    if (!window.BOOTED) problems.push(`<b>${esc((e.filename || "").replace(location.origin + "/", ""))}</b> line ${e.lineno}: ${esc(e.message)}`);
  });

  let content;
  try {
    content = await ContentLoader.load();
  } catch (e) {
    fail("The content couldn't be read", [esc(e && e.stack || e)]);
    return;
  }
  window.CONTENT = content;
  if (content.source === "bundle" && content.filesRead === 0) {
    fail("Open the game with the launcher", [
      "Browsers won't let a page opened straight from disk read the content folder.",
      "Run SerpentGame.exe, or run <b>tools/bundle-content.py</b> once to make content.bundle.js and open index.html again."],
      "Opening index.html from disk is only for quick tests; the launcher is the real way to play.");
    return;
  }
  const hard = content.warnings.filter(w => w.message === "missing file" || w.message.includes("doesn't exist"));
  if (hard.length) {
    fail("Some content files are missing", hard.map(w => `<b>${esc(w.path)}</b>: ${esc(w.message)}`));
    return;
  }
  if (content.warnings.length) {
    console.groupCollapsed(`%cContent: ${content.warnings.length} warning(s)`, "color:#ffb020");
    content.warnings.forEach(w => console.warn(`${w.path}${w.line ? ":" + w.line : ""}  ${w.message}`));
    console.groupEnd();
  }

  // every picture, before anything draws: a missing one is a checkerboard and a warning, never a stop
  line("Loading pictures");
  try {
    window.TEXTURES = await TextureLoader.load();
  } catch (e) {
    console.error("Textures couldn't be loaded:", e);
  }

  line("Loading scripts");
  const order = Formats.list(await ContentLoader.read("src/load-order.dat") || "");
  for (const path of order) {
    const ok = await new Promise(resolve => {
      const s = document.createElement("script");
      s.src = "src/" + path;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
    if (!ok) problems.push(`<b>src/${esc(path)}</b> couldn't be loaded (is it listed with the right name?)`);
    if (problems.length) { fail("The game couldn't start", problems); return; }
  }
  window.BOOTED = true;
  console.info(`%cSnake ${content.version}%c  ${content.filesRead} content files (${content.source}), ${window.TEXTURES ? window.TEXTURES.files : 0} pictures` +
    (content.mods.length ? `, mods: ${content.mods.map(m => m.name).join(", ")}` : ""), "color:#3ddc3d;font-weight:bold", "color:inherit");
  panel.remove();
})();
