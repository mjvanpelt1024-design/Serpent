/* =========================================================
   src/ui/item-intros.js
   Introducing new things mid-run
   ========================================================= */
"use strict";

/* ----- New item introductions: the game pauses to explain something the first time you see it ----- */
const INTROS = {
  xp0: { type: "xp", grade: 0, title: "Experience crumbs", text: "Tiny glowing crumbs, scattered like a trail of bad decisions. Each is worth half an XP, and XP is spent in the Shop, where all trouble is purchased." },
  xp1: { type: "xp", grade: 1, title: "Experience", text: "A whole glowing square, worth one XP, spent in the Shop. {name} felt wiser just looking at it, which is the cheapest kind of wisdom and the only kind I can afford." },
  xp2: { type: "xp", grade: 2, title: "Big experience", text: "A great block of XP, worth 5 at once. It will not wait forever. Nothing generous ever does." },
  apple0: { type: "apple", grade: 0, title: "Apple bites", text: "Someone has been nibbling. Apple bites give half the points of a whole apple, but {name} still grows. I shall not be asking who did the nibbling." },
  apple2: { type: "apple", grade: 2, title: "Big apples", text: "An apple the size of four. It is worth 5 times the points, and {name} grows 5 segments eating it, which is a great deal of snake to suddenly be." },
  rock1: { type: "rock", grade: 1, title: "Rocks", text: "Rocks leave your hearts alone, but bump one and half your score falls off. They stay put all run, like a relative who came for the weekend and will not leave." },
  rock0: { type: "rock", grade: 0, title: "Pebbles", text: "Pebbles are smaller than rocks and every bit as petty. One costs a quarter of your score. Size, I have found, has nothing to do with spite." },
  rock2: { type: "rock", grade: 2, title: "Boulders", text: "A boulder wipes out nearly all of your score. Give it plenty of room. It is the only advice I have ever given that anyone took." },
  popsicle1: { type: "popsicle", grade: 1, title: "Popsicles", text: "They look delicious. They are not. A popsicle costs a heart, and with no hearts left the run is over. I did warn you. In writing. In this very sentence." },
  popsicle0: { type: "popsicle", grade: 0, title: "Mini pops", text: "Bite-sized popsicles. Each does only half a heart of damage, but they add up faster than anyone is prepared for, and nobody is ever prepared." },
  popsicle2: { type: "popsicle", grade: 2, title: "Mega pops", text: "A popsicle this large ends the run at once, hearts or no hearts. {name} felt a chill just looking at it. I felt one just describing it." },
  flea: { type: "flea", grade: 1, title: "Fleas", text: "Itchy little pests. Small fleas halve your score, normal ones take half a heart, and big ones take a heart and half your score. They do not stay long. They do not need to." },
  fire: { type: "fire", grade: 1, title: "Fire", text: "Fire makes {name} race along for a few seconds. Bigger flames also singe your score, and the biggest take half a heart. A mixed blessing, a phrase which here means 'mostly a curse.'" },
  apple1: { type: "apple", grade: 1, title: "Apples", text: "An apple. Eat it and {name} grows a little longer and your score goes up. It is the only reward in this story without a catch, so enjoy it." },
  controls: { type: "snake", title: "This is {name}", text: "Steer with the arrow keys, WASD, or a swipe on the board. {name} never stops moving, which is admirable, and also the problem." },
  molasses: { type: "molasses", grade: 1, title: "Molasses", text: "Molasses slows {name} for a while, and a big puddle glues it in place for a moment. I stepped in some once and missed a wedding. It was Marguerite's. Perhaps it was for the best." }
};

