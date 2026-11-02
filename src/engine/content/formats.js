/* =========================================================
   src/engine/content/formats.js
   Readers for every content file format. Content files are plain text and
   never run as code: these functions turn them into plain objects.

   Value files (.txt .world .upg .skin .theme .flair .avatar .item)
       # a comment line
       key = value                 text, a number, true/false, or none
       key = [a, b, c]             a list
       key = "  text  "            quotes keep spaces (and allow a leading [)
       [section]                   the keys below go inside "section"
       [section.part]              ...or deeper
       key = 12   # note           a note after " # " is ignored

   Table files (.dat)
       # a comment line
       first | second | third      one row per line, cells split on |

   Text files (.story .level)
       key = value lines, then a line of three dashes (---), then the body.

   docs/CONTENT-FORMATS.md has the full guide with examples.
   ========================================================= */
"use strict";

const Formats = (() => {
  const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;

  /* One value, typed: numbers, true/false, none, lists, quoted or plain text */
  function value(raw) {
    const s = raw.trim();
    if (s === "") return "";
    if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) return s.slice(1, -1).replace(/\\n/g, "\n");
    if (s.startsWith("[") && s.endsWith("]")) {
      const inner = s.slice(1, -1).trim();
      return inner ? splitList(inner).map(value) : [];
    }
    if (NUMBER.test(s)) return Number(s);
    if (s === "true") return true;
    if (s === "false") return false;
    if (s === "none") return null;
    return s;
  }

  /* Splits "a, b, [c, d]" on commas that aren't inside quotes or brackets */
  function splitList(s) {
    const out = [];
    let depth = 0, quote = false, cur = "";
    for (const ch of s) {
      if (ch === '"') quote = !quote;
      if (!quote && ch === "[") depth++;
      if (!quote && ch === "]") depth--;
      if (!quote && depth === 0 && ch === ",") { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    if (cur.trim() !== "" || out.length) out.push(cur);
    return out;
  }

  /* Drops a trailing " # note", but never a # inside quotes or a color like #ff0000 */
  function stripNote(line) {
    let quote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') quote = !quote;
      if (!quote && ch === "#" && i > 0 && /\s/.test(line[i - 1]) && (i + 1 >= line.length || /\s/.test(line[i + 1]))) return line.slice(0, i);
    }
    return line;
  }

  const isComment = line => /^\s*(#|\/\/)/.test(line);

  /* Names that would reach into every object in the game if a file (or a mod) used them */
  const RESERVED = new Set(["__proto__", "constructor", "prototype"]);

  /* key = value pairs, with [sections]. Problems go to warn(lineNumber, message). */
  function values(text, warn = () => {}) {
    const root = {};
    let target = root;
    String(text).split(/\r?\n/).forEach((line, i) => {
      if (!line.trim() || isComment(line)) return;
      const clean = stripNote(line).trim();
      const sec = /^\[([\w.\- ]*)\]$/.exec(clean);
      if (sec) {
        target = root;
        const parts = sec[1].split(".").map(p => p.trim()).filter(Boolean);
        if (parts.some(p => RESERVED.has(p))) {
          warn(i + 1, `"[${sec[1]}]" isn't allowed as a section name; its lines are skipped`);
          target = {};
          return;
        }
        parts.forEach(part => {
          if (!Object.hasOwn(target, part) || typeof target[part] !== "object" || target[part] === null) target[part] = {};
          target = target[part];
        });
        return;
      }
      const eq = clean.indexOf("=");
      if (eq < 1) { warn(i + 1, `expected "key = value", found "${clean}"`); return; }
      const key = clean.slice(0, eq).trim();
      if (RESERVED.has(key)) { warn(i + 1, `"${key}" isn't allowed as a key; the line is skipped`); return; }
      if (Object.hasOwn(target, key)) warn(i + 1, `"${key}" is set twice; the last one wins`);
      target[key] = value(clean.slice(eq + 1));
    });
    return root;
  }

  /* Rows of cells split on | */
  function table(text) {
    const rows = [];
    String(text).split(/\r?\n/).forEach(line => {
      if (!line.trim() || isComment(line)) return;
      rows.push(stripNote(line).split("|").map(value));
    });
    return rows;
  }

  /* A list of names, one per line (the first cell of each row) */
  function list(text) {
    return table(text).map(r => String(r[0]));
  }

  /* A header of key = value lines, then --- and a free-form body */
  function document(text, warn) {
    const all = String(text).split(/\r?\n/);
    const cut = all.findIndex(l => l.trim() === "---");
    const head = cut < 0 ? all : all.slice(0, cut);
    const body = cut < 0 ? [] : all.slice(cut + 1);
    return { head: values(head.join("\n"), warn), body };
  }

  /* Story pages: paragraphs separated by blank lines */
  function paragraphs(bodyLines) {
    const out = [];
    let cur = [];
    bodyLines.forEach(l => {
      if (isComment(l)) return;
      if (!l.trim()) { if (cur.length) out.push(cur.join(" ")); cur = []; }
      else cur.push(l.trim());
    });
    if (cur.length) out.push(cur.join(" "));
    return out;
  }

  /* Upgrade labels: "+{v}% orbs", "{v} {v|square|squares}", or a named style */
  function formatter(spec) {
    if (typeof spec !== "string" || !spec) return v => String(v);
    if (FORMATTERS[spec]) return FORMATTERS[spec];
    return v => spec.replace(/\{v(?:\|([^|}]*)\|([^}]*))?\}/g, (_, one, many) => (one === undefined ? String(v) : v === 1 ? one : many));
  }
  const FORMATTERS = {
    x: v => (v >= 100 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2)) + "x",
    "per-xp": v => (v >= 1
      ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " pts/XP"
      : (1 / v).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " XP/pt"),
    hearts: v => (v === 0.5 ? "half a heart" : v + (v === 1 ? " heart" : " hearts"))
  };

  /* Tier values: an explicit list, start/step/tiers for steady steps, or ratio/tiers
     for steady *proportions* (each tier is base x ratio^tier) */
  function tiers(rec) {
    if (Array.isArray(rec.values)) return rec.values.map(Number);
    if (typeof rec.ratio === "number" && typeof rec.base === "number") {
      const n = rec.tiers || 20;
      return Array.from({ length: n }, (_, i) => Number((rec.base * Math.pow(rec.ratio, i + 1)).toPrecision(4)));
    }
    if (typeof rec.start === "number" && typeof rec.step === "number") {
      const n = rec.tiers || 20;
      return Array.from({ length: n }, (_, i) => Math.round((rec.start + rec.step * i) * 100) / 100);
    }
    return [];
  }

  return { value, values, table, list, document, paragraphs, formatter, tiers, FORMATTERS };
})();
