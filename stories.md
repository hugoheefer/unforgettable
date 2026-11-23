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

## Story 3d: stories that make sense to a human

Written 2026-11-22 by the planning model after replaying three sessions by script with the current rules (no put-back is ever told). Build it after 3c; it changes the engine in one place and the stories in several.

### What does not make sense now (from the transcript)

1. **No moment to put a thing away.** In `come-home` the keys are found at the front door and the story moves straight inside: the let-go comes *before* the move, so the keys lie on the console table before the player ever sees a screen with the keys in hand. Same in `call`: the phone is laid on the garden table before the first screen in the garden. Since nothing is told any more, the player must get at least one screen, holding the thing, in the place where it was used; otherwise forgetting is not their mistake but the game's.
2. **The same opener every session.** `come-home` needs the keys on the person; after session 1 they lie on the console table, so every later session opens with `go-out` (seen three sessions in a row).
3. **Searching a ringing phone.** "Somewhere your phone rings" is found by ear in real life, not by memory: a poor test of the habit.
4. **Shopping without the wallet.** `go-out` only needs the keys; nobody goes shopping without a wallet.
5. **A pizza that nobody ordered.** The doorbell rings for a pizza that was never ordered.
6. **The tin.** "Take the tin from the worktop" … "put the tin back in the cupboard": two different places for one object.

### Rules

**R1 Let go when you walk away, not before.** A `letGo` is placed *after* a `goTo` (when the player has walked out of the room where the thing was used) and at the end of a chain, never before a `move`: a story move takes the player along with what they hold (you carry the keys inside). Contract test over every chain, with the default rules (every put-back silent): between the `find` of a chosen thing and the `letGo` that names it there is at least one event with a screen (`tell`, `goTo` or `check`) while the player stands in the room where the thing was used or later rooms of the story. The thing still lands on its `leftAt` spot.

**R2 Openers take turns.** The opener is picked from the openers whose need is met, preferring one that was not played yesterday (`yesterdayChains` already holds it); the very first session still opens with `come-home`.

**R3 A new opener `morning`** (needs nothing), so a session can start at home in the morning:

| Step | Kind | Data | Sentence |
|---|---|---|---|
| `wake` | move | bedroom | "You wake up in your bedroom." |
| `phone` | take | phone, leftAt bedroom `nightstand` | "You want to know the time and read your messages." |
| `read` | tell | at bedroom | "You read your messages in bed." |
| `phone-back` | putBack | phone | |
| `dress` | tell | at bedroom | "You get dressed." |
| `breakfast` | goTo | kitchen | "Breakfast is waiting." |
| `eat` | tell | at kitchen | "You have breakfast." |

### Stories that change

`go-out` (also needs the wallet):

| Step | Kind | Data | Sentence |
|---|---|---|---|
| `start` | move | hall | "You are in the hallway." |
| `plan` | tell | | "You are going out for some shopping." |
| `keys` | take | keys, leftAt hall `console` | "You cannot leave without your keys." |
| `wallet` | take | wallet, leftAt hall `console` | "You will have to pay in the shop." |
| `away` | tell | | "You lock the door and walk to the shop." |
| `pay` | tell | | "You pay at the till." |
| `back` | tell | | "An hour later you are back with a full bag." |
| `inside` | move | hall | "You open the door. You are inside." |
| `bag` | tell | at hall | "You put the shopping bag down." |
| `keys-back` | putBack | keys | |
| `wallet-back` | putBack | wallet | |
| `unpack` | goTo | kitchen | "The shopping belongs in the kitchen." |
| `done` | tell | at kitchen | "Everything is unpacked." |

`pizza` (ordered first, with the phone):

| Step | Kind | Data | Sentence |
|---|---|---|---|
| `hungry` | goTo | living | "You are hungry and want to order a pizza from the sofa." |
| `phone` | take | phone, leftAt living `coffee-table` | "You order it with your phone." |
| `ordered` | tell | at living | "The pizza is ordered. It will be here in half an hour." |
| `phone-back` | putBack | phone | |
| `bell` | tell | | "The doorbell rings: your pizza is here." |
| `go` | goTo | hall | "Someone has to open the front door." |
| `wallet` | take | wallet, leftAt hall `console` | "The pizza has to be paid." |
| `pay` | tell | at hall | "You pay and take the pizza." |
| `wallet-back` | putBack | wallet | |
| `table` | goTo | dining | "The pizza goes on the dining table." |
| `eat` | tell | at dining | "The pizza is on the table." |

