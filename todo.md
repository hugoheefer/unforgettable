# Todo

## Done

- Idea, research and decisions agreed (2026-11-16): see CLAUDE.md.

## Game concept (agreed)

- Places are screens with simple pictograms; one place visible at a time, others can be entered again: apartment (several rooms), car, coat, trousers, friend's or parents' house, library.
- Items: keys, wallet, phone, scissors, tools, ... each with a pictogram.
- Loop: **setup** (player writes an if-then plan: item → home spot) → **drop** (items handed out, player places them under pressure) → **distraction** → **find** (surprise prompt, e.g. "start the car") → **feedback**.
- Pressure that pulls toward a wrong place: phone call, full hands, visitor, hurry timer. The nearest place is one tap; the home spot costs an extra step.
- Away from home the fixed place is a carry-along one (coat pocket, bag).
- Encode moment: after placing, a short confirmation "keys → coat, left pocket".
- Searching costs time per opened place; points reward the home spot and a calm, systematic search.
- Hints fade (shown, dimmed, hidden) with the streak per item. Scenarios vary in order and place; the find prompt comes at an unpredictable moment.
- Feedback after a miss: short and without blame ("it was in the kitchen; your plan said hook").

## Proof of concept (2026-11-16, playable, 60 unit tests)

Built in one go: steps 0 to 7 in a first form. `app/` runs as a static page; setup screen (choose home spots), drop phase with pressure and forced drops, distraction, find phase with move costs, result screen, fading hints, saved plan and streaks. Not yet: scenarios away from home (friend, library), progress screen, publishing to my-wiki, a check of the look on a real phone.

## Second version (2026-11-16, after the first try)

Feedback: not always clear what to do; rooms and clothes were mixed. Now: a blue instruction line says what to do and each tile says "Put here" or "Look here"; the house has all common rooms (hall, living, dining, kitchen, toilet, landing, bedroom, bathroom, study, garage, garden, shed, car) with 3 to 5 places each; the player wears a coat and trousers with pockets (shown apart as "You wear"); the coat can be taken off and hung anywhere in the room you stand in (costs a move), and then its pockets are only within reach in that room; scissors added. 100 unit tests.

## Third version (2026-11-16, after the second try)

Every screen is now one command plus its choices and a Next button (see CLAUDE.md). Welcome, choosing home spots (area, then place), the round (a question per action, the distraction screen, the search) and the result are all steps from `app-flow.js`. 134 unit tests.

## Roadmap (advice, in order of value for the goal: a real habit)

1. **Real-life bridge**: a daily check-in "Did you put your keys on their home spot today?" plus an if-then card per item ("When I come home, my keys go on the hook"). This trains the real habit, which the game alone cannot.
2. **Progress**: streak and share of home placements per item over time; one short round a day.
3. **Make it personal**: choose which things to train and name your own places (your real hook, your real drawer).
4. **More situations**: friend's house, parents, library, car trip; pressure that depends on time, not only on moves.
5. **Visual mode**: first a flat floor plan (SVG), later an optional 3D wireframe view as another renderer on the same round engine (see the advice given on 2026-11-16: the command-and-choices mode stays the base).

## Story 0 done (2026-11-16)

Refactor without behaviour change: a golden test of one whole round, one contract for every flow (`step`, `choose`, `next`, `isFinished`, `onFinished`), no `instanceof` in `app-flow.js`, `World.garmentSpot`, the put-on sentence names the garment. 148 tests.

## Story 0b done (2026-11-16)

All texts and names moved to `app/js/texts/en.js` and injected; `layout.js` holds ids and icons only; refusals have codes. A few sentences changed wording (rooms lowercase inside a sentence, "Here, in the hallway", "1 move"). 170 tests.

## Story 1 done (2026-11-16)

`World.snapshot()` and `World.restore()`; the save is version 2 (language, things, plan, streaks, world, day, day count), validated field by field; the world is saved when a round ends. Nothing reads it yet: that is story 2. 198 tests.

## Story 2 done (2026-11-16)

Days made of events replace the round: `things.js` (catalogue), `scenario.js` (events of a day), `day.js` (runs them on a persistent world), new screens (put away, find, walk list with distances, pauses, a Menu link during a day), saving after every step and continuing after a reload. The old round, the points and the forced drop are gone. 346 tests. Not checked: dark mode, a real phone, a hurried put-away in the browser (unit tests only).

## Story 3 done (2026-11-16)

Every find records its steps and the shortest way; every put-away its steps. The end of a day is a summary: what is on its home spot tonight, what is elsewhere and where, steps spent searching against going straight, steps spent putting away, one line of advice, and "come back tomorrow" when a second day is finished on the same date. 453 tests. Not reached in the browser: the costly and the no-search summaries (unit tests only). **Now the user plays a few days before story 4.**

## Next

The decided plan to a usable version is in `plan.md` (2026-11-16): story 0 refactor, 0b texts ready for a second language, 1 the world persists, 2 days made of events, 3 find cost and day summary, 4 progress, 5 first use and choosing things, 6 bridge to real life, 7 putting things back, 8 hand-over. Build them in that order; move each to "Done" here when it is finished.

Later: away from home (friend, library, carry-along rule), flat floor plan, 3D view, sound.

## Open questions for later

- Language of the screens for the person who gets the app (English now); which things to offer (see `plan.md`).
- Sound and haptics: only if wanted.
