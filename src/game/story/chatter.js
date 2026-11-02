/* =========================================================
   src/game/story/chatter.js
   Speech bubbles from the narrator and the snake
   ========================================================= */
"use strict";

/* =========================================================
   Chatter: rare speech bubbles from the narrator (purple) and the snake (green)
   ========================================================= */
const CHATTER = {
  narrator: {
    "start": [
      "And so {name} begins, with hope in its heart and no plan in its head, which is how most disasters start.",
      "The story begins. I would have started it earlier, but I was looking for my umbrella.",
      "If you would prefer a story with a happy ending, there is still time to close this game. No? Very well.",
      "Our hero sets out, unaware of the second paragraph. It is better that way.",
      "It was a fine day for a snake. The apples, sadly, had not been told.",
      "{name} stretched, cracked a vertebra, and entered a story whose ending it had not read. Nobody ever has.",
      "You pressed a button and the story began. I would like it noted that I did not ask you to.",
      "This is the part where I say something ominous. Something ominous. There. It is said.",
      "{name} set off with great confidence, which is how the best stories begin and the worst ones end.",
      "A new run. The apples tremble. Not visibly. They are apples. But inwardly, I assure you.",
      "Everything was fine. I mention this only because it is about to stop being the case."
    ],
    "calm": [
      "Nothing happened. I should like to say this is the best part, and I usually do.",
      "{name} slithered peacefully. I did not trust it for a moment.",
      "A quiet moment is only the universe taking a breath before it says something unkind.",
      "{name} considered the meaning of life and decided it was probably apples. I have heard worse answers.",
      "All was well, a phrase I use only when it is about to be untrue.",
      "A calm stretch. Savor it, dear reader. I have read ahead.",
      "{name} hummed a little tune. It was off-key, and nobody had the heart to say so.",
      "I poured myself a cup of tea. It went cold while I watched. Everything does, eventually.",
      "Steady now, {name}. I am rooting for you, quietly, in a way that would be hard to prove in court.",
      "Somewhere an apple waited. It had made its peace. It was a very peaceful apple.",
      "The board held its breath. Boards do not breathe. This one tried, out of sympathy."
    ],
    "long": [
      "{name} was now longer than most attention spans, and nearly as hard to steer.",
      "That is a great deal of snake. It is also, I fear, a great deal of opportunity for error.",
      "At this length {name} required a permit, and the permit required a form, and the form was lost.",
      "{name}'s tail was now in a different time zone, and had not been consulted about it.",
      "Somewhere far behind, the tail was having its own adventure. It would not end well. They rarely do.",
      "{name} had become less of a snake and more of a commute.",
      "The board was running out of board, which is how boards always come to feel about snakes.",
      "Long, and getting longer, like this narration, but with more serious consequences.",
      "{name}'s tail sent a postcard. It said: wish you were here. {name} did not reply. It was busy.",
      "Every turn is a negotiation now, and {name} has never been a skilled negotiator.",
      "Legend says {name}'s tail is still entering the board. Legends usually exaggerate. Not this one."
    ],
    "danger": [
      "Oh dear. Oh dear, oh dear. I am covering one eye, and considering the other.",
      "I would like to remind {name} that walls exist, have always existed and will outlast us all.",
      "This is fine, I said, and I have never once said that and been right.",
      "{name} was flirting with disaster, and disaster, to its credit, was listening closely.",
      "Not to alarm anyone, but this is the point in the story where alarm is traditional.",
      "Perilous, a word which here means 'one square away from a very unhappy ending.'",
      "A bold move. A very bold move. I am drafting the obituary in pencil, just in case.",
      "That was close: dangerously, deliciously, narratively close.",
      "{name} was living on the edge, which is a polite way of saying 'right next to the wall.'",
      "You might say this was the moment things went wrong. You would be a little early. But only a little.",
      "I would shout 'look out,' but narrators are forbidden from being useful. It is in our contract."
    ],
    "hurt": [
      "Ouch. That will leave a mark, and the mark will be in the story, forever, in ink.",
      "{name} was running on fumes and spite, which are, in my experience, poor and unreliable fuels.",
      "Hearts: low. Determination: questionable. My own confidence: quietly packing a suitcase.",
      "One more hit and this story gets a sadder ending. I have already drafted it. It is very moving.",
      "{name} had seen better days. Several of them. Most of them before this one.",
      "Wounded, but not finished. The difference is small, and I would hold on to it tightly.",
      "{name} limped onward. Snakes cannot limp. And yet here we are, limping.",
      "Careful now. Very, very careful. I have run out of other ways to say it.",
      "That popsicle will be remembered, mostly by {name}, and mostly as a mistake.",
      "Hang on, {name}. Figuratively. Please do not hang from anything. I cannot bear heights.",
      "Unfortunate, a word which here means 'about to get worse.'"
    ],
    "fire": [
      "{name} was on fire, in the sense that is both a compliment and a medical emergency.",
      "A hot snake coming through! I would step aside, but I am a narrator, and have no feet.",
      "The speed! The heat! The reckless disregard for my blood pressure!",
      "{name} moved faster than the story could keep up. I am writing this while running.",
      "Smoke trailed behind {name} like a cape, and, like a cape, it was mostly for show.",
      "This is what peak performance looks like. It also smells faintly of toast.",
      "Zoom. I have no further words. I have only zoom.",
      "{name} discovered the dangerous joy of speed. I took notes. I will not be reading them.",
      "Somewhere a safety inspector fainted. I did not catch them. I was busy narrating.",
      "Too fast? Just right? No. Much too fast. Please carry on, though. I could not stop you if I tried.",
      "The flames were a fashion statement now, and the statement, translated, was 'help.'"
    ],
    "sticky": [
      "{name} was stuck. Gloriously, tragically, stickily stuck.",
      "Slow, dramatic and sticky: a tragedy in three words, none of them 'hurry.'",
      "Molasses: one. {name}: zero. I keep the score, and it is rarely kind.",
      "{name} waded through the syrup like a melancholy pancake with ambitions.",
      "Time slowed down, mostly because {name} did.",
      "This is, by some distance, the slowest chase scene in all of literature.",
      "Sweet, sticky and deeply humiliating: the three pillars of a truly unfortunate afternoon.",
      "{name} will be scraping this off for days, and nobody will thank it for the trouble.",
      "I could make a sandwich in the time this is taking. I would not enjoy it. I enjoy very little.",
      "Patience, {name}. Patience, and possibly a towel.",
      "A sticky situation, as predicted by everyone who has ever seen molasses, which is everyone."
    ],
    "best": [
      "{name} was closing in on a personal best, and I was nervous, which helps no one.",
      "This could be the run. The run. I am trying very hard not to jinx it, and failing.",
      "Records were trembling. Records do that. It is their great weakness.",
      "Do not look now, but history is watching, and it is not good at looking away.",
      "I leaned forward in my chair. I do not own a chair. I leaned anyway.",
      "{name} could smell a high score. It smelled of apples, and slightly of destiny.",
      "One more apple, and another, and then something that might, with care, be called a legend.",
      "This is the stuff songs are written about. Small songs. In minor keys. Sung alone.",
      "Keep going. The old record is nervous. It has a family.",
      "{name} was in the zone. I was in the audience, holding my breath, which narrators should never do.",
      "Greatness, or at least a slightly above-average run. I will take either. I take what I can get."
    ],
    "nightmare": [
      "This is a Nightmare. It says so on the door. I am not responsible for the door.",
      "Even I am frightened now, which is worth mentioning, because usually I am only worried.",
      "The great coil is watching. It always is. It has nothing else on.",
      "In nightmares the apples have teeth. This is not a metaphor. I wish it were.",
      "{name} would like to wake up now, please. I would like that too.",
      "Bad dreams, good scores. It is an unfair trade, but it is the only one on offer.",
      "The dark was full of snacks and regrets. Mostly regrets.",
      "Somewhere the great coil chuckled. I pretended not to hear. I am very good at pretending.",
      "No one ever promised that nightmares would be fair. I looked it up. No one did.",
      "{name} kept going, because dreams have no exits, only other dreams.",
      "I am whispering now, in case something is listening. Something is. Something always is."
    ]
  },
  snake: {
    start: ["Okay. Okay okay okay. Let's go.", "I've got a good feeling about this one.", "Apples, here I come!", "Hi! I'm {name}! I'm going to win!", "Let's do this. Whatever this is.", "New run, who dis?", "I stretched first this time.", "I'm not nervous. You're nervous.", "Today I eat everything.", "Let's not bonk anything. Deal?", "I can do this. Probably."],
    calm: ["La la la, snake things.", "Is it snack time? It's always snack time.", "I wonder what's past the edge.", "Hm. Nice day for a slither.", "I could do this all day.", "Am I doing great? I feel like I'm doing great.", "Ssssssso peaceful.", "I should name my tail.", "Do apples have feelings? Hope not.", "Just vibing.", "I wonder if the tortoise misses his pebble."],
    long: ["I am SO long right now.", "Hello, tail! Long time no see!", "Wait, is that me back there?", "I'm basically a train.", "I need a bigger board.", "My tail is in another zip code.", "Every turn takes forever now.", "Look at me. Look at all of me.", "I'm going to need a longer name.", "This is either amazing or a terrible idea.", "Hope my tail is having fun back there."],
    danger: ["Nope nope nope nope.", "WALL. WALL. WALL.", "I'm too young to bonk!", "Okay, that was close.", "Why is everything so pointy?", "Not today, wall. Not today.", "Did I just almost... yeah.", "My life flashed before my eyes. It was mostly apples.", "Turn, turn, TURN!", "I meant to do that.", "Heart's racing. Do snakes have hearts? Racing anyway."],
    hurt: ["Ow. Ow ow ow.", "I'm fine. Totally fine. Not crying.", "Who put that there?!", "I regret that popsicle.", "Just a flesh wound.", "Running low on hearts here.", "Please no more pointy things.", "I'll walk it off. Slither it off.", "That's going to bruise.", "Note to self: don't do that again.", "Okay, being careful now. Super careful."],
    fire: ["WHEEEEE!", "I'm on fire! Is that bad? It feels great!", "Hot hot hot hot!", "Too fast! Love it!", "Can't stop, won't stop, might explode!", "Is this what being a comet feels like?", "Speed is my middle name now.", "My scales are toasty!", "Gotta go fast!", "Nobody can catch me! Not even me!", "I can hear colors!"],
    sticky: ["Ugh, so sticky.", "My scales are glued together.", "This is SO embarrassing.", "Why is the floor eating me?", "Sweet, but gross.", "I'm a snake, not a pancake!", "Slooooow mooooo.", "Somebody get me a towel.", "I'll be finding syrup in places for weeks.", "Can't... move... fast...", "Who spills molasses in a maze?!"],
    best: ["This is my best run ever!", "Don't jinx it. Don't jinx it.", "Record, here I come!", "Keep it together, {name}.", "I can taste the high score. It tastes like apples.", "So close! SO CLOSE!", "Nobody breathe.", "Is anyone watching? Someone should be watching.", "I'm unstoppable! Please don't stop me.", "This one's for the tortoise.", "Legendary snake behavior right here."],
    nightmare: ["I don't like this dream.", "Why is everything so dark?", "Is it bedtime yet? Is this bedtime?", "Mom? MOM?", "I can hear the coil breathing.", "Nightmares are just dreams with bad manners.", "Be brave, {name}. Be brave.", "This is fine. Everything's fine. Nothing's fine.", "I want my garden back.", "Wake up, wake up, wake up.", "Did my reflection just blink?"]
  }
};
const CHATTER_CHANCE = 1 / 40;      // rolled once a second
const CHATTER_COOLDOWN = 18000;
let chatterAcc = 0;
let lastChatter = -1e9;
const chatterBags = {};

