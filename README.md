# Unforgettable

A small game that trains one habit: always put your things on their own fixed place, so you never have to search for them.

You choose a home spot for keys, wallet, phone and scissors. Then you live through short days in a house. A day is a list of events: you come home and put things away, leave and come back, and use things around the house (find the phone, walk to the garden, put it away). Every move costs steps: walking one room costs one step per door, looking at a spot or in a pocket costs one, and so does taking your coat off. Now and then you are in a hurry and can only walk to the next room. Things stay where you left them, also the next day, so a thing put down anywhere has to be found again later. A thing on its home spot is found at once; as the streak per thing grows, the hint fades from a star with the plan, to a star, to nothing.

At the end of a day you see its summary in numbers: which things are on their home spot tonight, which are somewhere else, what searching cost against what it would have cost with everything on its home spot, what putting away cost, and one line of advice. The last 300 finds and put-aways are kept in the browser for that.

Each screen is one command with its choices; pick one and tap Next. The small Menu link at the top leaves a day for the start screen; "Continue day n" picks it up where it was. Everything is saved in the browser (localStorage) after every step, nothing is sent anywhere.

## Try it

```bash
npm start      # serves app/ on http://localhost:8080
npm test       # unit tests (Node's built-in runner, no dependencies)
```

`app/` is plain static files (ES modules, no build step); it is meant to be copied into `docs/unforgettable/` of the `my-wiki` repo. See `CLAUDE.md`.
