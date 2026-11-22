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

## The stories

Written out in `stories.md` (screens, rules, texts, tests, the catalogue of sixteen things). Stories 0 to 3 are complete; 4 to 8 are revisited after the user has played the core.

| Story | What it adds |
|---|---|
| 0 | Refactor: one flow contract, golden test, small encapsulation fixes |
| 0b | All texts in one module per language, injected (English only) |
| 1 | The world can be saved and restored; save format version 2 |
| 2 | Days made of events: things are used, put away, needed again; steps; hurry |
| 3 | What a find cost, and the day summary. **Then the user plays.** |
| 3b | Chains of events: everything starts in its place, small stories with several objects, sometimes silent about one thing, "Is everything back in its place?" with no answer from the app. Replaces the events of story 2 (user findings 2026-11-17) |
| 3d | Stories that make sense to a human: a moment to put a thing away before it is let go, openers take turns, a morning opener, shopping with the wallet, an ordered pizza, a call you make instead of a ringing phone (2026-11-22) |
| 3e | No step that a human would find strange: a step that uses a thing needs it in hand, stories follow the time of day, one narrating voice, no double "need", one screen per intention (2026-11-22) |
| 4 | My progress |
| 5 | Introduction, choosing things, suggested home spots, start again |
| 6 | If-then cards and the daily real-life question |
| 7 | Quiet moments to tidy up; saying a stray place out loud |
| 8 | Hand-over |

## Later, not part of "usable"

- **Levels** (user idea, 2026-11-17): a new player starts in level 1, the easy one: short chains with one thing silently left out. Higher levels get longer chains and more silent gaps. To prepare without building it: the numbers that decide how hard a day is (how many chains, the chance that a chain is silent, how many things a chain is silent about) are one settings object given to the builder of a day, not constants spread through the code; a level is then one row in a table of such settings.
- Away from home (friend, library, the carry-along rule), a flat floor plan, a 3D view, sound.

## Answered by the user (2026-11-16)

English for now, with the code prepared for more languages (story 0b). The list of things has sixteen entries, including cymbal bag, drumsticks, gate key, car papers, driver's licence and bank card. The stories are detailed by the planning model and built by an implementing agent.