`call` (the player wants to call, nothing rings): `ring` becomes "You want to call your sister."; `phone` becomes "You need your phone for that."; the rest stays.

`coffee`: `tin` becomes "Take the tin with the flowers from the cupboard."

`come-home` and `present` keep their steps; R1 alone gives `come-home` its missing moment ("You take off your shoes." with the keys still in hand).

### Not in this story (noted for later)

The player wears the coat all day, also in bed. Coming home should take the coat off and hang it, going out should put it on (and find it). That needs the coat as something that can be searched for: a story of its own.

### Tests (red first; one behaviour each)

- day-plan: R1 for a hand-made chain (take, move, putBack, tell → the let-go comes after the tell, not before the move); after a `goTo` the let-go comes after it; at the end of a chain as before; the contract of R1 over every real chain with the default rules.
- day-plan: R2 (yesterday's opener is not picked when another opener can open; it is picked when it is the only one; the first session still opens with `come-home`).
- chains: `morning` is an opener that needs nothing and starts with a move; `go-out` takes keys and wallet; `pizza` starts with a `goTo` (allowed after the opener) and takes the phone before the wallet; the changed sentences; every step of the tables above.
- app-flow (real chains, fixed random, the play bot): in `come-home` there is a screen holding the keys inside the hallway before they are let go ("You take off your shoes." is shown and the keys are still in hand at that moment, checked through the day's state); three sessions in a row do not all open with `go-out`.
- texts: the new and changed sentences; `call.ring` no longer mentions ringing.
- Mutation checks: put the let-go before a `move` again (the R1 contract fails); ignore yesterday for openers (R2 fails).
- Read a scripted transcript of three sessions after the change (`flowstudy/play.mjs` in the scratchpad, or the play bot) and report any screen that still does not make sense to a human, quoting it.

---

## Story 3e: no step that a human would find strange

Written 2026-11-22 by the planning model after the user showed "You feel like coffee. Go to the kitchen." with the choice "Walk to another room" (fixed already: a walk-to offers its room). The user: "look for other not logical sequences". Three sessions were then played like a careful human who puts things away on their own (`flowstudy/human.mjs` in the scratchpad prints every screen with all its choices).

### What is still strange

1. **A step that uses a thing happens without it.** The player puts the scissors back in the drawer ("Something else first") and the story goes on with "You cut the paper and wrap the present." Same for the call ("The party starts at eight."), reading messages, paying.
2. **No time of day.** "You have breakfast." is followed by "You are hungry and want to order a pizza from the sofa."
3. **A reason that is only true in one place.** "It gets chilly outside." (call) is shown after the player walked to the kitchen to put the phone away.
4. **Two voices.** "Take a new pack of coffee from the top right cupboard." (an order the player cannot refuse) next to "You cut the pack open." (a narration).
5. **"Need" twice.** "(You need your phone for that.)" above "You need your 📱 phone. Where do you look?"
6. **Two taps for one intention.** "You want to call your sister." [Go on] and only then the search for the phone; "You are going out for some shopping." [Go on] and only then the search for the keys.

### Rules

**U1 A step that uses a thing needs it in hand.** A `tell` may carry `uses: <object>`. When the player taps Go on and does not hold that thing (they put it away first), the story asks for it again: a `find` of that thing is inserted before the step (the same mechanism as "No, I forgot something"), with the step's own sentence as the reason. A prop in `uses` is ignored. Contract: `uses` names an object that the chain takes earlier. The steps that use a thing:

| Chain | Step | uses |
|---|---|---|
| go-out | away (you lock the door) | keys |
| go-out | pay | wallet |
| coffee | open | scissors |
| present | wrap | scissors |
| present | call | phone |
| pizza | ordered | phone |
| pizza | pay | wallet |
| morning | read | phone |

**U2 Stories follow the time of day.** Every chain gets `time: 'morning' | 'day' | 'evening'`. The opener's time is the earliest of the session; the two other chains are picked among those not earlier than the opener and are played in time order (morning, day, evening); the closer is last. Times: `morning` morning; `go-out`, `come-home`, `coffee`, `present`, `call` day; `pizza` evening. Contract: every chain has a time; the closer is evening.

**U3 A walk reason is true wherever the player stands.** The player may have walked off to put a thing away. Rule for authors (in `CLAUDE.md`): a `goTo` sentence is a wish or a purpose, never a description of the place the player is in. `call.in` becomes "The call is over. You want to sit down on the sofa again."

**U4 One voice: the story narrates.** Every `tell` and every told prop step is a narration in the present tense ("You …", "The …"), never an order. Changes: `coffee.pack` "You take a new pack of coffee from the top right cupboard."; `coffee.tin` "You take the tin with the flowers from the cupboard."; `present.paper` "You take the wrapping paper from the sideboard.". Contract test over the English texts: no chain sentence starts with a bare verb ("Take ", "Put ", "Go ", "Walk ").

**U5 The find command does not repeat "need".** `findCommand` becomes "Where do you look for your 🔑 keys? You are in the front garden." The take sentences stay as the reason ("You need your keys to get in.").

**U6 One screen for one intention.** A `tell` directly before the `take` of a thing and saying why it is needed merges into the take's reason:
- `call`: the `ring` step goes; `phone` becomes "You want to call your sister." (the call story then starts with the search for the phone, wherever the player is).
- `go-out`: the `plan` step goes; the `start` move becomes "You are in the hallway, about to go shopping."
- `pizza.phone` becomes "You want to order it with your phone." (an intention, not something already happening).

### Tests (red first; one behaviour each)

- day: U1 (a tell with `uses` and the thing in hand goes on; without it a find of that thing comes first, with the step's sentence as its reason; after finding it the tell is shown again; a prop in `uses` changes nothing; a saved day in the middle of the inserted find survives save and restore).
- chains: the `uses` table; the contract for `uses`; every chain has a `time`; the closer is evening; U4 over all sentences; the removed steps (`call.ring`, `go-out.plan`).
- day-plan: U2 (a morning opener can be followed by day and evening chains in time order; a day opener is never followed by a morning chain; the others are played in time order; with too few chains of a later time the session has fewer stories rather than going back in time; the first session still opens with `come-home`).
- texts: the changed sentences; `findCommand`.
- app-flow with the human-like player (copy the idea of `flowstudy/human.mjs` into `tests/play-bot.mjs` as an option): putting the scissors away before "You cut the paper and wrap the present." leads to a search for the scissors before the present is wrapped.
- Mutation checks: ignore `uses` (the U1 tests fail); play the others in random order instead of time order (U2 fails).
- At the end: play three sessions with `flowstudy/human.mjs` (seeds 7, 23, 11) and with `flowstudy/play.mjs`, read every screen with its choices, and report each screen that a human would still find strange, quoting it. Do not stop at the first one.

---

## Story 3f: the player chooses real actions

Written 2026-11-23 by the planning model. User finding: "a lot of the times the app just tells it: now you're doing this, and the user is just pushing the button. Nicer: the user can always choose between two or three possibilities, and the app executes that action." The user chose **real actions** (choices that change something, each leading to its own next sentence; no long separate story branches) over flavour choices (coffee or tea, same story) and over full branching.

### Rules

**R1 A choice step.** A new step kind `choose`: `{ id, kind: 'choose', at?, options: [{ id, steps: [...] }, ...] }` with 2 or 3 options. Each option holds a short list of ordinary steps (take, tell, putBack, goTo; no move, no check, no nested choose). The question is the step's sentence (`texts.chains.<chain>.<step>`, a string); the label of each option is `texts.options.<chain>.<step>.<option>` (a new top-level table, so a per-thing table under `chains` keeps its one meaning). After the option's steps the chain goes on with the next step after the `choose`.

**R2 The screen.** Command: the question. Choices: the option labels in chain order, then "Something else first". Nothing preselected; with one tap a choice acts at once. Look back shows the label that was chosen (it does already for any choice).

**R3 Expansion at build time, pruning at run time.** `buildDay` expands every option's steps into events right after a `choose` event `{ kind: 'choose', chain, step, options: [ids], roomId }`; each option event carries `option: '<step>/<option>'`. Silent put-backs and `letGo`s are computed over the expanded list as now (a `letGo` only lays down what is in hand, so a thing of an option not taken is never laid anywhere: keep a test that proves it). When the player chooses, `Day` removes the events of the other options from its event list and goes on; the stored day then holds only the chosen path, so a reload continues it. `canContinue` accepts a `choose` event whose options match the chain, and option events whose step ids exist inside that chain's options (`hasStep` looks inside options).

**R4 The evening asks only for what was really used.** `needAgain` events get `ifUsed: true`; such a find is done at once (no screen) when no `find` of that thing comes earlier in the day's (pruned) event list. So tearing the coffee pack open means no evening search for the scissors.

**R5 The chain contract holds on every path.** The contract tests walk each chain once per combination of options (every path) and apply all existing rules (uses after a take, let-go after a screen in the room where the thing was used, only openers start with a move, ...). New rules: a `choose` has 2 or 3 options with unique ids; option steps have ids unique in the chain; every option label and every option step sentence exists in the English texts.

### The choices (content, decided)

| Chain | Replaces | Question (`chains.<chain>.<step>`) | Options (label → steps) |
|---|---|---|---|
| morning | `phone`, `read`, `phone-back` | `first`: "What do you do first?" (after the wake move; the wake sentence stays as the arrival line) | `phone` "Read your messages" → take phone (`phone`: "You want to know the time and read your messages.", leftAt bedroom nightstand), tell `read` at bedroom uses phone, putBack `phone-back` · `up` "Get up at once" → tell `up` at bedroom: "You get up at once and open the curtains." |
| coffee | `scissors`, `open`, `scissors-back` | `open-how` at kitchen: "The pack of coffee has to be opened." | `cut` "Cut it open with your scissors" → take scissors (`scissors`: "You want a clean cut.", leftAt kitchen counter), tell `open` at kitchen uses scissors, putBack `scissors-back` · `tear` "Tear it open" → tell `tear` at kitchen: "You tear the pack open. Some coffee spills on the worktop." |
| present | `scissors`, `wrap`, `scissors-back` | `wrap-how` at dining: "The paper has to be cut to size." | `cut` "Cut it with your scissors" → take scissors (leftAt dining table), tell `wrap` uses scissors, putBack `scissors-back` · `fold` "Fold it and tear along the fold" → tell `tear` at dining: "You fold the paper and tear it. The edge is a bit ragged, but the present is wrapped." |
| present | `phone`, `call`, `phone-back` | `party`: "You want to know what time the party starts." | `call` "Call your friend" → take phone (`phone`: "Your friend will know.", leftAt dining table), tell `call` uses phone, putBack `phone-back` · `card` "Look at the invitation" → tell `invitation` at dining: "The invitation on the sideboard says eight o'clock." |
| pizza | `wallet`, `pay`, `wallet-back` | `pay-how` at hall: "The pizza has to be paid." | `cash` "Pay with cash from your wallet" → take wallet (`wallet`: "You keep your cash in your wallet.", leftAt hall console), tell `pay` at hall uses wallet, putBack `wallet-back` · `phone` "Pay with your phone" → take phone as step `phone-pay` ("Your phone can pay at the door.", leftAt hall console), tell `pay-phone` at hall uses phone: "You hold your phone to the card reader and take the pizza.", putBack `phone-pay-back` |

Not in this story, on purpose: `come-home` and `go-out` (their point is the keys and the wallet; no real alternative that keeps the story true), `call` (an option would have to change where the phone is left, which is set by the take before the choice), `evening`. Plain facts ("The doorbell rings.", "It is getting late.") stay a tell with "Go on": a choice there would be a flavour choice, which the user did not pick. The step sentences that move into an option keep their wording unless the table gives a new one; each reason before a find still does not say "need" (U5).

### Tests (red first; one behaviour each)

- chains: `STEP_KINDS.choose` expands to the choose event and every option's events tagged with `option`; the contract on every path (R5), with a deliberately broken fixture per new rule; the STORY table shows the new steps.
- day-plan: the options of a choose follow it in chain order; a silent chain drops put-backs inside options too; the evening's `needAgain` events carry `ifUsed`.
- day: choosing an option removes the other options' events and the story goes on with the chosen one; choosing is refused for an id that is not an option (a `RefusedMove` or the flow's `choiceNotOffered`, whichever fits the existing pattern); a reload after choosing continues on the chosen path (snapshot, `canContinue`, restore); a saved choose event with unknown options fails `canContinue`; a thing of an option that was not chosen is never laid down by a let-go; an `ifUsed` evening find for a thing not found earlier is done at once, one for a thing found earlier is asked.
- play-flow: the choose screen (command, labels in order, "Something else first", nothing preselected); with one tap a choice acts at once.
- app-flow with the bot: a session where the player always takes the first option and one where they always take the last option both finish; tearing the coffee pack open means the evening does not ask for the scissors.
- texts: every option label and new sentence exists; no option label is a narration ("You ..."): labels are the player's own actions.
- Mutation checks: do not prune the other options (a day test fails); drop `ifUsed` (the evening test fails).
- At the end: read one transcript per bot variant (first option, last option) and report every screen a human would still find strange, quoting it.

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
