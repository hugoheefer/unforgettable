# Unforgettable

A small game that trains one habit: always put your things on their own fixed place, so you never have to search for them.

You choose a home spot for keys, wallet, phone and scissors. A new game starts with every thing on its home spot. Then you live through short days in a house. A day is two or three *chains*: small stories in which you do ordinary things with several objects, one after the other ("You feel like coffee. Take a pack from the cupboard. The pack has to be cut open ..."). Some objects are things you train with (keys, scissors), the others (the coffee, the tin) are only told.

In a *guided* chain the app says "Put your scissors back". In a *silent* chain it says nothing about one of the things: if you do not think of it, it stays where it was used. Later the app asks "Is everything back in its place?"; you answer Yes or "No, I forgot something", and the app never says whether you were right. You find out the next time the thing is needed and is not where you expect it. Between the steps of a story "Something else first" lets you put a thing away on your own or take your coat off. Every move costs steps: walking one room costs one step per door, looking at a spot or in a pocket costs one. Things stay where you left them, also the next day. A thing on its home spot is found at once; as the streak per thing grows, the hint fades from a star with the plan, to a star, to nothing.

At the end of a day you see its summary in numbers: what searching cost against what it would have cost with everything on its home spot, what putting away cost, and one line of advice. It does not say what lies where. The last 300 finds and put-aways are kept in the browser for that.

Each screen is one command with its choices; pick one and tap Next (a story step you only have to read has "Go on" selected already). The small Menu link at the top leaves a day for the start screen; "Continue day n" picks it up where it was. Everything is saved in the browser (localStorage) after every step, nothing is sent anywhere.

Adding a chain is one file in `app/js/chains/`, its sentences in `app/js/texts/en.js` (`chains.<chain>.<step>`) and one row in `app/js/chains.js`; `tests/chains.test.mjs` checks every chain in the list.

## Try it

```bash
npm start      # serves app/ on http://localhost:8080
npm test       # unit tests (Node's built-in runner, no dependencies)
```

`app/` is plain static files (ES modules, no build step); it is meant to be copied into `docs/unforgettable/` of the `my-wiki` repo. See `CLAUDE.md`.
