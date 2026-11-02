/* =========================================================
   src/dev/terminal/registry.js
   The command registry and autocomplete
   ========================================================= */
"use strict";

/* =========================================================
   The registry
   A subject or an action is either a plain word, or a "slot" that matches a
   family of names (every upgrade track, every stat, every sound...).
   ========================================================= */
const COMMANDS = [];

function slot(name, ids, resolve) {
  return { slot: true, name, ids, resolve: resolve || (tok => ids().find(x => squash(x) === squash(tok)) || null) };
}

function cmd(group, subject, action, args, desc, run, extra = {}) {
  COMMANDS.push({ group, subject, action, args, desc, run, examples: extra.examples || [], hidden: !!extra.hidden, aliases: extra.aliases || [] });
}

const partName = p => (typeof p === "string" ? p : p.name);
const usageOf = c => `${c.group} ${partName(c.subject)}.${partName(c.action)}${c.args ? " " + c.args : ""}`;

function matchPart(part, tok, aliases) {
  if (typeof part === "string") return squash(part) === squash(tok) || (aliases || []).some(a => squash(a) === squash(tok)) ? part : undefined;
  const v = part.resolve(tok);
  return v === null || v === undefined ? undefined : v;
}

/* Literal subjects win over slots, so `attribute xp.set` never means a stat */
function subjectHits(group, tok) {
  const list = COMMANDS.filter(c => c.group === group);
  const lit = list.filter(c => typeof c.subject === "string" && squash(c.subject) === squash(tok));
  if (lit.length) return lit.map(c => ({ c, s: c.subject }));
  const out = [];
  list.filter(c => typeof c.subject !== "string").forEach(c => {
    const v = matchPart(c.subject, tok);
    if (v !== undefined) out.push({ c, s: v });
  });
  return out;
}

function subjectNames(group) {
  const names = new Set();
  COMMANDS.filter(c => c.group === group && !c.hidden).forEach(c => {
    if (typeof c.subject === "string") names.add(c.subject);
    else c.subject.ids().forEach(x => names.add(x));
  });
  return Array.from(names);
}

function actionNames(hits) {
  const names = new Set();
  hits.forEach(({ c }) => {
    if (c.hidden) return;
    if (typeof c.action === "string") names.add(c.action);
    else c.action.ids().forEach(x => names.add(x));
  });
  return Array.from(names);
}

/* Find the command for a group, a subject and an action. Fixes small typos and says so. */
function resolveCommand(group, subjTok, actTok) {
  let hits = subjectHits(group, subjTok);
  let fixedSubj = null;
  if (!hits.length) {
    const guess = nearest(subjTok, subjectNames(group));
    if (!guess) {
      // They typed the action without its subject, like `dev godmode`
      const owner = COMMANDS.find(c => c.group === group && !c.hidden && typeof c.action === "string" && (squash(c.action) === squash(subjTok) || c.aliases.some(x => squash(x) === squash(subjTok))));
      if (owner) return { error: `did you mean: ${group} ${partName(owner.subject)}.${owner.action}${owner.args ? " " + owner.args : ""}` };
      return { error: `${group} has no '${subjTok}'. try: help ${group}` };
    }
    hits = subjectHits(group, guess);
    fixedSubj = guess;
  }
  if (!actTok) {
    return { error: `${group} ${fixedSubj || subjTok} needs an action after a dot: ` + actionNames(hits).map(a => `.${a}`).join("  ") };
  }
  for (const h of hits) {
    const v = matchPart(h.c.action, actTok, h.c.aliases);
    if (v !== undefined) return { cmd: h.c, subject: h.s, action: v, fixedSubj };
  }
  const guess = nearest(actTok, actionNames(hits));
  if (guess) {
    for (const h of hits) {
      const v = matchPart(h.c.action, guess, h.c.aliases);
      if (v !== undefined) return { cmd: h.c, subject: h.s, action: v, fixedSubj, fixedAct: guess };
    }
  }
  return { error: `'${fixedSubj || subjTok}' can't '${actTok}'. it can: ` + actionNames(hits).map(a => `.${a}`).join("  ") };
}

