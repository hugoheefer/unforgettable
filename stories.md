# User stories in detail

Written 2026-11-16. `plan.md` says why and in which order; this file says exactly what each story contains. Stories 0 to 3 are built. **Story 3b (chains of events) is next and replaces the events of story 2**: where 3b and an earlier story differ, 3b wins. Stories 4 to 8 are detailed to screens and rules and are marked **revisit**: the user plays the core first and their findings may change them.

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
Searching cost 9 steps today. Going straight to each thing: 4.
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

## Story 3b: chains of events (replaces the events of story 2)

Written 2026-11-17 after the user played days 1 and 2 on an iPad. Build this before story 4.

**The user's findings.**
1. From some moment on a screen opens with its top above the edge of the iPad's screen; you have to pull it down to read the top.
2. The game does not feel natural. It starts by making you put away things that should already be in their place, and it always *tells* you to put a thing away. In real life nobody tells you, and that is when things get lost.

**The user's design, decided.**
- **Everything starts in its place.** A new game begins with every thing on its home spot; nothing has to be put away before something has happened.
- **A day is two or three chains of events**: small stories in which you do ordinary things with several objects, one after the other ("take the coffee from the cupboard", "open the pack with the scissors", ...).
- **Sometimes the app stays silent about one thing.** In a *guided* chain the app says "put your scissors back". In a *silent* chain it says nothing about one of the things; if the player does not think of it, the thing stays where it was used. About half of the chains are silent.
- **Later the app asks: "Is everything back in its place?"** The player answers "Yes" or "No, I forgot something". **The app never says whether the answer was right** (user decision): the player finds out the next time the thing is needed and is not in its place.
- **Objects that are not trained are only told** (the coffee, the tin). The code must make it easy to turn such an object into a tracked thing later.
- **Chains are easy to add and change.** Decision: one small JavaScript data module per chain, not YAML (a static page without dependencies has no YAML reader, and a module can be checked by a test) and not free code (a chain is data; the behaviour of each kind of step lives in one table). Adding a chain is one file, its texts, and one row in the list of chains.

### 0. The screen that opens too high (fix first, own commit)

`main.js` rebuilds the whole screen on every tap of a choice and calls `window.scrollTo(0, 0)` only after Next. Suspected cause: after a long list (the walk list has 13 choices) the page is scrolled and the next, shorter screen is drawn while Safari keeps its offset. Not yet reproduced.
- Reproduce in Chromium at 820x1180 and 390x800: open the walk list, scroll to the last room, choose it, Next; measure `window.scrollY` and the top of `.command`.
- Decided fix, whether or not it reproduces: choosing a choice no longer rebuilds the screen (only `aria-checked` of the choices and the disabled state of Next change, so the scroll position cannot jump while choosing); after Next and after Menu the new screen is drawn and then scrolled to the top in the next animation frame, and the command gets focus (`tabindex="-1"`, no outline) so a screen reader and Safari both land on it.
- Pure part, test first: `screens.js` gets `updateSelection(screenElement, step)`; a test with a tiny fake element tree is not worth it here, so this part is verified in the browser: after the walk list, `scrollY` is 0 and the command is inside the viewport, at both sizes. Say in the report that a real iPad was not available.

### 1. Words

- **Thing**: an object the player trains with; it is in the catalogue, chosen, and has a place in the world.
- **Prop**: any other object of a story. A chain names every object by id; an id that is not a chosen thing is a prop. Making a prop a thing is adding it to the catalogue (and choosing it): the chain does not change.
- **Chain**: a list of steps. **Step kinds** (one table, `STEP_KINDS`; a new kind is a new row):