/* build 46: hazards, power-ups and the Hunter */
Object.assign(INTROS, {
  bramble: { type: "bramble", grade: 1, title: "Brambles", text: "Thorny bushes. Touching one costs half a heart and tramples it flat, but left alone they creep into the squares beside them. Gardens, it turns out, can hold a grudge." },
  wasp: { type: "wasp", grade: 1, title: "Wasps", text: "A wasp flies straight for {name}'s head, one square at a time, and stings for half a heart. It won't land on the body, so a well-placed coil keeps it off." },
  lightning: { type: "lightning", grade: 1, title: "Lightning", text: "A square flashes, then lightning strikes it. If any part of {name} is in it, that's a heart. Lightning splits rocks, too, which the rocks never see coming." },
  ice: { type: "ice", grade: 1, title: "Ice", text: "On ice {name} slides straight on and can't turn until it's off again. Plan your turns before the ice, not on it. I learned this at a skating rink, the hard way." },
  bomb: { type: "bomb", grade: 1, title: "Bombs", text: "A bomb counts down, then blows up everything around it: rocks, hazards, and a heart's worth of {name} if it's too close. Touch it and it goes off at once." },
  ghost: { type: "ghost", grade: 1, title: "Ghosts", text: "Ghosts drift toward {name} through walls and rocks alike. A touch costs half a heart and a third of your score. They don't last, which is the only kind thing about them." },
  spikes: { type: "spikes", grade: 1, title: "Spike traps", text: "Spikes rise and fall on a steady beat, and flash red just before they rise. Cross them while they're down. Cross them while they're up and it's a heart." },
  gust: { type: "gust", grade: 1, title: "Gusts", text: "When the arrows sweep across the board, the wind is about to shove {name} a whole square that way. Mind what's beside you." },
  sinkhole: { type: "sinkhole", grade: 1, title: "Sinkholes", text: "A crack appears, then opens into a pit. Fall in and the run is over, hearts or no hearts. It closes again after a while, as though nothing happened. Pits are like that." },
  golden: { type: "golden", grade: 1, title: "Golden Apples", text: "Worth ten ordinary apples, and a big slice of Fever. Eat apples quickly to fill the Fever bar: when it's full, points triple and small hazards burst when you touch them." },
  shears: { type: "shears", grade: 1, title: "Shears", text: "Snips {name}'s tail in half and pays points for every segment. When the board gets crowded with you, this is the cure." },
  armor: { type: "armor", grade: 1, title: "Armor", text: "A plate of armor sits over your hearts and takes one hit, any hit, even a mega pop. Walls and your own tail don't care about armor, sadly." },
  shield: { type: "shield", grade: 1, title: "Bubble Shield", text: "A bubble that takes the next hit of any kind, even a wall or your own tail, and turns {name} aside. It pops after one hit, or after a while." },
  hourglass: { type: "hourglass", grade: 1, title: "Hourglass", text: "Everything that wants to hurt {name} stops dead for five seconds: wasps, ghosts, bombs, lightning, the lot. Time, for once, on your side." },
  star: { type: "star", grade: 1, title: "Rampage Star", text: "For five seconds {name} smashes through rocks, hazards and anything else in the way, for points. Nothing can hurt you. Please use this responsibly. You won't." },
  phantom: { type: "phantom", grade: 1, title: "Phantom", text: "For a few seconds {name} goes see-through: it slides through its own body and through rocks, and ghosts can't touch it." },
  lodestone: { type: "lodestone", grade: 1, title: "Lodestone", text: "For a while, apples and XP nearby drift toward {name}'s head. Lazy, effective, and frankly how I'd like to live." },
  frenzy: { type: "frenzy", grade: 1, title: "Frenzy Clock", text: "Double points for ten seconds. With Fever on top it's six times. I have done the sums and I am alarmed." },
  hunter: { type: "hunter", grade: 1, title: "The Hunter", text: "A rival snake. It steals apples and hunts {name}'s head: a bite costs a heart. But if it runs into {name}'s body it's stunned, and three stuns beat it. Coil around it. Press E to shed your skin as a wall it can't cross." }
});