/* Old-style commands from before the unified syntax, pointed at their new home */
const OLD_HINTS = {
  god: "dev damage.godmode true", reverse: "dev controls.reverse true", speed: "dev speed.mult 2", mult: "dev score.mult 10",
  params: "dev rules.show", unlock: "dev modes.unlock all", lock: "dev modes.lock all", play: "dev run.play garden",
  resume: "dev run.resume", end: "dev run.end wall", spawn: "dev spawn.apple large 3", purge: "dev purge.hazards",
  heal: "attribute hearts.add 1", grow: "attribute length.add 10", set: "attribute xp.set 150", add: "attribute xp.add 1k",
  sub: "attribute xp.sub 500", get: "attribute xp.get", stat: "debug stat.fps true", grid: "debug grid.show true",
  sfx: "debug sfx.play medal", music: "debug music.play tense", setting: "debug setting.musicVolume 80",
  open: "debug screen.open shop", scene: "debug scene.play intro", page: "debug page.open 1", say: "debug say.narrator calm",
  toast: "debug toast.show hello", confetti: "debug confetti.fire", tutorial: "debug tutorial.play",
  firstrun: "data reset.firstrun yes", reset: "data reset.stats yes", ls: "data list.modes", dev: "dev damage.godmode true"
};

function runConsole(raw) {
  const line = String(raw || "").trim();
  if (!line) return;
  consoleHistory.push(line);
  consoleHistoryAt = consoleHistory.length;
  consolePrint(">> " + line, "in");

  const words = splitWords(line);
  if (!words.length) return;
  let head = words[0].toLowerCase();
  if (META_ALIAS[head]) head = META_ALIAS[head];

  try {
    if (head === "hiss") { easterEgg(); return; }
    if (META.includes(head)) {
      const r = META_RUN[head](words.slice(1));
      if (r !== "quiet") refreshAfterCommand();
      return;
    }

    let group = resolveGroup(head);
    let rest = words.slice(1);
    // No group typed: "xp.set 150" still works when only one group could mean it
    if (!group && head.includes(".")) {
      const [s, a] = head.split(".");
      let owners = GROUP_IDS.filter(g => { const r = resolveCommand(g, s, a); return r.cmd && !r.fixedSubj && !r.fixedAct; });
      // A plain-word subject beats a family match: xp.set means your XP, not the XP upgrade
      const literal = owners.filter(g => typeof resolveCommand(g, s, a).cmd.subject === "string");
      if (literal.length === 1) owners = literal;
      if (owners.length === 1) {
        group = owners[0];
        rest = words;
        note(`(read as: ${group} ${words.join(" ")})`);
      } else if (owners.length > 1) {
        fail(`'${head}' is in more than one group: ${owners.join(", ")}. put the group first, e.g. ${owners[0]} ${head}`);
      }
    }
    if (!group) {
      const old = OLD_HINTS[head];
      const guess = nearest(head, GROUP_IDS.concat(META));
      if (old) fail(`commands now read: group subject.action value. the new way: ${old}`);
      fail(`unknown group '${words[0]}'.` + (guess ? ` did you mean '${guess}'?` : "") + " groups: " + GROUP_IDS.join(", ") + ". type help.");
    }
    if (!rest.length) { helpGroup(group); return; }

    // subject.action, or subject action (the dot is optional if you forget it)
    let subjTok, actTok;
    const w = rest[0];
    if (w.includes(".")) {
      const i = w.indexOf(".");
      subjTok = w.slice(0, i);
      actTok = w.slice(i + 1);
      rest = rest.slice(1);
    } else {
      subjTok = w;
      rest = rest.slice(1);
      const probe = rest[0] && resolveCommand(group, subjTok, rest[0]);
      if (probe && probe.cmd && !probe.fixedAct) { actTok = rest[0]; rest = rest.slice(1); }
    }
    const found = resolveCommand(group, subjTok, actTok);
    if (found.error) fail(found.error);
    if (found.fixedSubj || found.fixedAct) note(`(read '${subjTok}${actTok ? "." + actTok : ""}' as '${found.fixedSubj || subjTok}.${found.fixedAct || actTok}')`);
    const r = found.cmd.run(rest, { subject: found.subject, action: found.action });
    if (r === "quiet") return;
  } catch (e) {
    if (e instanceof CmdError) { consolePrint("error: " + e.message, "err"); return; }
    consolePrint("internal error: " + e.message, "err");
    return;
  }
  refreshAfterCommand();
}
