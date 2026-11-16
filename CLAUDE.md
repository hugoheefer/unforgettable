# unforgettable

A simple mobile-first web game that trains one habit: always put your things (keys, wallet, phone, tools) on their own fixed place, so you never have to search for them. Long-term goal: a daily practice game whose hints fade until the player's memory does the work. Source of truth is this repo; it is published as a public mirror in the user's website, the `hugoheefer/my-wiki` repo (Cloudflare Pages, static).

## General rules

My general working rules are in my private repo [hugoheefer/claude-config](https://github.com/hugoheefer/claude-config): `CLAUDE.md` (how I work, in every project) and `lang/<language>.md`. On my PC that repo is `~/.claude`. Where they are missing (a cloud session, another PC), read them from that repo before starting. This file adds what is specific to this project and wins where the two differ.

@~/.claude/lang/web.md

## Stack and layout (must fit my-wiki, user decisions 2026-11-16)

- Plain JavaScript ES modules with JSDoc types: no TypeScript, no bundler, no npm dependencies. There is no build step, so the mirror is a plain copy of the `app/` folder. A root `package.json` here is fine (this repo is not auto-built); it only holds `{"type": "module"}` and the `test` script.
- `app/` is the publishable folder: `index.html`, `css/`, `js/`. All links inside it are **relative**, so it works from `/unforgettable/` in my-wiki without changes.
- `tests/` holds `node --test` tests that import the modules from `app/js/`. Tests never go into the mirror.
- Tests: `node --test tests/*.test.mjs` (pass the glob; a bare folder does not work on every platform).
- Model on `pong` and `weather` in my-wiki: a thin glue file (`app/js/main.js`: DOM wiring only) and many small single-purpose modules of 20 to 300 lines, pure logic apart from DOM drawing, each with its own test file.
- Storage follows `pong-notice-store.js` in my-wiki: the module gets a storage getter injected and wraps access in try/catch, so a blocked localStorage never breaks the page.
- English UI. Port naming: role names (`Storage`, `Clock`, `RandomSource`).

## Publishing to my-wiki (own folder `docs/unforgettable/`, like `docs/trainer/`)

- The mirror is never edited by hand in my-wiki: fix things here (tests first), then copy `app/` to `docs/unforgettable/` in my-wiki and note the last copied commit in its `SETUP.md`.
- **The game is public.** my-wiki is behind login except the allow-list in `functions/lib/public-paths.js`, so the first publish adds a folder rule for `/unforgettable`, `/unforgettable/` and plain files under `/unforgettable/` (GET and HEAD only), modelled on the trainer rule that forbids `..` segments. Tests first in `tests/public-paths/` (the folder is public; `..` paths and look-alikes such as `/unforgettable-x/` stay private). Keep the list as small as possible.
- The page contains no personal data and no secrets; progress lives only in the visitor's own browser (localStorage), nothing is sent to a server. Add `noindex` like `pong.html` unless told otherwise.
- Pushing to `main` of my-wiki deploys at once and needs an explicit go-ahead; work on a side branch there. Say at the end what is live and what is not.

## Design decisions (with the reason)

- **One command and its choices per screen, then Next** (user decision 2026-11-16, after trying the second version: "too much information on one screen, it is not clear what to do"). Every screen is a `Step` (`lead`, `command`, `choices`, `selected`); `play-flow.js`, `setup-flow.js` and `app-flow.js` produce the steps, `screens.js` draws any step the same way. A choice only selects; the action happens on Next. Short feedback (what happened, moves left, the plan) goes in the small `lead` lines above the command, never in separate panels. The result screen is the one place that lists several lines, because that is the feedback the player learns from.

- **Core logic has no DOM, no `Date.now()`, no `Math.random()`**: time, randomness and storage come in through ports, so every scenario is a deterministic unit test.
- **Wrong places are cheap and tempting on purpose.** Research on habit cues shows people pick the cue that costs the least effort, so the nearest place must be the easy one and the home spot the one that costs an extra step.
- **Hints fade.** Reminders that never go away can stop a habit from forming, so the home-spot highlight goes from shown, to dimmed, to hidden as the streak per item grows.
