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

## Next (in order; each step: tests red first, then code, then you review)

0. **Project setup**: `package.json` (`type: module`, `test` script), `app/index.html` + `app/css/` + `app/js/main.js` with relative links, a first `tests/*.test.mjs` run with `node --test`, README; smoke check that `app/index.html` loads in Playwright.
1. **World model** (pure): `Place` (with exit/enter links and "effort to reach"), `Item`, `Pocket`. First tests: placing an item puts it in that place; an item is in exactly one place; moving between places keeps one place active.
2. **Home-spot plans** (pure): player sets item → home spot; validation (spot exists, one home spot per item).
3. **Scoring and habit stats** (pure): placing at the home spot scores; a wrong place scores less and is remembered as the item's real location; streak per item; hint level derived from streak (computed, not stored).
4. **Find phase** (pure): prompt asks for an item; each opened place costs time via `Clock`; finding at once scores best; systematic search (no re-opening places) beats random.
5. **Scenario engine** (pure, `RandomSource` injected): pressure events (call, full hands, visitor, hurry), distraction before the find prompt, surprise timing, variation across rounds.
6. **Storage**: `Storage` port with a localStorage adapter (progress stays on the device; no server) and an in-memory double; progress merged field by field with defaults so old or damaged data still loads.
7. **UI v1**: one place visible at a time, pictogram items, tap to place or open; screens: setup, drop, find, feedback. UI maps taps to intents; no logic.
8. **Progress screen**: streaks per item, hint fading visible, simple history.
9. **Away-from-home scenarios**: friend's house, parents, library with the carry-along rule.
9b. **Publish to my-wiki** (needs your go-ahead: it widens the login wall and a push to `main` deploys): in my-wiki, on a side branch, add the `/unforgettable` folder rule to `functions/lib/public-paths.js` with tests red first (including `..` paths and look-alikes that must stay private), copy `app/` to `docs/unforgettable/`, add a homepage card, update `SETUP.md` (public paths paragraph, last copied commit).
10. **Docs**: README, short user manual; check the look on a phone (screenshot + your review).

## Open questions for later

- Exact scoring numbers (tune from play, not guessed).
- Sound and haptics: only if wanted.