| Kind | In the chain file | For a thing | For a prop |
|---|---|---|---|
| `tell` | `{ id, kind: 'tell' }` | a screen with one sentence and Next | same |
| `move` | `{ id, kind: 'move', roomId }` | the story puts you in a room (no screen; its sentence is the first lead line of the next screen) | same |
| `goTo` | `{ id, kind: 'goTo', roomId }` | "Go to the kitchen": the player walks there | same |
| `take` | `{ id, kind: 'take', object, leftAt }` | "You need your scissors. Where are they?": the player finds the thing; it is then in hand. Already in hand: nothing to do | a `tell` screen with the step's sentence |
| `putBack` | `{ id, kind: 'putBack', object }` | "Put your scissors back.": the player puts it away, anywhere. Left out of a silent run | a `tell` screen with the step's sentence |
| `check` | `{ id, kind: 'check' }` | "Is everything back in its place?" | same |

`leftAt` is the spot where a thing stays when nobody puts it back (the worktop for the scissors of the coffee chain). It is required for a `take` of an object that is in the catalogue.

### 2. Rules

**Start.** A new game: the world holds every chosen thing on its home spot, the coat is worn. While no day has been started, changing a home spot moves the thing with it; after that a thing stays where it is. A chosen thing that is nowhere (a thing added later, a damaged save) is put on its home spot at the start of the next day, silently. The "come home with everything in hand" start of story 2 is gone.

