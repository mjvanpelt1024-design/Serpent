/* =========================================================
   src/game/story/narration.js
   The narrator's commentary after each run
   ========================================================= */
"use strict";

const COMMENTARY_OPTIONS = [
  ["off", "Off"],
  ["supportive", "Supportive"],
  ["dramatic", "Dramatic"],
  ["brutal", "Brutally honest"]
];

/* Narrator lines: 10 per setting per mode. The tag says when a line can play:
   w = hit a wall, b = fell behind (Endless), s = bit your tail, p = poison, * = any death */
const NARRATION = {
  "supportive": {
    "easy": [
      "s|{name} has bitten {name}. It was not your fault, or not entirely, which is more than most people can say about anything.",
      "s|There was nothing in the garden but apples, and still {name} found something to bite. I find that oddly hopeful. I find very little hopeful.",
      "s|A snake is mostly tail, dear reader, and a tail is mostly the past. It catches up with all of us eventually.",
      "s|{name} turned into itself. Do not be troubled. I once walked into my own reflection in a hat shop, and I recovered, more or less.",
      "s|Biting oneself is a misfortune, but a small one, and small misfortunes are the only kind that let you try again.",
      "*|You did perfectly well, by the standards of a garden, which are low, and kind.",
      "*|The apples will carry on without {name}, as apples do. They are not cruel. They are simply apples.",
      "*|That was a brave attempt, and I do not say that lightly. I say very little lightly.",
      "*|Go again. I would so like this not to be the last chapter. Last chapters are always the hardest to read.",
      "*|Breathe in, breathe out, and press the button. {name} has already forgiven you. Snakes have short memories and long bodies."
    ],
    "classic": [
      "w|{name} has met the wall. Do not blame yourself. The wall has been practicing for a thousand years, and you only for a moment.",
      "w|The wall was exactly where it has always been. That is its only talent, and it is, I am sorry to say, a very effective one.",
      "w|Walls do not apologize, do not move and do not write back. I have tried. {name} should not take it personally.",
      "w|{name} bumped the wall, and the wall said nothing. Silence is not the same as cruelty, though the two sound very alike.",
      "s|{name} grew so long it lost track of itself. This happens to the best of us, and also to the rest of us.",
      "s|To be caught in one's own embrace is dreadful, but a snake has so few other ways of being held.",
      "s|Tangled, but not defeated. The difference is small, but it is the difference that lets you try again.",
      "*|It is called Classic because it has always ended this way. An expected ending still deserves a little sympathy.",
      "*|Shake it off. The next run may be the one. I have said this before and been wrong, but being wrong is not the same as being finished.",
      "*|{name} believes in you. So do the apples, in their quiet way. I remain neutral, as narrators must, though it is a strain."
    ],
    "challenge": [
      "w|{name} found the wall. It is a hard place, and walls are one of the regrettable features of hard places.",
      "w|The wall won this round. It is a small comfort, but walls are not clever, and you have many rounds left in you.",
      "w|{name} misjudged a corner. Corners seem friendly until the very moment they are not, much like certain dinner guests.",
      "s|{name} got caught up in itself, which is very relatable, if one is the sort of person who relates to snakes. I am, lately.",
      "s|A little self-reflection, snake style. It is unpleasant, but it builds character, though rarely the character one wanted.",
      "s|{name} grew so quickly it tripped over its own tail. Growth is messy. Ask anyone who has done any.",
      "*|Rocks, walls and the quiet pressure of being watched. You carried a great deal, and you carried it farther than I expected.",
      "*|It is a gloomy place and you went in anyway. I admire that, and I am a little worried about you.",
      "*|Every run teaches something. This one taught humility, which is the least popular subject in any school.",
      "*|Rest a moment, then return. The rocks will have missed you. They will not say so. Rocks never say so."
    ],
    "insane": [
      "w|{name} reached the wall at tremendous speed. I would like to call that courage. It was momentum, but courage is the kinder word.",
      "w|The walls here are just as hard as anywhere else. You simply reached them sooner, which is the trouble with the future.",
      "w|{name} found the wall earlier than planned. Speed makes everything arrive early, and very little of it arrives politely.",
      "s|{name} got dizzy and hugged itself. So fast, so brave, so terribly knotted. It could have been worse. I am not sure how.",
      "s|At this speed, colliding with oneself is a rite of passage. I keep a certificate for it in my desk, should you ever want one.",
      "s|{name} is long, fast and a little confused. It is difficult not to be fond of that combination. I have been it, at parties.",
      "p|{name} ate a poisonous popsicle. Most make that mistake only once. You, I see, are thorough.",
      "p|The popsicle looked so innocent. They always do. Innocence is the most dangerous flavor, and it is always blue raspberry.",
      "p|{name} trusted a popsicle, which is a lovely quality in a snake, and a fatal one, as lovely qualities so often are.",
      "*|To survive the Ice Parlor for any time at all is remarkable. To do it gracefully is a rumor, started by people who never tried."
    ],
    "chaos": [
      "s|So many apples, so little room. {name} did its best, and its best, regrettably, was a pretzel.",
      "s|{name} grew too large for the board. It is a good problem to have and a terrible one to end on.",
      "s|At that speed, running into yourself is practically inevitable, and inevitable things are nobody's fault. That is their one comfort.",
      "s|{name} became a very long knot. There is an art to it, though I would never tell {name} so, for fear of encouraging it.",
      "s|Too much snake and too little space. It is the oldest story there is, and it never becomes any less sad.",
      "s|{name} ate so well it forgot where it was going, which, I am sorry to say, is the plot of a great many lives.",
      "*|Chaos is chaos, and you rode it like someone who was never told it could not be ridden. That is a compliment.",
      "*|That was a tremendous number of apples. {name} is full, and content, and, for the moment, finished.",
      "*|Nobody tames the storm on the first try. Or the tenth. I am fairly confident about the tenth. I was there.",
      "*|Breathe. Blink. That was a great deal of everything, and you were standing directly beneath all of it."
    ],
    "mirror": [
      "s|The edge sent {name} somewhere strange, and it bumped into itself. That was not fair, and I will say so in writing.",
      "s|{name} stepped out of one wall and directly into its own tail. There is no luck like bad luck. It is so dependable.",
      "s|This hall is confusing. {name} did remarkably well for a creature that could no longer find up.",
      "s|{name} lost track of which way was which. This is also my chief weakness, and I narrate for a living.",
      "p|{name} ate a popsicle. In fairness, there were a great many of them, and only one {name}.",
      "p|So many popsicles and only one stomach. Sooner or later the arithmetic was going to win.",
      "p|{name} has a brain freeze. It will pass. I am not told when. I am only ever told that things will pass.",
      "*|You never knew which wall was coming next, and still you kept up. I admire you, mildly, in a way I find hard to express.",
      "*|This hall scrambles everyone. You did splendidly. I would tell you otherwise if it were true. It is mostly true.",
      "*|Reflect, regroup, retry. {name} is ready. So, I suspect, is the reflection, and I wish it were not."
    ],
    "treasure": [
      "w|The board was enormous, and {name} still found the wall. That takes a particular sort of talent, and a particular sort of wall.",
      "w|{name} bumped the wall: a tiny snake, a large heart and a medium-sized bruise.",
      "w|The wall was nearer than it looked. That is true of most things, almost all walls and nearly every deadline.",
      "s|{name} got tangled while chasing treasure. I assume it was worth it. Nobody has shown me the treasure.",
      "s|Five new segments at once is a great deal to manage. You did your best, and your best was very long.",
      "s|A tiny noodle, a large knot. Next time it may be a smaller knot. That is how progress looks, most days.",
      "p|That enormous popsicle hit hard. {name} fought bravely, for something that is, after all, the size of a snack.",
      "p|{name} ate a popsicle, believing it to be treasure. It is an easy mistake. I have made worse ones, at auctions.",
      "*|Treasure hunting is a risky business. {name} knew it and went anyway, which is admirable or foolish, and usually both.",
      "*|The treasure will still be here next time. Treasure is very patient. It has nowhere else to be."
    ],
    "endless": [
      "w|{name} brushed the wall as the tunnel squeezed in. Tunnels are not known for their patience, or their manners.",
      "w|The walls moved and {name} did not. It is the oldest misunderstanding in the world, and it is nobody's fault.",
      "b|The world scrolled on a little too quickly for {name} this time. It may be gentler next time. I make no promises. I never do.",
      "b|{name} fell behind. It happens. It is happening to all of us, I am sorry to say, in one way or another, constantly.",
      "s|Weaving is hard, and {name} tied a small knot in itself. I have done the same, with a scarf, at a funeral.",
      "s|{name} doubled back on itself. It is easy to do at this speed and nearly impossible to undo, like most of my decisions.",
      "p|{name} could not dodge that popsicle. There were so many of them, and only the one {name}.",
      "p|One popsicle got through. You dodged a great many first, and I want you to know I noticed every one.",
      "*|It is called Endless because it never ends. You simply took a rest, and the rest happened to be permanent. For now.",
      "*|Every run takes you a little further. {name} is proud of you, and I am, in my distant and complicated way, impressed."
    ],
    "labyrinth": [
      "w|{name} took a wrong turn. Mazes are made almost entirely of wrong turns, with a few right ones scattered in for flavor.",
      "w|That wall was not on the map. In fairness, there is no map. There never has been. That is rather the point of mazes.",
      "w|{name} found a dead end the hard way, which, in a labyrinth, is the only way anything is ever found.",
      "s|All those corridors, and {name} bumped into itself. It is relatable, as most misfortunes are, if you let them be.",
      "s|The maze grew twisty, and so did {name}. I believe the two of them have a great deal in common.",
      "p|A popsicle was waiting around the corner. They like corners. Corners are where they do their best work.",
      "f|{name} ran into a hot spot in the maze. It is easy to do, hard to undo and impossible to forget, like a bad haircut.",
      "f|The fleas in this maze are very good at their jobs. {name} did well anyway, and the fleas will remember it fondly.",
      "*|Every maze is different, and you are getting better at all of them. I mean that sincerely, in a mild and distant way.",
      "*|Lost for now, found next time, perhaps. {name} believes in you. That is not nothing. It is, in fact, quite a lot."
    ],
    "inferno": [
      "w|{name} bumped a wall in all that heat. It is understandable. Walls are hard to see through smoke, and harder through tears.",
      "w|The inner walls sneak up on everyone. It is their only hobby, and they have become very good at it.",
      "w|{name} met a wall. At least the wall was not on fire. I notice how low I have set the bar, and I am at peace with it.",
      "s|A small snake, a large knot. {name} gave everything it had, and everything it had was, unfortunately, knot.",
      "s|{name} got tangled in the chaos, which is what chaos is for. I am sorry. I did not make the rules. I only read them aloud.",
      "p|{name} grabbed a popsicle to cool off. It was an understandable decision, made under unreasonable conditions.",
      "f|{name} got a little too close to the fire. Brave, in a way that will leave a mark.",
      "f|Those fleas. {name} will be ready for them next time, and the fleas will be somewhere else, laughing, as fleas do.",
      "*|That was a hot run, and you endured a great deal of it. I am fanning myself with a theater program as I write this.",
      "*|A deep breath, a glass of water, and back into the Furnace. I will narrate from a safe and shady distance."
    ]
  },
  "dramatic": {
    "easy": [
      "s|And so {name}, undefeated by wall or beast, was undone by the one pursuer it could never outrun: itself.",
      "s|It is a sorrowful truth that the tail is always the last to arrive and the first to take offense.",
      "s|{name} coiled, {name} turned, and {name} discovered what had been following it all along. It was {name}.",
      "s|Here ended the journey of {name}, in a garden, on an ordinary afternoon, by its own teeth. History records few stranger ends.",
      "s|There are two kinds of enemies: those who approach, and those who follow. {name} met the second kind, which is always worse.",
      "*|The apples mourn. The grass is less moved. It is, after all, grass, and it has seen a great deal.",
      "*|A silence fell across the garden, the kind that comes before something dreadful. Nothing came. That was worse.",
      "*|Thus ends a tale of such small consequence that I am ashamed to have narrated it so beautifully.",
      "*|History will remember {name}. It will not remember why. History is very busy and has a dreadful memory for snakes.",
      "*|And the garden was quiet, save for the sound of a narrator pretending, without success, not to weep."
    ],
    "classic": [
      "w|The wall stood where it had stood for a thousand years, and {name} learned, too late, that stone does not negotiate.",
      "w|{name} charged the wall like a hero of old, which is to say briefly, gloriously and with a dreadful sound at the end.",
      "w|Some call a wall a patient obstacle. {name} would now like to disagree, but is no longer in a position to.",
      "w|It was not the wall's fault. It only did what walls have always done, which is wait for someone exactly like {name}.",
      "s|The danger, it transpired, was coming from inside the snake. In stories like this one, it always is.",
      "s|Betrayed by its own tail, {name} ended exactly where it had begun: wrapped around itself, in the dark, alone.",
      "s|In the end {name}'s only true rival was {name}, and rivalries of that sort are always short and always tragic.",
      "*|The classics always end in tragedy. It is practically what makes them classics, and it is a dreadful tradition.",
      "*|Lower the flags for {name}, a snake of the old ways, who met the oldest end of all.",
      "*|Thus closes another chapter in the long and largely miserable chronicle of the Snake."
    ],
    "challenge": [
      "w|The walls drew close like a sigh, and {name} answered them, as the doomed so often answer the things they ought to ignore.",
      "w|{name} faced the wall with courage. The wall faced back with bricks. It was not, in any sense, a fair contest.",
      "w|A worthy challenger fell at the edge of the world, which is precisely where challengers tend to fall.",
      "s|Consumed first by ambition, and then, in short order, by its own tail.",
      "s|{name} grew mighty, and then, as the mighty usually do, it grew tangled.",
      "s|The serpent circled once too often, and the circle, as circles have always done, closed.",
      "*|The rocks watched in silence. Rocks are good at silence. It is the whole of their personality.",
      "*|This was the Quarry, and it took its toll, and the toll, in this case, was everything.",
      "*|Halved scores, doubled sorrow. I would compose a lament, but it would be very short, and in a minor key.",
      "*|Somewhere a lone violin plays for {name}. It is slightly out of tune and slightly too small, and it will not stop."
    ],
    "insane": [
      "w|At impossible speed {name} met the immovable wall, and the universe did what it always does in such cases, which is nothing.",
      "w|{name} went out the way it had lived: far too fast, and without the faintest plan for the end.",
      "w|A blur. A crash. A pause in which the narrator searches for words. There are none. There never are.",
      "s|It went so fast it caught up with itself. It is poetic, in the way a falling piano is poetic.",
      "s|{name} outran everything in the world except the one pursuer that had always been attached to it.",
      "s|Speed, meet tail. Tail, meet speed. Farewell, speed. Farewell, tail. Farewell, everything.",
      "p|The popsicle was poison all along, and I had been hinting at it for several chapters, to no avail.",
      "p|A sweet treat, a bitter end, and a stick the exact color of regret.",
      "p|{name} took one lick of destiny. It was blue raspberry. Destiny is always blue raspberry.",
      "*|The Ice Parlor claims another brave soul. It is a long list, written in frost, and it is mostly snakes."
    ],
    "chaos": [
      "s|Drowned in apples and strangled by its own success, {name} was still, somehow, the most dignified thing in the storm.",
      "s|{name} became too great for the world to hold, and the world, which is small and ungenerous, did not try.",
      "s|The feast was endless. The snake was not. These two facts have never once gotten along.",
      "s|In the storm of apples {name} lost itself. Literally. It was right there. It was {name}. That was the problem.",
      "s|It ate everything there was, and at the very last, with nothing else left, it ate itself.",
      "s|Faster than thought and tangled like a necklace at the bottom of a drawer. It is a very sad drawer.",
      "*|Chaos reigns. {name} does not. That is the nature of reigns, and of chaos, and of snakes.",
      "*|From the storm no snake returns. I may not return either. Please give my regards to Marguerite.",
      "*|The apples keep falling, though no one is left for them to fall upon, and still they fall, forever.",
      "*|Let it be written: {name} dined magnificently, died young, and in that order."
    ],
    "mirror": [
      "s|Cast through a broken mirror, {name} met itself on the other side. It was not a joyful reunion. They seldom are.",
      "s|The glass lied, and {name} paid for the lie, and the glass did not so much as blush.",
      "s|{name} stepped through the looking glass and found its own tail waiting. Some doors are better left closed. Most, in fact.",
      "s|Reflections can be deadly, and one's own most of all, especially in a hall with no honest corners.",
      "p|In the hall of mirrors the popsicles multiplied, and every one of them was a small and colorful catastrophe.",
      "p|A frozen curse from the far side of the glass, bearing the flavor of a dreadful idea.",
      "p|{name} tasted the poison of the mirror realm, which, according to the most reliable sources, is mostly raspberry.",
      "*|Seven years of bad luck, and {name} spent them all at once. It is a thrift I cannot recommend.",
      "*|Which wall was real? None of them. Only the ending was real, and endings have never once lied.",
      "*|The mirror shatters. {name} is lost between two worlds, and neither world appears to have noticed."
    ],
    "treasure": [
      "w|So near to fortune, so very near to the wall, and the wall had the better angle.",
      "w|{name} sought treasure and found only stone, which is treasure to a geologist and a tombstone to everyone else.",
      "w|The map promised that X marked the spot. The wall, it turned out, was the spot.",
      "s|Greed coiled around {name} until it could no longer move. That is the usual order of greed, and its usual ending.",
      "s|Riches beyond measure, and one tail too many. The tail had not asked to be involved.",
      "s|The true treasure, it turned out, was the knots we tied along the way. I regret saying that. It is nonetheless true.",
      "p|A cursed popsicle guarded the hoard, as is traditional, and {name} was unfamiliar with the tradition.",
      "p|The poison lay hidden among the jewels. It was the least decorative of the jewels. It was also the most blue.",
      "*|Every treasure carries a curse. This one's curse, it transpired, was {name}.",
      "*|Here lies {name}: tiny in size, vast in ambition, and now, regrettably, mostly just here."
    ],
    "endless": [
      "w|The tunnel narrowed, and fate narrowed with it, and between the two there was no room left for a snake.",
      "w|The walls closed like a mouth, and {name}, being the thing inside the mouth, noticed rather too late.",
      "b|The world moved on and {name} was left behind, the most ordinary tragedy there is, and the most common.",
      "b|Time waits for no snake. It barely waits for the narrator, and I have a contract.",
      "s|On the endless road {name} crossed its own path one final time, and discovered it had been here before.",
      "s|The journey looped back upon itself, as all journeys do, though few do it so literally or so fatally.",
      "p|A lone popsicle upon the endless road, and fate, being fate, did not look away.",
      "p|{name} dodged a hundred poisons. The hundred and first was sweeter. The last ones always are.",
      "*|Endless, they called it. For {name} it ended, and the word was quietly retired with full honors.",
      "*|The road goes on forever. {name} does not. It is a very long road, and {name} was a rather short snake."
    ],
    "labyrinth": [
      "w|The walls closed in and there was no way out, which is, one might observe, the entire premise of a labyrinth.",
      "w|{name} wandered the endless halls until the halls prevailed. They had, after all, a great deal more practice.",
      "w|Every path leads somewhere. This one led to a wall, which is somewhere, technically, and nowhere, practically.",
      "s|Lost in the maze, {name} found only itself, and itself was standing in the way.",
      "s|The labyrinth twisted, and {name} twisted with it, until for one terrible moment the two could not be told apart.",
      "p|Hidden in the maze, a frozen doom waited patiently, which is the only way a frozen doom knows how to wait.",
      "f|Fire in the corridors, fleas in the shadows, and {name} somewhere in between, wishing for a smaller maze and a larger life.",
      "f|The maze had teeth, and a great many of them were fleas. I would rather not have told you that.",
      "*|The labyrinth keeps its secrets, and now it keeps {name}, and it has never once given anything back.",
      "*|Somewhere deep in the maze a legend ends. The maze, for its part, does not notice. Mazes never do."
    ],
    "inferno": [
      "w|Walls within walls, and {name} met one head on, as is traditional, and as is not recommended.",
      "w|The Furnace has many chambers, and {name} found the wrong one, and that is all that will be said about it.",
      "w|In the heat of battle the wall did not move. It had, I am told, been asked very nicely.",
      "s|Coiled in the flames, {name} became its own undoing, which is a neat trick, and not one I would care to repeat.",
      "s|A tiny serpent tangled in a burning world, and the world, regrettably, was not tangled at all.",
      "p|Even in the Furnace the popsicle's curse is cold. It is the only cold thing here, and it knew it.",
      "f|The flames rose, and {name} rose with them, briefly, and then, as is customary, did not.",
      "f|Scorched by fire or felled by fleas, the result is the same, and not, I am afraid, a very interesting one.",
      "*|Ashes to ashes, apples to apples, and snakes to a rather smoky sort of dust.",
      "*|The Furnace claims another. It always does. It never sends flowers, and it never attends the service."
    ]
  },
  "brutal": {
    "easy": [
      "s|{name} ate itself. In the Garden. Please read that sentence again, slowly, and consider where things went wrong.",
      "s|There was no wall. There was no hazard. There was you, your tail and a decision.",
      "s|I am not angry. I am merely recording, in permanent ink, the tail you chose to turn into.",
      "s|This garden has precisely one obstacle, and it is attached to the snake. Congratulations on finding it.",
      "s|You had the entire garden and chose the one square already occupied. By {name}. Who was you.",
      "*|The tutorial remains available, should you wish to revisit it. This is not a request. Well. It is, a little.",
      "*|Somewhere a small child has just beaten your score, and the child was not even playing. The child was eating cereal.",
      "*|I narrated that run with a sense of hope. I have since revised my sense of hope downward.",
      "*|The Garden. It was the easy one. It was the one thing it promised.",
      "*|{name} deserved a narrator with more to work with. Instead it got me, and I got you, and here we all are."
    ],
    "classic": [
      "w|{name} saw the wall. {name} chose the wall. I would like you to sit quietly with that for a moment.",
      "w|The wall did not move. That is the entire wall. That is its whole personality, and you still lost to it.",
      "w|You drove straight into a wall as though it owed you money. It did not. I checked its accounts.",
      "w|There are four directions, and three of them did not contain a wall. I mention it only for the record.",
      "s|{name} ate itself. A bold strategy. I narrate bold strategies for a living, and this was a new low.",
      "s|You had the whole board and picked your own tail. Interesting. Unwise. But interesting.",
      "s|That turn was confident, decisive and completely wrong, a dreadful combination and, I notice, your favorite.",
      "*|Classic is simple. You made it complicated, and I find I must respect that, slightly, against my will.",
      "*|People played this on telephones the size of bricks and did better. They did not have a narrator. Lucky them.",
      "*|That run will not appear in any highlight reel. There is no highlight reel. There is only me, and my notebook."
    ],
    "challenge": [
      "w|Faster than Classic, same mistakes. Consistency is a virtue, I am told, though apparently not this one.",
      "w|The wall was stationary. You were not. This is called physics, and physics has never once lost an argument.",
      "w|You turned late. The wall was early. Both facts have been entered into the ledger.",
      "s|You grew long and immediately forgot how to steer, like someone learning to walk, backwards, down a staircase.",
      "s|{name} bit itself. The rocks are laughing. I cannot hear them, but I can feel it.",
      "s|You tied a knot. This is not a knot-tying game. I will not be taking questions.",
      "*|The rocks took half your score. You took care of the rest, in your own special way.",
      "*|Challenge accepted. Challenge failed. The Quarry, I hear, is having a lovely evening.",
      "*|That run was a learning experience. Please learn from it. I will be here. I am always here. It is my curse.",
      "*|Well. You tried. Technically. I use that word with enormous care."
    ],
    "insane": [
      "w|Top speed, no steering. I admire the minimalism, if nothing else, and there is nothing else.",
      "w|You hit that wall like you had somewhere important to be. You did. It was the wall.",
      "w|That wall is filing a complaint. I have been asked to deliver it to you personally.",
      "s|So fast, so long, so very wrong. The three often travel together, but rarely with such enthusiasm.",
      "s|You were not racing anyone but your own tail. You lost. To the tail. By being the tail.",
      "s|The only thing faster than {name} was the mistake. They arrived together, which is rare, and nearly impressive.",
      "p|It was blue. It was obviously a popsicle. {name} ate it anyway, and I narrated it in real time, in horror.",
      "p|You ate poison on purpose. Bold. Wrong, but bold. I would take a photograph, if I could bear to.",
      "p|The popsicle did not move. You went to it. I would like that noted in the official record.",
      "*|Insane mode, sensible result. No one is surprised, least of all the apples."
    ],
    "chaos": [
      "s|There were a hundred apples and you still found your own tail. That is a talent, of a sort. The wrong sort.",
      "s|You ate until you were a maze, and then you got lost in the maze. It is the most efficient failure I have witnessed.",
      "s|Too greedy, too fast, too tangled. I am not saying it is a pattern. I am saying it is your pattern.",
      "s|The snake grew. The plan did not. I am assuming there was a plan. Was there a plan?",
      "s|{name} grew faster than your reflexes, and your reflexes, sadly, were not consulted.",
      "s|You did not lose to Chaos. You lost to spaghetti. The spaghetti was you. It is a metaphor, but only barely.",
      "*|Chaos is working exactly as intended. So, I am afraid, are you.",
      "*|That was not a strategy. That was panic, with apples. I have seen both, and I know the difference.",
      "*|Chaos won. It usually does, but you made it very easy. It has sent a thank-you note.",
      "*|Excellent eating. Dreadful everything else. I would put it on a plaque, but the plaque would be very small."
    ],
    "mirror": [
      "s|Random wall, random exit, predictable ending. Fate supplied the first two. You supplied the third.",
      "s|You popped out of a wall and straight into yourself. Genuinely remarkable. I cannot stop thinking about it, and I have tried.",
      "s|The mirror scrambled the exits. You scrambled the rest. We are, in a sense, a team, and not a good one.",
      "s|{name} came out of the wrong wall and made the wrong turn. Wrong twice. A rare double. I may have it framed.",
      "p|More popsicles than ever, and you still chose one. I record that as a pattern rather than a surprise.",
      "p|You survived the walls only to lose to a popsicle. It is somehow less dignified than losing to the wall.",
      "p|{name} saw a popsicle and thought: surely not me. It was you. It is nearly always you.",
      "*|The hall showed you your true reflection. I will not be repeating what it said.",
      "*|The walls are random. Your mistakes are not. I have never seen anything so reliable.",
      "*|Seven years of bad luck. You started early. I respect the initiative, if nothing else."
    ],
    "treasure": [
      "w|A tiny snake on a giant board, and you still hit the wall. It is a genuine feat of anti-navigation.",
      "w|You had twice the room and used none of it. I should like that engraved somewhere, or at least filed.",
      "w|The treasure was not inside the wall. You checked anyway. That is the part I find most moving.",
      "s|Greedy for big apples, you forgot your own tail. Your tail did not forget you. Tails never do.",
      "s|Five segments at once and no thoughts at once. I admire a strict adherence to a theme.",
      "s|You wrapped yourself up like a present nobody wanted. I am still deciding whether to return you.",
      "p|Big popsicle, double damage, no hesitation. Committed, in a way. In a way.",
      "p|You thought the big popsicle was treasure. It was a popsicle. It was not even a pretty one.",
      "*|X marks the spot where it all went wrong. It is an enormous X. It is very visible. You did not see it.",
      "*|The treasure is still out there. You are not. That is the story, if you would like it as a story."
    ],
    "endless": [
      "w|The walls gave you room. You gave it back. It was very polite of you, and very fatal.",
      "w|You hugged the tunnel wall. It did not hug back. It never does. It is a wall, and you knew that.",
      "b|The screen left without you. Rude, but earned. It did say goodbye. You were not listening.",
      "b|You were overtaken by a background. I did not know that was possible, and I have narrated a great many things.",
      "s|An endless road, and you parked on your own tail. Historians are calling it a first.",
      "s|You had one task: go right. You went mostly right. Mostly is not a direction.",
      "p|You were meant to dodge the popsicles. That is the whole place. That is the place.",
      "p|{name} swerved into the one thing it was trying to avoid. Irony, to me. A Tuesday, to you.",
      "*|An endless road. Not endless talent. I would print that on the box, but the box has already been printed.",
      "*|It never ends, but you certainly do. I could have phrased that more gently. I chose not to."
    ],
    "labyrinth": [
      "w|It is a maze. Walls are rather the point. I am only now realizing that no one told you.",
      "w|You had four directions and picked the wall. It is the one direction I would not have picked.",
      "w|Dead end. Literally. I do not make these jokes lightly, though I do, I admit, make them often.",
      "s|You got lost in a maze and bit yourself out of spite. I have seen it before. It is no more attractive now.",
      "s|The maze had plenty of room, and you used your own tail instead. A frugal sort of failure.",
      "p|You found the one popsicle in the entire maze. Impressive, in the way a lightning strike is impressive.",
      "f|Fire in a maze, and you slithered right into it. It was, I must say, the straightest line you drew all run.",
      "f|Fleas outsmarted you in a maze. Please let that settle, and then please sit with it a while.",
      "*|You were lost the whole time. Now you are merely finished. It is, strictly speaking, an improvement.",
      "*|The maze wins. The maze always wins. You may have noticed that I am not saying anything new."
    ],
    "inferno": [
      "w|Walls in the middle of the board. You saw them. You hit one. You are, in your way, consistent.",
      "w|That wall was there before you and will be there after you. This is not a threat. It is a floor plan.",
      "w|Tiny snake, giant mistake. It is catchy. I have already had it printed on a shirt, in your size.",
      "s|You tied yourself in a knot in a room full of fire. That is a great many poor choices in one small place.",
      "s|A smaller snake, the same steering. I would recommend a bigger snake, but I suspect the steering is the problem.",
      "p|You were hot, so you ate poison. It is sound logic, if the goal was to become a cautionary tale.",
      "f|It was on fire. You touched it anyway. I have no further questions, and I am not sure I had any before.",
      "f|You lost to fleas. Fleas. I would like you to say that aloud, slowly, to an empty room.",
      "*|The Furnace did its job. You did not. It was a small job, but it was the only one.",
      "*|Hot take: that was a poor run. It is not even a hot take. It is the room temperature of takes."
    ]
  }
};

