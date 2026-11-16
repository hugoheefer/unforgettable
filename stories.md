# User stories in detail

Written 2026-11-16. `plan.md` says why and in which order; this file says exactly what each story contains. Stories 0 to 3 (the new core) are complete: build them as written. Stories 4 to 8 are detailed to screens and rules and are marked **revisit**: the user plays the core first and their findings may change them.

Screen notation: `lead` lines are the small grey lines, **command** is the big line, `( )` are choices, `[Next]` is always there. `{…}` is filled in.

## Shared decisions (all stories)

**Words.** A *thing* is what you can lose (code: `thing`, replacing `item`). A *home spot* is its fixed place. A *step* is the unit of effort. A *day* is one play session of events.

**Modules after story 3** (each with its own test file):

| Module | One responsibility |
|---|---|
| `world.js` | where things and garments are; distances; snapshot and restore |
| `things.js` | the catalogue of things: id, icon, group, carry, default home, uses (ids and rooms only) |
| `layout.js` | rooms, spots, garments, pockets: ids, icons, exits |
| `texts.js`, `texts/en.js` | languages table; every sentence and name |
| `scenario.js` | builds the list of events of a day (uses `RandomSource`) |
| `day.js` | runs the events: actions, step counting, what is in hand |
| `history.js` | records of finds and placements; statistics computed from them |
| `habit.js` | streak and hint level |
| `summary.js` | the day summary as data |
| `play-flow.js`, `setup-flow.js`, `app-flow.js` | steps (command and choices) |
| `save-store.js` | load, validate, merge and save |
| `screens.js`, `main.js` | drawing and wiring only |

**Save, version 2** (every field validated on load and merged with its default; one bad field never loses the rest):

```
{ version: 2,
  language: 'en',
  things: ['keys', 'wallet', 'phone', 'scissors'],        // chosen ids; unknown ids dropped
  plan: { keys: { placeId, spotId } | { garmentId, pocketId } },
  progress: { streaks: { keys: 3 } },
  world: { things: { keys: <location> }, garments: { coat: 'worn' | { placeId, spotId } } },
  day: null | { number, events: [...], index, roomId, inHand: ['keys'], steps: 0 },
  dayCount: 0,                                            // finished days
  history: { finds: [...], puts: [...] },                 // story 3
  realLife: { lastAsked: null, turn: 0, answers: [], places: {} }   // story 6
}
```

**Rules for texts (so a second language is one file).** Logic never glues words together and never uses a pronoun or verb form that depends on the thing ("it/them", "is/are"): sentences repeat the name. Every name comes with the forms a sentence needs:

```
things:   { keys: { name: 'keys', your: 'your keys' } }
rooms:    { hall: { name: 'Hallway', in: 'in the hallway', to: 'to the hallway' } }
spots:    { hook: { name: 'Key hook', at: 'on the key hook' } }
garments: { coat: { name: 'Coat', your: 'your coat' } }
pockets:  { 'coat-left': { name: 'Left pocket', at: 'in the left pocket of your coat' } }
```

Sentences are strings or functions of such entries: `putAwayCommand: ({ room, thing }) => \`You are ${room.in}. Put ${thing.your} away.\``.

