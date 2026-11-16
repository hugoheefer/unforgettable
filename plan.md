# Plan: from proof of concept to a version you can hand to someone

Written 2026-11-16 after reading the whole history and the code (134 tests, three tried versions). This is a decided plan for an implementing agent. Stories are built in order, one per commit or small series, each one playable when it is done.

## Why the current version does not train anything yet

1. **Nothing is ever forgotten.** You put four things down and look for them one minute later. Short-term memory finds them wherever they are, so a random place costs nothing and the home spot earns nothing. The one thing the player must feel (a fixed place is found at once, a random place is not) never happens.
2. **Things are not used.** In real life you lose things because you use them somewhere and drop them there. The game only has "come home, put everything down".
3. **The pressure is artificial.** "3 moves, then the item drops on the first spot" is a rule of the game, not of life, and it was the least understood part.
4. **Points mean nothing.** "Score: 39" does not tell the player what the habit saved.
5. **Too many taps.** Walking room by room through 14 places with two screens per step is tiring, which punishes the good behaviour most.
6. **No bridge to real life**, no explanation for a new player, no progress over days, nothing personal.

## The design that fixes it (decided)

- **The world persists.** Where you leave a thing is where it is the next time, also tomorrow. There is no "round" that starts clean; there are **days**. Real forgetting (hours, a night, other things in between) does the teaching.
- **A day is a short list of events** (3 to 5 minutes): leave the house (find what you need), come home (put it away), and a few moments where you **use** a thing somewhere and must put it away from there ("You finished the call in the garden. Put your phone away."). The home spot is then far and "put it here" is close: the real temptation.
- **One currency: steps.** Walking to a room costs its distance in steps, looking at a spot or in a pocket costs one. No points. Steps stand for time.
- **Walk anywhere in one screen.** "Walk to another room" lists every room with its distance ("Study, 2 steps"). Fewer taps, same cost.
- **Hurry removes choices instead of forcing a drop.** On some put-away events there is no time: only rooms within 1 step are offered, with one line saying why. The forced interruption disappears.
- **The feedback is the player's own data**: "From their home spot you found things in 2 steps on average. From anywhere else: 7." That sentence is the lesson of the app.
- **Real life is asked about**, one question a day, and the plan is shown as if-then cards.
- Kept as it is: one command and its choices per screen, then Next; plain JS modules; hints that fade with the streak; coat and pockets.

## Definition of done ("usable")

Someone who gets only the link can, without help: understand in three screens why fixed places work; choose their own things and home spots; play one day in under five minutes; close the app at any moment and continue later; see after a few days in their own numbers that home spots are found faster; be asked about their real keys. It is live in my-wiki and the user has played it on a phone.

## Rules for the implementing agent (every story)

- Read `CLAUDE.md` here and the general rules it points to. TDD without exception: write the listed tests first, run them, **stop and report the failures before writing production code**, then write only what the failing test demands. A test that is green on arrival is said so and proven with a mutation check.
- Core modules stay pure: no DOM, no `Date`, no `Math.random` (ports: `Storage`, `Clock`, `RandomSource`). Texts and per-item or per-event facts live in data tables, not in `if` ladders.
- While working run only the affected test file (`node --test tests/<name>.test.mjs`); the whole suite once at the end; at most two mutation checks per story; one Playwright run at phone width (390 px) for a story that changes screens, with a screenshot looked at.
- Update `CLAUDE.md` (design decision with its reason), `todo.md` and `README.md` in the same commit. Never touch my-wiki's `main` without the user's go-ahead.
- After each story: bundle and republish the preview artifact, and tell the user in a few lines what to try.

## Story 0: refactor first (no behaviour change, tests stay green)