const narratorHistory = {};

/* Picks a line that fits the cause and wasn't used in the last few deaths */
function getCommentary(cause) {
  const byMode = NARRATION[save.settings.commentary];
  if (!byMode) return "";
  const pool = byMode[currentModeKey] || byMode.classic;
  const lines = pool.map(entry => {
    const bar = entry.indexOf("|");
    return { tag: entry.slice(0, bar), text: entry.slice(bar + 1) };
  });

  let fits = lines.filter(l => l.tag === "*" || l.tag === cause[0]);
  if (!fits.some(l => l.tag !== "*") && cause === "behind") {
    fits = lines.filter(l => l.tag === "*" || l.tag === "w");
  }
  if (!fits.length) fits = lines.filter(l => l.tag === "*");
  if (!fits.length) return "";

  const key = save.settings.commentary + ":" + currentModeKey;
  const recent = narratorHistory[key] || [];
  const fresh = fits.filter(l => !recent.includes(l.text));
  const choices = fresh.length ? fresh : fits;
  const pick = choices[Math.floor(Math.random() * choices.length)];

  narratorHistory[key] = [pick.text, ...recent].slice(0, Math.min(4, Math.max(1, fits.length - 1)));
  return pick.text.split("{name}").join(save.settings.snakeName || "Noodle");
}