function introKeyFor(type, grade) {
  if (INTROS[type] && ENTITY_TYPES[type]) return type;
  if (type === "hunter") return "hunter";
  if (type === "flea" || type === "fire" || type === "molasses") return type;
  if (type === "apple" && grade === 1) return guide || guideRun ? "apple1" : null;
  return INTROS[type + grade] ? type + grade : null;
}

let introOpen = null;

function checkIntros(view) {
  if (!save.settings.intros || paused || introOpen || tutorial || guide || (guideRun && !save.seenItems.includes("controls"))) return;
  const onScreen = it => {
    const span = (it.size || 1) * cell;
    const [x, y] = view.toScreen(it.x, it.y);
    return x < boardSize && x + span > 0 && y < boardSize && y + span > 0;
  };
  const lists = [
    ["apple", apples], ["xp", orbs], ["rock", rocks],
    ["popsicle", popsicles.filter(p => !p.isBonusApple)], ["apple", popsicles.filter(p => p.isBonusApple)]
  ];
  hazards.forEach(h => lists.push([h.type, [h]]));
  entities.forEach(e => { if (!ENTITY_TYPES[e.type].global) lists.push([e.type, [e]]); });
  if (hunter && hunter.alive && hunter.cells[0]) lists.push(["hunter", [{ x: hunter.cells[0].x, y: hunter.cells[0].y, size: 1 }]]);
  for (const [type, list] of lists) {
    for (const it of list) {
      const key = introKeyFor(type, gradeOf(it));
      if (key && !save.seenItems.includes(key) && onScreen(it)) {
        openIntroCard(key, it, view);
        return;
      }
    }
  }
}

/* The board dims around the new thing and the camera leans in on it.
   The explanation sits down in the dialogue area, in the tutorial's own color,
   until the player taps through. Then the camera eases back out and the run
   picks up again after a short count. */
const introBubbleEl = document.getElementById("intro-bubble");
function openIntroCard(key, it, view) {
  const info = INTROS[key];
  introOpen = key;
  paused = true;
  pauseStartedAt = performance.now();
  let fx = 50, fy = 50;
  if (it && view) {
    const span = (it.size || 1) * cell;
    const [x, y] = view.toScreen(it.x, it.y);
    fx = Math.max(8, Math.min(92, ((x + span / 2) / boardSize) * 100));
    fy = Math.max(8, Math.min(92, ((y + span / 2) / viewH) * 100));
  }
  stageEl.style.setProperty("--fx", fx + "%");
  stageEl.style.setProperty("--fy", fy + "%");
  stageEl.classList.add("focusing");
  document.body.classList.add("focusing");
  introBubbleEl.innerHTML = `<span class="ib-who">Something new</span><span class="ib-title">${escapeAttr(withName(info.title))}</span><span class="ib-text">${escapeAttr(withName(info.text))}</span><span class="ib-hint">${isTouchDevice() ? "Tap" : "Click, Space or Enter"} to carry on</span>`;
  introBubbleEl.hidden = false;
  requestAnimationFrame(() => introBubbleEl.classList.add("show"));
  sfx("intro");
}

let introClosing = false;
function closeIntroCard() {
  if (!introOpen || introClosing) return;
  if (!save.seenItems.includes(introOpen)) save.seenItems.push(introOpen);
  persist();
  introClosing = true;
  stageEl.classList.remove("focusing");
  document.body.classList.remove("focusing");
  introBubbleEl.classList.remove("show");
  sfx("click");
  // let the camera ease back out, then count the run back in
  setTimeout(() => {
    introBubbleEl.hidden = true;
    introOpen = null;
    introClosing = false;
    if (gameState !== "PLAYING") { paused = false; return; }
    reviveCountdown = 2;
    showCountdown();
  }, 500);
}
introBubbleEl.addEventListener("click", closeIntroCard);
stageEl.addEventListener("click", () => { if (introOpen) closeIntroCard(); });