The next stories build on these seams.
- `app-flow.js` switches on `instanceof` to know when a flow ends. Give every flow the same contract (`step()`, `choose()`, `next()`, `isFinished()`) plus an `onFinished` callback passed in by `AppFlow`; remove the `instanceof` checks.
- `room-view.js` reads `world.garmentPlaces` directly: add `World.garmentSpot(garmentId)` and use it.
- `play-flow.js` says "You put your coat on" for any garment: use the garment's name.
- Golden test before touching it: one scripted round through `AppFlow` whose list of `step()` values is compared before and after.

## Story 0b: texts ready for a second language (English only for now)

User decision 2026-11-16: the screens stay English, but adding Dutch later must be easy; the language choice itself is not built yet.
- All text the player reads moves out of the logic into one module per language: `app/js/texts/en.js` exports one object with every sentence as a string or a small function of its values (`putAwayQuestion: ({ room, item }) => ...`), including the names of rooms, spots, pockets, garments and things, keyed by their id. `layout.js` keeps ids, icons and structure only.
- `texts.js` holds the list of languages (a table: code, name, module) and `textsFor(code)`, which falls back to English for an unknown code. The flows get the texts object injected; no module imports `en.js` directly except `texts.js`.
- Adding Dutch later is then: copy `en.js` to `nl.js`, translate, add one row to the table, and add the choice to the welcome screen. Nothing else changes.
- First tests: every flow still produces the same English screens (the golden test of story 0); a contract test that will hold for any language: every key of `en.js` exists in each listed language with the same kind (string or function), and every room, spot, pocket, garment and thing id in `layout.js` has a name; `textsFor('xx')` gives English.
- Mutation check: remove one name from `en.js`; the contract test must name the missing id.

## Story 1: the world persists

- `World.snapshot()` returns plain data (item locations, garment places); `World.restore(layout, snapshot)` rebuilds it. Unknown items, spots or garments in a snapshot are dropped (stale save), never a crash.
- Save format gets `version: 2` with `world`, `day` (number and index of the next event) and `history` (story 4). An old save keeps its plan and streaks and gets an empty world.
- First tests: a restored world answers `whereIs` like the original; a coat hung on a spot is still there, with what was in its pockets; a snapshot naming a spot that no longer exists loses only that item; a version 1 save loads with its plan.

## Story 2: days made of events (replaces the round)

Evolve `round.js` into `day.js`; most rules stay (reach of pockets, take off, put on, look).
- Event kinds, as a table of small objects with one `describe` and one `isDone` each, not a switch: `find` (item is needed; done when found, the item is then in hand), `putAway` (item in hand; done when put down), `moveTo` (the story puts you in a room: "You are in the garden").
- `scenario.js` (pure, `RandomSource`): builds the events of a day. First day ever: come home with everything in hand, put it away, then two uses. Later days: leave (find 2 or 3 things), come home (put them away, one of them in a hurry at most), two uses. A **use** is `find` + `moveTo` + `putAway`, with its texts and room taken from a table per item in `layout.js` (phone: a call in the garden, a recipe in the kitchen; scissors: wrapping a present in the living room; keys: something from the shed; wallet: paying at the front door).
- Walking: `walkTo(roomId)` accepts any room and costs `stepsBetween`. In a hurry, rooms further than 1 step are not offered and refused.
- Every step costs are counted per event; no points, no `movesLeft`, no forced interruption. Remove what becomes dead.
- After every finished event the world and the day position are saved; reopening the app continues at the next event.
- `play-flow.js`: the door list shows every room with its distance, nearest first; the room that holds the home spot carries the star while the hint is shown or dimmed.
- First tests: a thing left on the sofa on day 1 is on the sofa on day 2; a use event ends with the player in the use room holding the item; in a hurry the study (2 steps) is not offered and the hallway (1 step) is; walking two rooms costs two steps; reloading in the middle of a day continues with the same event and the same world; the first day starts with everything in hand.
- Mutation checks: the world is not restored between days; hurry offers every room.

## Story 3: what a find costs, and the day summary