**One addition to "only a command and choices"** (needs the user's eye in story 2): a small "Menu" link above the lead lines on every screen of a day. It goes to the start screen; the day is saved and can be continued. Without it there is no way out of a day.

---

## Story 0: refactor first (no behaviour change)

**Why.** The next stories add flows and move texts; the seams must be right first.

1. **Golden test first, on the unchanged code.** `tests/golden.test.mjs` plays one whole scripted round through `AppFlow` with the deterministic random (`pick` first, `shuffle` unchanged) and compares the list of every `step()` with `tests/fixtures/golden-round.json`. The fixture is generated once from the current code and committed in its own commit. Script: play; hang the coat on the coat hooks; keys in the right coat pocket; wallet on the shoe rack; walk to the kitchen; phone on the counter; scissors in the back pocket; Next on the distraction; then find all four by the shortest way.
2. **One flow contract.** `step()`, `choose(id)`, `next()`, `isFinished()`. `AppFlow` passes each flow an `onFinished` callback at creation and has no `instanceof`. A shared contract test (`tests/flow-contract.mjs`, a function called by each flow's test file) checks for any flow: `choose` of an id not on the screen throws; `next` without a choice changes nothing when choices exist; `selected` is null after `next`.
3. `World.garmentSpot(garmentId)` returns the spot or null when worn; `room-view.js` uses it and no longer reads `garmentPlaces`.
4. `play-flow.js`: "You put your coat on" uses the garment's name.

**Done when** the golden test and all 134 tests pass, with one new test for 3 and one for 4 (both written red first).

---

## Story 0b: texts ready for a second language

**Why.** English only for now; adding Dutch later must be one translated file and one table row.

1. `app/js/texts/en.js` exports `en`: the names (forms as in "Rules for texts") and every sentence now written in `play-flow.js`, `setup-flow.js`, `app-flow.js`, `round.js` (pressures, distractions, notices) and `room-view.js`. `layout.js` loses `name` and `findPrompt` and keeps ids, icons and structure.
2. `app/js/texts.js`: `LANGUAGES = [{ code: 'en', name: 'English', texts: en }]` and `textsFor(code)` (unknown code gives English).
3. Flows and views get `texts` injected through their constructor; only `texts.js` imports `en.js`. `main.js` passes `textsFor(save.language)`.
4. The wording may change where a sentence glued fragments together (for example `.toLowerCase()` on a garment name). Regenerate the golden fixture once, in its own commit, and list in the commit message every sentence that changed.

**Tests (red first).**
- `texts.test.mjs`: every room, spot, garment, pocket and thing id of the layout has an entry with all its forms as non-empty strings; `textsFor('xx')` is English; for every language in the table, every key of `en` exists with the same kind (string or function).
- A fake language in the test (`{ ...en, notHere: 'NIET HIER' }`) passed to `PlayFlow` shows up on the screen: proves the flow uses the injected texts.
- A scan test: no file in `app/js/` except `texts/*.js` contains a string literal with a space and three or more letters on both sides of it (a whole phrase). Error messages thrown for programming mistakes are exempt by living in one `errors.js`.

**Mutation checks.** Remove `rooms.hall.in` from `en.js` (the contract test names it). Import `en` directly in `play-flow.js` and ignore the injected texts (the fake-language test fails).

---

## Story 1: the world persists

**Why.** Forgetting needs time. Where a thing is left must still be true tomorrow.

**Rules.**
1. `world.snapshot()` gives `{ things, garments }` as in the save. `World.restore(layout, snapshot)` builds a world from it. Anything invalid in a snapshot (unknown thing, spot, pocket or garment; a value that is not an object) is dropped silently: that thing is then *nowhere*, that garment is in its starting state.
2. `save-store.js` reads version 2. A save without `version` (the current format) keeps its `plan` and `progress` and gets the defaults for the rest. `things` defaults to the four current ids. `day` is dropped when any part of it is invalid (a new day then starts; the world stays).
3. Until story 2 exists the round still starts clean; this story only delivers snapshot, restore and the save format, wired so that `main.js` saves the world when a round ends and nothing reads it yet.

**Tests (red first).**
- A restored world answers `whereIs`, `isWorn`, `garmentsOn` and `itemsOn` like the original, for a world with a thing on a spot, a thing in a pocket and the coat hung on the coat hooks.
- `snapshot()` survives `JSON.parse(JSON.stringify(...))`.
- A snapshot with a spot that does not exist loses only that thing.
- A snapshot that is a string, null or an array gives an empty world, no error.
- An old save (plan and streaks only) loads with its plan and streaks, `version: 2`, an empty world and `day: null`.
- A save whose `day.index` is not a whole number loads with `day: null` and its world intact.
- A blocked storage still gives the defaults (existing test stays).

**Mutation check.** Let `restore` ignore the garments (the hung-coat test fails).

---

## Story 2: days made of events

**Why.** This is the heart: things are used around the house, put down where you are, and needed again later, also the next day.

### Rules

**Things nowhere.** At the start of a day every chosen thing that is nowhere arrives with you: the day starts with "You come home" and a put-away event for each. The first day ever is this rule with all things.

**The events of a day** (`scenario.js`, pure; the list is stored in the save so a reload gives the same day):

1. `pause`: "Day {n}."
2. If things are nowhere: `moveTo` hall (text `arrive`), then one `putAway` per such thing, in shuffled order.
3. Otherwise **leave and come home**: up to 3 chosen things with `carry: true`, picked at random (none chosen: skip this part).
   `moveTo` one of bedroom, kitchen, living (text `morning`); one `find` each (prompt `leaveFind`); `pause` (text `outForTheDay`); `moveTo` hall (text `arrive`); one `putAway` each.
4. **Two uses**, for two different chosen things picked at random, preferring things not used in part 3: `find` (the use's `need` text), `moveTo` the use's room (its `after` text), `putAway`.
5. At most one `putAway` of the whole day is in a hurry: with chance 1 in 2 one of them, picked at random, gets a hurry reason. Never on the first day.

**Event kinds** are one table (`EVENT_KINDS`) of objects with `enter(day, event)` and `isDone(day, event)`; `day.js` has no `switch` on the kind.
- `pause`: done on Next.
- `moveTo`: sets the room at once; never has a screen of its own. Its text becomes the first lead line of the next screen.
- `find`: done when the thing is found. The thing then leaves the world and is in hand.
- `putAway`: done when the thing in hand is put on a spot or in a pocket.

**Actions and their cost in steps** (counted per event):

| Action | Steps |
|---|---|
| Walk to a room | its distance (`stepsBetween`), any room in one go |
| Look at a spot or in a pocket | 1 |
| Take off the coat (hang it on a spot here), put it on | 1 |
| Put a thing down | 0 |

**Hurry.** During a hurried `putAway` only rooms at distance 1 are offered and accepted; everything else works. The lead says why.

**Streak** (replaces the forced drop and the points): putting a thing on its home spot adds 1. Putting it elsewhere sets the streak to 0, except in a hurry when the home spot could not be reached from where the event started (more than 1 step away, or in a pocket of a coat hanging further away): then the streak stays as it is.

**Reach, pockets, coat**: unchanged from `round.js`. Taking off and putting on the coat are offered during `putAway` only.

**Saving.** After every Next that changed something, `main.js` saves world, day (events, index, room, in hand, steps of the running event) and streaks. When the last event is done: `day` becomes null, `dayCount` goes up, and the summary shows (story 3; until then a plain "Day {n} is done").

**Removed**: `Round`, points, `movesLeft`, the interruption, the distraction texts, the `kind: 'container'` rule for the car (the story now decides the room). The golden fixture is deleted with them.

### Screens

Start screen:

```
**Unforgettable. Always put your things in the same place.**
( Start day 1 )            later: ( Continue day 3 ) or ( Start day 4 )
( Choose my home spots )
[Next]
```

Putting away, first question (moveTo text and feedback of the last action above it):

```
Menu
You come home.
The doorbell rings. No time to walk far.            only in a hurry
Your plan: on the key hook in the hallway.          only while the hint is shown
**You are in the hallway. Put your keys away.**
( Here, in the hallway )
( In a pocket )
( Walk to another room )
( Take off my coat )            or ( Put my coat on ) when it hangs here
[Next]
```

Then `Which spot?` with the spots of the room (the home spot starred while shown or dimmed), or `Which pocket?`, or:

```
**Where do you walk to?**
( Living room · 1 step )
( Kitchen · 1 step ) ★          the room of the home spot, while shown or dimmed
( Dining room · 2 steps )
...                              nearest first, then the order of the layout
( Choose something else )
[Next]
```

Finding, first question:

```
Menu
Your phone rings.
**Find your phone. You are in the living room.**
( Look here, in the living room )
( Look in a pocket )
( Walk to another room )
[Next]
```

Feedback lines (the lead of the next screen):

| Moment | Line |
|---|---|
| Put on the home spot | "Your keys are on their home spot." |
| Put elsewhere | "Your keys are on the sofa. Their home spot is the key hook in the hallway." |
| Looked, not there | "Not here." or "Not here. You see 👛 📱." |
| Found | "Found your keys on the key hook. 3 steps." |
| Coat hung | "Your coat hangs on the coat hooks." |
| Coat put on | "You put your coat on." |
| Refused (out of reach) | "That pocket is out of reach: your coat hangs in the hallway." |

Hurry reasons (one picked at random): "The doorbell rings.", "The pan is boiling over.", "Your phone rings in another room.", "You badly need the toilet.", each followed by "No time to walk far."

Other texts: `morning` "Morning. You are {room.in} and about to leave."; `leaveFind` "Find {thing.your}."; `outForTheDay` "You are out for the day."; `arrive` "You come home."

The uses of the four current things are in the catalogue at the end of this file.

### Tests (red first, one behaviour each)

`scenario.test.mjs`
- The first day starts with coming home and a put-away for every chosen thing.
- A later day with nothing nowhere has a leave part with only carry things, at most three.
- A day has two uses for two different things, each a find, a move to the use's room and a put-away.
- With one chosen thing the day has one use (no thing twice).
- No hurry on the first day; never more than one hurried put-away in a day.
- The events are plain data: they survive a JSON round trip unchanged.
- Every `find` in a day is for a thing that is somewhere at that moment (a thing put away earlier, or already in the world).

`day.test.mjs`
- A thing left on the sofa on day 1 is on the sofa at the start of day 2.
- After a find the thing is in hand and no longer on its spot.
- A use ends with the player in the use room, holding the thing, asked to put it away.
- Walking to a room two doors away costs two steps and arrives there in one action.
- In a hurry a room at two steps is refused and a room at one step is accepted.
- Home spot placement adds one to the streak; another spot sets it to zero.
- In a hurry with the home spot out of reach, another spot leaves the streak as it was; with the home spot in reach it sets it to zero.
- A day restored from its saved state in the middle of a find continues with the same event, room, steps and world.
- Looking costs one step whether or not the thing is there.
- A thing in a pocket of the coat that hangs in the hallway is found by walking there and looking in that pocket; from another room that pocket is refused.
- When the last event is done the day is finished and the day count goes up.

`play-flow.test.mjs` (rewritten for days)
- The walk list shows every other room with its distance, nearest first.
- While the hint is shown the room of the home spot is starred in the walk list and the plan is named; with a long streak neither.
- The text of a `moveTo` is the first lead line of the next screen, and gone on the screen after.
- In a hurry the reason is shown and far rooms are not in the list.
- A `pause` is a screen with no choices and an enabled Next.
- The flow passes the shared flow contract.

`app-flow.test.mjs`
- A new player is offered "Start day 1"; with a saved day in progress "Continue day {n}"; after a finished day "Start day {n+1}".
- Menu during a day returns to the start screen and the day can be continued where it was.
- Changing home spots between two events of a day applies to the next put-away.

**Mutation checks.** Start every day with an empty world (the sofa test fails). Offer every room in a hurry.

**Look at it.** Playwright at 390 px: play day 1 and the start of day 2; screenshots of the first put-away screen, the walk list and a find; check that the Menu link does not draw the eye.

---

## Story 3: what a find costs, and the day summary

**Why.** The player must see in numbers what the home spot saved, the same day.

**Rules.**
1. `history.js` (pure). When a `find` ends: `{ day, thingId, steps, shortest, wasHome }`. `shortest` is the distance from the room where the event started to the room where the thing was, plus 1; for a pocket of a worn garment it is 1. `wasHome` is whether the thing lay on its home spot when the event started. When a `putAway` ends: `{ day, thingId, steps, atHome, hurry }`. The last 300 of each are kept.
2. `summary.js` (pure) turns the records of one day and the world into data: things on their home spot tonight, things elsewhere (with where), steps searched, steps that were possible (sum of `shortest`), steps spent putting away, and an advice key.
3. Advice, one table, first match wins: no find today → `noSearch`; searched more than twice the possible → `costly`; everything on its home spot tonight → `allHome`; otherwise → `someAway`.

**Screen.**

```
Menu
On their home spot tonight: keys, wallet.
Somewhere else: phone (on the garden table).
Searching cost 9 steps today. With everything on its home spot: 4.
Putting things away cost 5 steps.
A thing on its home spot is found without thinking.          the advice line
**Day 3 is done.**
( Start day 4 )
( Back to the start )
[Next]
```

Advice texts: `allHome` "Everything is in its place. Tomorrow you will find it without thinking."; `someAway` "Remember where {things} are? Tomorrow you will know."; `costly` "Most of today's steps went into searching. A fixed place costs a few steps once."; `noSearch` "Nothing to search for today." (this line then replaces the searching line).
Below the choices, as the last lead line when the day was started on the same date as the one before: "Come back tomorrow. A night in between is the real test." (needs the `Clock` port: `today()` gives `YYYY-MM-DD`; add it here, with a fixed-date double for tests).

**Tests (red first).**
- A thing found on its home spot in the room where the event started records 1 step, 1 possible, was home.
- Looking at three wrong spots first records 4 steps and 1 possible.
- A thing two rooms away found by the shortest way records 3 and 3.
- A thing in a pocket of the coat you wear records 1 possible.
- The summary's possible steps are the sum of the shortest ways of that day only.
- A day without a find gives the `noSearch` advice and no searching line.
- Each advice row is reached by a day built for it (four tests).
- Record 301 pushes the oldest out.
- Records that are not objects or miss a number are dropped on load.

**Mutation checks.** Let `shortest` forget the +1 for looking. Let the summary add up all days.

**After this story: mirror to the preview and stop. The user plays several days before story 4 is started.**

---

## Story 4: progress in the player's own numbers (revisit)

**Screen**, reached from the start screen with ( My progress ):

```
From their home spot you found things in 2 extra steps on average.
From anywhere else: 7 extra steps.
On their home spot at the end of the day: 4 of 6 things (last 7 days: ▁▃▅▅▇▇▇).
Streaks: keys 6, wallet 6, phone 2, scissors 0.
**My progress**
( Back )
[Next]
```

**Rules.** Extra steps of a find = `steps - shortest`. The comparison is shown only when both groups have at least 3 finds; otherwise "Play a few more days to see the difference." The bar per day is the share of put-aways on the home spot that day. All computed from `history`; nothing new is stored.

**Tests.** The two averages use the right records; with 2 finds in one group the comparison is withheld; a day with no put-away is skipped in the bars; streaks come from `progress`.

---

## Story 5: first use, explanation and choosing things (revisit)

**First start** (no save), three screens, each a command and Next:
1. "Things get lost when you put them down without noticing."
2. "The cure is simple: one fixed place for each thing, every time. Then your memory has nothing to look up."
3. "Here you practise that. You live through short days in a house. Walking and searching cost steps. Fewer steps is better."

**Choosing things.** A new kind of step: several choices may be on at once (`multi: true`; Next always enabled). One screen per group, "Which of these do you want to practise with?": every day (keys, wallet, phone, glasses, bag); cards and papers (bank card, driver's licence, car papers); music (cymbal bag, drumsticks, headphones); around the house (scissors, remote control, charger, umbrella, gate key). After the last group: fewer than 3 or more than 6 gives "You chose {n}. Choose 3 to 6 things." and returns to the first group with the choices kept.

**Home spots**, per chosen thing, starting with the suggestion:

```
**Where do you always want to keep your keys?**
( On the key hook in the hallway ) ★ suggested
( Somewhere else )
[Next]
```

"Somewhere else" gives the existing two questions (room or garment, then place).

**Start screen** gains ( How it works ), ( Choose my things ), ( Start again ). Start again asks "This erases your days and your progress. Start again?" ( Yes, erase everything ) ( No, keep it ).

**Rules.** A thing removed from the choice leaves the world; its plan and history are kept, so choosing it again brings back its home spot. A newly chosen thing is nowhere and arrives on the next day. The suggestion is the default home from the catalogue.

**Tests.** A new player gets the three screens and a returning one does not; 2 things chosen returns to the groups with them still on; a day only has events for chosen things; a removed and re-added thing has its old home spot; erasing gives a new player again; the multi step passes the flow contract.

---

## Story 6: the bridge to real life (revisit)

**Cards**, after the home spots, one per thing:

```
Say it out loud once.
**When I put my keys away, they go on the key hook in the hallway.**
[Next]
```

then a step with one text field (a third kind of step, `input: { maxLength: 60 }`; Next always enabled):

```
**And in your own home? My keys always go:**
[ in the blue bowl by the front door          ]
[Next]
```

**Daily question**, once per date, before the start screen, for one chosen thing in turn:

```
**In real life: are your keys in their place right now?**        with "(in the blue bowl by the front door)" when given
( Yes, in their place )
( No, somewhere else )
( I do not know )
[Next]
```

Answers: yes → "That is the habit."; no → "Put them there now if you can. Then they are there tomorrow."; do not know → "Go and look. Then put them in their place." shown as the lead of the start screen. The real-life streak per thing (consecutive "yes") is a line on My progress.

**Tests.** Asked once per date and not again that date; it takes the next thing each day and wraps around; "no" and "I do not know" set that thing's real-life streak to 0; a place text is kept after reload; a text that is not a string or longer than 60 characters is dropped on load; with no chosen things nothing is asked.

---

## Story 7: putting things back (revisit)

- A `quiet` event before the last use of a day, only when a chosen thing is away from its home spot: "You have a quiet moment. Is everything in its place?" ( Tidy up ) ( Leave it ). Tidy up asks "Which thing?" with all chosen things (the game does not say which are away). The choice inserts a `find` and a `putAway` for it; a thing found on its home spot gives "It was in its place." and no put-away.
- After a put-away somewhere else than home, the feedback line gets a second sentence: "Say it out loud: phone, garden table."

**Tests.** No quiet moment when everything is home; tidy up inserts the two events for the chosen thing; a tidied thing put home adds to its streak; "Leave it" changes nothing; the out-loud sentence only after a stray placement.

---

## Story 8: hand-over (revisit)

Every screen looked at on 390 px in light and dark; wording pass; `user-manual.md`; README; mirror to my-wiki's side branch; the user's go-ahead for `main`; the user plays three days on a phone and their findings become the next stories.

---

## Catalogue of things

`things.js` holds id, icon, group, carry, default home and the use ids with their rooms; `texts/en.js` holds the names and, per use, `need` and `after`. Icons are a first choice and must be looked at on a phone (there is no cymbal or drumstick emoji).

| Thing | Icon | Group | Carry | Suggested home |
|---|---|---|---|---|
| keys | 🔑 | every day | yes | key hook, hallway |
| wallet | 👛 | every day | yes | inside pocket, coat |
| phone | 📱 | every day | yes | counter, kitchen |
| glasses | 👓 | every day | no | nightstand, bedroom |
| bag | 🎒 | every day | yes | console table, hallway |
| bank card | 💳 | cards and papers | yes | inside pocket, coat |
| driver's licence | 🪪 | cards and papers | yes | inside pocket, coat |
| car papers | 📄 | cards and papers | no | glove box, car |
| cymbal bag | 🥁 | music | no | shelf, garage |
| drumsticks | 🥢 | music | no | shelf, study |
| headphones | 🎧 | music | no | desk, study |
| scissors | ✂️ | around the house | no | desk drawer, study |
| remote control | 🎛️ | around the house | no | coffee table, living room |
| charger | 🔌 | around the house | no | nightstand, bedroom |
| umbrella | ☂️ | around the house | no | umbrella stand, hallway |
| gate key | 🗝️ | around the house | yes | key hook, hallway |

Uses (`need` is the lead before "Find {your thing}."; `after` is the lead before "Put {your thing} away."; the room is where you end up):

| Thing | Room | need | after |
|---|---|---|---|
| keys | shed | "You need the spade and the shed is locked." | "The shed is open. You have the spade." |
| keys | car | "You left the shopping in the car." | "You are at the car with the shopping." |
| wallet | hall | "The pizza is at the door." | "You paid at the front door." |
| wallet | study | "You are ordering a book online." | "The order is placed. You are at your desk." |
| phone | garden | "Your phone rings." | "You walked around while talking. The call is over." |
| phone | bedroom | "You want to set the alarm for tomorrow." | "The alarm is set." |
| phone | kitchen | "You want to look up a recipe." | "Dinner is on the stove." |
| scissors | living | "A present needs wrapping." | "The present is wrapped." |
| scissors | garden | "You want to cut some flowers." | "The flowers are cut." |
| scissors | kitchen | "A package will not open." | "The package is open." |
| glasses | living | "You want to read the paper." | "You have read the paper on the sofa." |
| glasses | bathroom | "You cannot read the label on the bottle." | "You took your glasses off to wash your face." |
| bag | bedroom | "You have to pack for tomorrow." | "Your bag is packed." |
| bag | kitchen | "Your lunch box is still in your bag." | "The lunch box is in the sink." |
| bank card | study | "You are paying a bill online." | "The bill is paid." |
| bank card | hall | "A parcel has to be paid at the door." | "The parcel is paid." |
| driver's licence | study | "A form asks for the number of your licence." | "The form is sent." |
| driver's licence | dining | "You are booking a rental car at the table." | "The car is booked." |
| car papers | study | "The insurance asks for the registration." | "The form is filled in." |
| car papers | dining | "You are selling the car and the buyer is at the table." | "The buyer has seen the papers." |
| cymbal bag | car | "You have a rehearsal tonight." | "You are back from the rehearsal, at the car." |
| cymbal bag | living | "The cymbals need cleaning." | "The cymbals shine again." |
| drumsticks | living | "You want to practise on the pad." | "You practised on the sofa." |
| drumsticks | car | "You have a rehearsal tonight." | "You are back from the rehearsal, at the car." |
| headphones | garden | "You want music while you weed the garden." | "The weeding is done." |
| headphones | bedroom | "You want to listen to a podcast in bed." | "The podcast is over." |
| remote control | kitchen | "You want to watch the news." | "You walked to the kitchen for a drink with the remote in your hand." |
| remote control | dining | "You want to turn the sound down." | "You sat down at the table with the remote." |
| charger | study | "Your laptop is almost empty." | "The laptop is charged." |
| charger | living | "Your phone is almost empty." | "The phone charged next to the sofa." |
| umbrella | garden | "It rains and the washing is outside." | "The washing is in." |
| umbrella | car | "It pours and you have to get something from the car." | "You are at the car." |
| gate key | garden | "A delivery van is at the gate." | "The gate is open and closed again." |
| gate key | garage | "The bins have to go out through the gate." | "The bins are out. You came back through the garage." |