**Building a day** (`day-plan.js`, pure; replaces `scenario.js`). A day is `pause 'day'`, one opener, then two other chains.
- Openers have `opener: true` and may name things that must be on the person (`needsOnPerson`: in hand or in a pocket of a worn garment). Only chosen things count. The opener is picked at random from those whose need is met; `go-out` needs nothing, so there is always one.
- The two other chains are picked at random from the rest, different from each other, preferring chains not played the day before (the save remembers the ids of yesterday's chains).
- A chain that has at least one `putBack` of a chosen thing is silent with a chance of 1 in 2: one of those things is picked and its `putBack` step is left out. The opener of the very first day is never silent.
- The steps are expanded into the flat list of events of the day by the `expand` function of each kind in `STEP_KINDS`. Every event carries `chain` and `step` (for its text), and a `tell`, `goTo` and `check` carry `roomId`: the room where the story stands at that point.
- **Letting go.** Before every `move` and `goTo` of a chain that comes after a `take`, and at the end of every chain, a `letGo` event is added. It has no screen: every thing still in hand is laid on its `leftAt` spot, without a word. Its streak goes to 0 and a record is kept (see history).

**Event kinds** (`EVENT_KINDS` in `day.js`; the kinds of story 2 that remain are `pause`, `moveTo`, `find`, `putAway`):
- `find` (a `take` of a thing): done at once when the thing is in hand. It keeps `leftAt` for the thing in the day's state.
- `goTo`: done when the player stands in `roomId`.
- `check`: `answerCheck(true)` ends it. `answerCheck(false)` asks which thing; `forgot(thingId)` inserts a `find` and a `putAway` for that thing right after the check and ends the check. Nothing is said about whether the thing really was away.
- `letGo`: as above, done at once.
- A `pause`, `goTo` or `check` whose `roomId` is not the room where the player stands (they walked off to put something away) first asks the player to come back: `state().returnTo` names the room and only walking is possible.

**Doing something else first.** On every screen of a day except a find, a put-away and "come back", there is one extra choice, always the same and always there: "Something else first". It leads to: "Put something away" (the things in hand; "You hold nothing." when there are none), "Take off my coat" / "Put my coat on", and "Go on". Putting a thing away on your own works exactly like a guided put-away (here, a pocket, or walk somewhere first). What is in hand is **not** shown anywhere else: a line "In your hand: scissors" on every screen would be the reminder the silent chain is meant to leave out.
`Day` therefore allows `walkTo`, `putDown(spotId, thingId)`, `putInPocket(garmentId, pocketId, thingId)`, `takeOff` and `putOn` during a `pause`, `goTo` and `check` as well; in a `putAway` event the thing defaults to the event's.

**Hurry is removed** (the rule, the reasons, the texts, the streak excuse, `hurry` in records): the special moment of a day is now the silent chain. It can come back later as a property of a chain.

**Streak.** Put on its home spot: +1. Put anywhere else, or let go: 0.

**History and summary.**
- Find record as it is. Put record becomes `{ day, thingId, steps, atHome, left }`; `left` is true for a thing that was let go (steps 0).
- The summary must not give away what lies where (the player has to discover it): the lines "On the home spot tonight" and "Somewhere else", and the advice rows `allHome` and `someAway`, are removed. It keeps: the searching line (or "Nothing to search for today."), the putting-away line, one advice line, and the come-back-tomorrow line. Advice rows, first match wins: `noSearch`; `costly` (searched more than twice the straight way) "Most of today's steps went into searching. A fixed place costs a few steps once."; `straight` (everything else) "You went straight to your things. That is what a fixed place gives you."

**Default home spots** change to the user's own examples: keys in the right pocket of the coat, scissors in the kitchen drawer. Wallet (inside pocket of the coat) and phone (kitchen worktop) stay. The spot `counter` is called "Worktop" ("on the worktop").

### 3. Screens

Lead lines stay chronological: feedback of the last action, then the sentence of a `move`, then the step's own lead.

`tell` (and a prop's `take` or `putBack`):

```
Menu
**Take a pack of coffee from the top right cupboard.**
( Go on )
( Something else first )
[Next]
```

`goTo`:

```
Menu
**Go to the kitchen.**                     the chain's own sentence for the step, e.g. "You feel like coffee. Go to the kitchen."
( Walk to another room )
( Something else first )
[Next]
```
"Walk to another room" gives the walk list of story 2. Arriving in another room than asked repeats the command. Come back: "**Go back to the kitchen.**" with only ( Walk to another room ).

`take` of a thing (the find screens of story 2, new command):

```
Menu
Open the pack with the scissors.                         the step's sentence
**You need your ✂️ scissors. Where are they? You are in the kitchen.**
( Look here, in the kitchen )
( Look in a pocket )
( Walk to another room )
[Next]
```
Found: "Found your ✂️ scissors in the kitchen drawer. 1 step." as before.

`putBack` of a thing (the put-away screens of story 2, new command):

```
Menu
**You are in the kitchen. Put your ✂️ scissors back.**
( Here, in the kitchen )
( In a pocket )
( Walk to another room )
( Take off my coat )
[Next]
```
The plan line and the star follow the hint level as before.

`check`:

```
Menu
You drink your coffee in the living room.               the step's sentence
**Is everything back in its place?**
( Yes, everything )
( No, I forgot something )
( Something else first )
[Next]
```
"No" gives "**What did you forget?**" with every chosen thing (icon and name) and ( Choose something else ). Then the find and the put-away of that thing follow, with their normal screens. After "Yes" the story goes on with no comment.

"Something else first":

```
**What do you want to do first?**
( Put my ✂️ scissors away )               one per thing in hand; with nothing in hand the lead says "You hold nothing."
( Take off my coat )
( Go on )
[Next]
```

### 4. The first chains

Files `app/js/chains/<id>.js`, list in `app/js/chains.js`. Sentences go in `en.js` under `chains.<chain>.<step>`. Rooms: the garden is "outside, at the front door" for the openers.

**`come-home`** (opener, `needsOnPerson: ['keys']`)

| Step | Kind | Data | Sentence |
|---|---|---|---|
| `door` | move | garden | "You come home and stand at your front door." |
| `keys` | take | keys, leftAt hall `console` | "You need your keys to get in." |
| `inside` | move | hall | "You open the door. You are inside." |
| `keys-back` | putBack | keys | (none: the put-back command is enough) |
| `shoes` | tell | | "You take off your shoes." |

**`go-out`** (opener, needs nothing)

| Step | Kind | Data | Sentence |
|---|---|---|---|
| `plan` | tell | (room hall, by a `move` first: `start`, hall, "You are in the hallway.") | "You are going out for some shopping." |
| `keys` | take | keys, leftAt hall `console` | "You cannot leave without your keys." |
| `away` | tell | | "You lock the door. An hour later you are back with a full bag." |
| `inside` | move | hall | "You open the door. You are inside." |
| `bag` | tell | | "You put the shopping bag down." |
| `keys-back` | putBack | keys | |
| `unpack` | goTo | kitchen | "Bring the shopping to the kitchen." |
| `done` | check | | "Everything is unpacked." |

**`coffee`**

| Step | Kind | Data | Sentence |
|---|---|---|---|
| `go` | goTo | kitchen | "You feel like coffee. Go to the kitchen." |
| `pack` | take | `coffee-pack` (prop) | "Take a new pack of coffee from the top right cupboard." |
| `scissors` | take | scissors, leftAt kitchen `counter` | "The pack has to be cut open." |
| `open` | tell | | "You cut the pack open." |
| `scissors-back` | putBack | scissors | |
| `tin` | take | `coffee-tin` (prop) | "Take the tin with the flowers from the worktop." |
| `fill` | tell | | "You pour the coffee into the tin and make a pot of filter coffee." |
| `tin-back` | putBack | `coffee-tin` (prop) | "You put the lid on the tin and put the tin back in the cupboard." |
| `sit` | goTo | living | "Take your coffee to the living room." |
| `drink` | check | | "You sit down and drink your coffee." |

**`present`**

| Step | Kind | Data | Sentence |
|---|---|---|---|
| `go` | goTo | dining | "A birthday present has to be wrapped. Go to the dining room." |
| `paper` | take | `wrapping-paper` (prop) | "Take the wrapping paper from the sideboard." |
| `scissors` | take | scissors, leftAt dining `dining-table` | "The paper has to be cut." |
| `wrap` | tell | | "You cut the paper and wrap the present." |
| `scissors-back` | putBack | scissors | |
| `phone` | take | phone, leftAt dining `dining-table` | "You want to ask what time the party starts." |
| `call` | tell | | "The party starts at eight." |
| `phone-back` | putBack | phone | |
| `paper-back` | putBack | `wrapping-paper` (prop) | "You put the rest of the paper back in the sideboard." |
| `hall` | goTo | hall | "Put the present ready in the hallway." |
| `ready` | check | | "The present stands ready by the door." |

**`pizza`**

| Step | Kind | Data | Sentence |
|---|---|---|---|
| `bell` | tell | (after `move` `start`, living, "You are in the living room.") | "The doorbell rings: your pizza is here." |
| `go` | goTo | hall | "Go to the front door." |
| `wallet` | take | wallet, leftAt hall `console` | "The pizza has to be paid." |
| `pay` | tell | | "You pay and take the pizza." |
| `wallet-back` | putBack | wallet | |
| `table` | goTo | dining | "Bring the pizza to the dining room." |
| `eat` | check | | "The pizza is on the table." |

**`call`**

| Step | Kind | Data | Sentence |
|---|---|---|---|
| `ring` | tell | (after `move` `start`, living, "You are in the living room.") | "Somewhere your phone rings." |
| `phone` | take | phone, leftAt garden `garden-table` | "You want to answer it." |
| `walk` | move | garden | "You talk and walk around. The call ends in the garden." |
| `phone-back` | putBack | phone | |
| `in` | goTo | living | "It gets chilly. Go back to the living room." |
| `sit` | check | | "You sit down on the sofa." |

Note for `call`: the thing is still in hand after the `move` to the garden (the `letGo` before that move must not take a thing that the same chain puts back later in the new room). Rule: a `letGo` lays down only the things whose `take` has no `putBack` left in the rest of the chain's events, that is, the silent thing and the things of a chain that has ended.

### 5. Tests (red first; one behaviour each)

`chains.test.mjs` (a contract for every chain in the list, so a new chain is checked on arrival): ids unique; every step has a known kind and the fields of that kind; every room and spot exists; every `take` of a catalogue object has a `leftAt`; every `putBack` has an earlier `take` of the same object; every step that needs a sentence has one in every language and no sentence is without a step; a chain ends with nothing a later chain would need in hand; at most one opener needs nothing... (at least one opener needs nothing).

`day-plan.test.mjs`: a day is a pause, an opener and two other chains; the opener's need is respected (keys in the worn coat: `come-home` can be picked; keys on the hook: only `go-out`); a need for a thing that is not chosen does not block; two different chains, not yesterday's when there are enough; a silent chain misses exactly one `putBack`, of a chosen thing; chance 0 gives no silent chain and chance 1 makes every chain with a chosen put-back silent, except the first day's opener; a prop's `take` and `putBack` become `tell` events and the same step for a chosen thing becomes a find or a put-away (one catalogue, with and without the coffee tin as a thing: the proof that a prop becomes a thing without touching the chain); a `letGo` stands before each move or walk after a take and at the end of the chain; the events survive JSON.

`day.test.mjs` (additions and changes): a new game has every thing on its home spot; a thing that is nowhere is on its home spot when the next day starts; a find for a thing in hand is done at once; `goTo` ends on arrival and not before; in a silent chain the thing lies on its `leftAt` spot after the chain and its streak is 0; in a guided chain nothing is let go; the thing of the `call` chain is still in hand in the garden; putting a thing away on your own during a `tell`, a `goTo` and a `check` works and counts for the streak; after walking off, the story asks you back and refuses everything but walking; `answerCheck(true)` goes on and changes nothing; `forgot(thing)` adds a find and a put-away for it, also when it lies on its home spot; a day in the middle of each new kind survives save and restore; `canContinue` refuses a broken event of each new kind; all hurry tests are removed with the rule.

`play-flow.test.mjs`: each screen of section 3 word for word; "Something else first" is on `tell`, `goTo` and `check` screens and not on find, put-away and come-back screens; nothing on a normal screen names what is in hand; the things in hand are listed under "Put something away"; the check says nothing after "Yes", also when a thing lies on the worktop; the flow contract.

`history`, `summary`, `app-flow`, `save`, `texts`: `left` replaces `hurry`; the summary has no home or away line; the new advice table; yesterday's chain ids are saved and validated; a new game's world is filled from the plan; changing a home spot before the first day moves the thing and after it does not.

Mutation checks (two): let `letGo` do nothing (the silent-chain test must fail); let the check say something after a wrong "Yes" (the test "the check says nothing" must fail).

**Look at it.** Playwright at 390x800 and 820x1180: play day 1 and day 2 with a fixed random that makes `coffee` silent on day 1; do not put the scissors back, answer "Yes", and on day 2 play `present`: the scissors are searched for and found on the worktop. Screenshots of a tell screen, the check, "Something else first" and the day-2 summary, looked at.

### 6. What this does to the later stories

Story 4 (progress) and 5 (introduction, choosing things) stay. Story 6 (real-life question) stays. Story 7 (tidy up, say it out loud) is covered by the check and by "Something else first" and is dropped; "say it out loud" may return as a sentence. The uses table of the catalogue is replaced by chains: each of the sixteen things needs at least one chain before story 5 offers it.

---

## Story 3c: a natural flow from story to story

Written 2026-11-17 after the user played the sessions version: "after a few steps the steps seem less logical, less natural, not mimicking the flow of daily life any more." The planning model played three sessions by script and read every screen (`flowstudy/play.mjs` in the scratchpad). What breaks the flow:

1. **Jumps between stories.** "You take off your shoes." (hallway) is followed by "(You are in the living room.) Somewhere your phone rings.": the pizza and call stories start with a `move` that puts the player in another room without a reason.
2. **Walking back and forth without a reason.** In `present` the player fetches the scissors in the kitchen, is sent back to the dining room to wrap (natural), walks to the kitchen to put the scissors back (natural), finds the phone there for "what time does the party start?" and is then sent back to the dining room only to hear "The party starts at eight.", then to the kitchen again to put the phone back, then back again for the paper: two of the walks have no reason in life.
3. **The same question after every story.** Three times "Is everything back in its place?" in one session is a ritual cue, and a check right after a silent story finds the gap at once, before any time has passed.
4. **"You come home and stand at your front door."** is followed by "You are in the garden."

**The user's graph idea.** The game already is a graph: every screen is a node, every choice an edge, and the state (where everything lies, the events of the session, the screens left for looking back) is stored. What made it feel unnatural were the edges *between* stories: they were jumps. Decision: no separate graph engine (it would add a second model of the same flow); three rules keep every edge natural, and each is a contract test on every chain, so a new chain cannot break them.

### Rules

1. **A story after the opener starts where the player is.** Only an opener (the first story of a session) may start with a `move`: it sets the scene of the session. `pizza` and `call` lose their `start` step; their first step is a `tell` that happens wherever the player is ("The doorbell rings: your pizza is here.", "Somewhere your phone rings.").
2. **A step is tied to a room only when the story needs the place.** A `tell` gets an optional `at: <roomId>`; a prop's `take` and `putBack` (told) take `at` too. Only an event with a room asks the player back ("Go back to the dining room.") when they walked off; a tell without `at` happens wherever the player is. A `move` inside a story stays (the call that ends in the garden is the story). The `at` of each step:

| Chain | Step | at |
|---|---|---|
| come-home | shoes | hall |
| go-out | bag | hall |
| go-out | done | kitchen |
| coffee | pack, open, tin, fill, tin-back | kitchen |
| coffee | drink | living |
| present | paper, wrap, paper-back | dining |
| present | call | (none: it happens where the phone is) |
| present | ready | hall |
| pizza | pay | hall |
| pizza | eat | dining |
| call | sit | living |

3. **One check per session, at its end.** No chain ends with a `check` any more: `coffee.drink`, `present.ready`, `pizza.eat`, `call.sit` and `go-out.done` become `tell` steps with the same sentence. A new closing chain `evening` (`closer: true`, file `chains/evening.js`) ends every session: a `tell` "It is evening." and the `check` with the lead "Before you go to bed, you look around once more." The day plan becomes: pause, opener, other chains, closer. The check event has no room (it is a thought; it never asks the player back).
4. **The front door.** The outside place keeps its id `garden`; its texts become "Front garden", "in the front garden", "to the front garden", so the opener reads "You come home and stand at your front door." … "You are in the front garden."

### Engine

- `STEP_KINDS.tell.expand` gives the event `roomId: step.at ?? null`; the told `take` and `putBack` likewise. `check` events have `roomId: null`. `EVENT_KINDS` accept `roomId: null` for `tell` and `check` (and still refuse an unknown room). `Day.returnTo()` only for an event with a room.
- `day-plan.js`: the closer is added after the other chains; it is never silent (it has no put-backs; the contract makes sure). `DEFAULT_RULES` is unchanged (`otherChains` counts the chains between opener and closer).
- Contract tests (`tests/chain-contract.mjs` / `chains.test.mjs`): a chain that is not an opener never starts with a `move`; `at` names a room; exactly one chain is a closer; a `check` appears only in the closer; the closer has no `take` or `putBack`.

### Tests (red first; one behaviour each)

- chains: the five contract rules above; `pizza` and `call` start with a tell; every step listed in the table has its `at`.
- day-plan: a session ends with the closer's events; the closer is never silent, also with `silentChance: 1`; a session has exactly one check.
- day / event-kinds: a tell without a room never asks the player back, also when they walked to another room; a tell with `at` asks them back; a check never asks back; a saved day standing on a tell or check with `roomId: null` can be continued; an unknown room cannot.
- play-flow / app-flow (real chains through the screens, with a fixed random): the first screen of `pizza` after another story has no "You are in the living room." line; in `present`, after fetching the phone from the kitchen, "The party starts at eight." is shown in the kitchen and the phone is put back there without a single "Go back to" screen in between; the session ends with "It is evening." and the check; a well-played session of come-home, coffee and present shows "Go back to" at most twice (counted over all its screens).
- texts: the front-garden forms; the evening sentences; no sentence for a removed step.
- Mutation checks: let a tell without `at` still ask the player back (the present test fails); let the day plan forget the closer.
- Browser: play two sessions at 390x800 and read every screen once more for jumps (the transcript script in the scratchpad may be reused); report any screen that still reads like a jump.

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