- `history.js` (pure): one record per find: item, day, steps used, shortest possible (distance to the room where it was, plus one look), and whether it was on its home spot. Stats are computed from the records, never stored. Keep the last 300 records.
- The result screen becomes the day summary: per thing where it ended the day (home or not), the steps spent searching today, and "With everything on its home spot: N steps". One line of advice, chosen by a table (all home / some away / mostly away).
- First tests: a thing found on its home spot in the same room records 1 step and 1 possible; searching three spots first records 4; the summary's "possible" is the sum of the shortest ways; a day with nothing searched says so instead of showing zeros.

## Story 4: progress in the player's own numbers

- A "My progress" choice on the welcome screen: average extra steps from the home spot against from anywhere else (only shown once both have at least 3 finds, otherwise "Play a few days first"), share of things put on their home spot per day for the last 7 days, streak per thing.
- First tests: the two averages come from the right records; with too few records the comparison is withheld; a thing with a broken streak shows 0.

## Story 5: first use and explanation

- First start (no save): three screens, each one command and Next: why things get lost (you put them down without noticing), the idea (one fixed place per thing), how the game works (days, steps, your own places). Then choosing things and home spots, then day 1.
- "How it works" on the welcome screen repeats them. "Start again" with a confirm step erases the save.
- Choose which things to train: 3 to 6 from this list (user decision 2026-11-16), each with its use table: keys, wallet, phone, glasses, scissors, remote control, charger, headphones, umbrella, bag, cymbal bag, drumsticks, gate key, car papers, driver's licence, bank card. The list is shown in groups (every day, cards and papers, music, around the house) so one screen stays short. The save stores the chosen ids; an unknown id is dropped on load.
- First tests: a new player gets the introduction and a returning player does not; choosing fewer than 3 things keeps Next disabled; a day only has events for chosen things; erasing brings back the introduction.

## Story 6: the bridge to real life

- After choosing home spots, one if-then card per thing as a step: "When I come home, my keys go on the key hook in the hallway." with the question "Where is that in your own home?" (optional short text, stored, shown on the card later). This needs a text field as a second kind of step in `screens.js`; keep it one field.
- Once per real day (a `Clock` port gives the date), before the day starts: "In real life, where are your keys right now?" with "On their home spot", "Somewhere else", "I do not know". One thing per day, in turn. The answers are recorded and shown in My progress as the real-life streak.
- First tests: the question comes once per date and not again the same date; it rotates through the chosen things; "I do not know" breaks the real-life streak; the text of a card is kept after a reload; a damaged text (not a string, too long) is dropped.

## Story 7: putting things back (the rescue habit)

- Sometimes a day has a quiet moment: "You have five minutes. Is anything not on its home spot?" with "Tidy up" (fetch a thing and bring it home, at normal step cost) and "Leave it".
- After putting a thing somewhere else than home, one line: "Say it out loud: phone, garden table." (noticing the moment you put something down is what makes a stray place findable).
- First tests: the quiet moment only appears when something is away from home; tidying moves the thing and counts as a home placement for the streak; leaving it changes nothing.

## Story 8: hand-over

- Look at every screen on a phone width in light and dark, fix wording and spacing; a short `user-manual.md`; README updated.
- Mirror to my-wiki on the side branch, then ask the user for the go-ahead for `main`.
- The user plays three days on a real phone; their findings become the next stories.

## Later, not part of "usable"

Away from home (friend, library, the carry-along rule), a flat floor plan, a 3D view, sound. They stay in `todo.md`.

## Open questions for the user (defaults are used until answered)

Answered 2026-11-16: English for now with the code prepared for more languages (story 0b); the list of things is in story 5.

1. Two names were dictated and are interpreted: "symbols, bag" as a drummer's cymbal bag, "port opening key" as the key or remote that opens the gate ("gate key"). Correct them if they are wrong.
2. The stories are outlines with their first tests, not yet worked out in detail (exact wording of every screen, the full use table per thing, the layout of the progress screen). Each story is detailed just before it is built, and shown to the user first.
