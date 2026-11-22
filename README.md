# Unforgettable

A small game that trains one habit: always put your things on their own fixed place, so you never have to search for them.

You choose a home spot for keys, wallet, phone and scissors. A new game starts with every thing on its home spot. Then you live through short sessions in a house. A session is an opener (coming home, going out for shopping or waking up in the morning; the opener of yesterday is not played twice in a row when another can open), two other *chains* and an evening (the stories follow the time of day: a session never goes back in time, so a morning story is always an opener and the pizza comes in the evening): small stories in which you do ordinary things with several objects, one after the other ("You feel like coffee. Take a pack from the cupboard. The pack has to be cut open ..."). Some objects are things you train with (keys, scissors), the others (the coffee, the tin) are only told.

The app never tells you to put a thing back: if you do not think of it yourself, the thing stays where it was used. You put things away on your own with "Something else first", which lists all your things, whether you hold them or not. A step that uses a thing (cutting with the scissors, paying with the wallet) needs it in your hand: if you put it away first, the story asks for it again before it goes on. A story after the first starts where you are, and a step is tied to a room only when the story needs the place. Every session ends with the evening, when the app asks once "Is everything back in its place?"; you answer Yes or "No, I forgot something", and the app never says whether you were right. You find out the next time the thing is needed and is not where you expect it. Between the steps of a story "Something else first" lets you put a thing away on your own or take your coat off. Every move costs steps: walking one room costs one step per door, looking at a spot or in a pocket costs one. Things stay where you left them, also the next session. Every session opens with a note: a new game (everything is in its home spot) or a game that goes on (everything is where you left it). Nothing points at a home spot while you play: you choose from memory. After a put-away the game tells you where the thing went, or, when it landed on its home spot, praises you with a short green note. A thing you find at once because it lay on its home spot is praised the moment you find it: that is when the habit pays off.

At the end of a session you see its summary in numbers: what searching cost against what it would have cost with everything on its home spot, what putting away cost, and one line of advice. It does not say what lies where. The last 300 finds and put-aways are kept in the browser for that.

Each screen is one command with its choices; one tap on a choice does it (a screen without choices, such as the opening of a session, has Next). "Settings" on the start screen switches to two taps: choose, then Next. The small Menu link at the top leaves a session for the start screen; "Continue session n" picks it up where it was. "Choose my home spots" opens a list of your things with where each lives; change any of them in any order, or none, and tap "I am done". Once a session has been started the start screen also has "Start again": after a question it erases your sessions and progress and puts every thing on its home spot again; your home spots stay. The small "Look back" link next to it shows the screens you have left in this session, one at a time and read only (nothing is redone); it starts empty with every new session and after a reload. Everything is saved in the browser (localStorage) after every step, nothing is sent anywhere.

Adding a chain is one file in `app/js/chains/` (with its `time`: `morning`, `day` or `evening`; a tell that uses a thing says so with `uses`), its sentences in `app/js/texts/en.js` (`chains.<chain>.<step>`) and one row in `app/js/chains.js`; `tests/chains.test.mjs` checks every chain in the list.

## Try it

```bash
npm start      # serves app/ on http://localhost:8080
npm test       # unit tests (Node's built-in runner, no dependencies)
```

`app/` is plain static files (ES modules, no build step); it is meant to be copied into `docs/unforgettable/` of the `my-wiki` repo. See `CLAUDE.md`.