/* Reads what the snake is up to and picks a mood */
function chatterMood(ts) {
  const ahead = [snake.x + snake.dx, snake.y + snake.dy];
  const offBoard = ahead[0] < 0 || ahead[1] < 0 || ahead[0] >= boardSize || ahead[1] >= boardSize;
  const nearWall = (edgeMode === "wall" && offBoard) || walls.get(cellKey(ahead[0], ahead[1])) === "red" ||
    snake.cells.slice(1).some(c => c.x === ahead[0] && c.y === ahead[1]);
  if (nearWall) return "danger";
  if (ts < fx.slowUntil) return "sticky";
  if (ts < fx.fastUntil) return "fire";
  const maxHearts = getTrackValue("hearts");
  if (maxHearts >= 1 && currentHearts <= maxHearts / 3) return "hurt";
  const best = (currentNightmare ? save.highScoresNightmare : save.highScores)[currentModeKey];
  if (best > 0 && score >= best * 0.75) return "best";
  if (currentNightmare && Math.random() < 0.6) return "nightmare";
  if (snake.maxCells >= 30) return "long";
  if (runMs < 15000) return "start";
  return "calm";
}

function pickLine(speaker, mood) {
  const key = speaker + ":" + mood;
  if (!chatterBags[key] || !chatterBags[key].length) {
    chatterBags[key] = CHATTER[speaker][mood].map((_, i) => i).sort(() => Math.random() - 0.5);
  }
  return withName(CHATTER[speaker][mood][chatterBags[key].pop()]);
}

function tickChatter(ts, delta) {
  if (!save.settings.chatter || tutorial || paused || currentModeKey === "custom") return;
  chatterAcc += delta;
  if (chatterAcc < 1000) return;
  chatterAcc -= 1000;
  if (ts - lastChatter < CHATTER_COOLDOWN || toastBusy || Math.random() >= CHATTER_CHANCE) return;
  lastChatter = ts;
  const speaker = Math.random() < 0.55 ? "narrator" : "snake";
  saySomething(speaker, chatterMood(ts));
}

function saySomething(speaker, mood) {
  const span = document.createElement("span");
  span.textContent = pickLine(speaker, mood);
  queueToast(span.innerHTML, speaker);
}
