import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppFlow } from '../app/js/app-flow.js';
import { Day } from '../app/js/day.js';
import { LAYOUT } from '../app/js/layout.js';
import { THINGS, defaultPlan } from '../app/js/things.js';
import { World } from '../app/js/world.js';
import { checkFlowContract } from './flow-contract.mjs';
import { TEXTS } from './texts-helper.mjs';
import { pocket, rand, spot, worldWith } from './day-helper.mjs';

const emptySave = () => ({ plan: defaultPlan(), progress: { streaks: {} }, world: new World(LAYOUT).snapshot(), day: null, dayCount: 0 });

function newApp(overrides = {}) {
  const { saved, ...rest } = overrides;
  const saves = [];
  const app = new AppFlow({
    layout: LAYOUT,
    things: THINGS,
    texts: TEXTS,
    random: rand(),
    saved: { ...emptySave(), ...saved },
    onSave: (state) => saves.push(state),
    ...rest,
  });
  return { app, saves };
}
const ids = (app) => app.step().choices.map((entry) => entry.id);
const labels = (app) => app.step().choices.map((entry) => entry.label);
const pick = (app, id) => { app.choose(id); app.next(); };
const putInTheLeftPocket = (app) => { pick(app, 'pockets'); pick(app, 'pocket:coat/coat-left'); };

/** Plays the whole first day: everything goes into the left pocket of the coat, the two uses are found there. */
function playDayOne(app) {
  pick(app, 'play');
  app.next(); // "Day 1."
  for (let i = 0; i < 8; i += 1) putInTheLeftPocket(app); // four put-aways, then two times a find and a put-away
}

// ---- the start screen ----

test('a new player is offered to start day 1 or to choose home spots', () => {
  const { app } = newApp();
  assert.deepEqual(app.step(), {
    lead: [],
    command: 'Unforgettable. Always put your things in the same place.',
    choices: [{ id: 'play', label: 'Start day 1' }, { id: 'setup', label: 'Choose my home spots' }],
    selected: null,
  });
});

test('the start screen has no Menu link', () => {
  assert.notEqual(newApp().app.step().canLeave, true);
});

test('with a day in progress the player is offered to continue it', () => {
  const day = Day.start({ layout: LAYOUT, things: THINGS, world: new World(LAYOUT), plan: defaultPlan(), progress: { streaks: {} }, random: rand(), number: 3 });
  const { app } = newApp({ saved: { day: day.snapshot(), dayCount: 2 } });
  assert.deepEqual(labels(app), ['Continue day 3', 'Choose my home spots']);
});

test('after a finished day the player is offered the next day', () => {
  const { app } = newApp({ saved: { dayCount: 2 } });
  assert.deepEqual(labels(app), ['Start day 3', 'Choose my home spots']);
});

test('starting day 1 shows a pause with the day number and no choices', () => {
  const { app } = newApp();
  pick(app, 'play');
  assert.deepEqual(app.step(), { lead: [], command: 'Day 1.', choices: [], selected: null, canLeave: true });
});

test('after the pause of the first day you come home and put the first thing away', () => {
  const { app } = newApp();
  pick(app, 'play');
  app.next();
  assert.equal(app.step().lead[0], 'You come home.');
  assert.equal(app.step().command, 'You are in the hallway. Put your 🔑 keys away.');
});

// ---- the Menu ----

test('the Menu returns from a day to the start screen, and the day continues where it was', () => {
  const { app } = newApp();
  pick(app, 'play');
  app.next();
  pick(app, 'doors');
  pick(app, 'door:kitchen');
  const before = app.step().command;
  app.leave();
  assert.deepEqual(labels(app), ['Continue day 1', 'Choose my home spots']);
  pick(app, 'play');
  assert.equal(app.step().command, before);
  assert.match(before, /kitchen/);
});

test('leaving a day keeps the steps already spent in the event', () => {
  const { app, saves } = newApp();
  pick(app, 'play');
  app.next();
  pick(app, 'doors');
  pick(app, 'door:dining');
  app.leave();
  assert.equal(saves.at(-1).day.steps, 2);
});

// ---- the home spots ----

const chooseSinkForEverything = (app) => {
  pick(app, 'setup');
  for (let i = 0; i < THINGS.length; i += 1) { pick(app, 'area:kitchen'); pick(app, 'place:sink'); }
};

test('choosing home spots leads through the questions and then back to the start screen, with the plan saved', () => {
  const { app, saves } = newApp();
  chooseSinkForEverything(app);
  assert.deepEqual(ids(app), ['play', 'setup']);
  assert.deepEqual(saves.at(-1).plan.keys, { placeId: 'kitchen', spotId: 'sink' });
});

test('home spots chosen between two events of a day apply to the next put-away', () => {
  const { app } = newApp();
  pick(app, 'play');
  app.next();
  app.leave();
  chooseSinkForEverything(app);
  pick(app, 'play');
  assert.deepEqual(app.step().lead, ['You come home.', 'Your plan: in the sink in the kitchen.']);
});

// ---- a whole day ----

test('when the last event is done the app says the day is done, and offers the next day or the start', () => {
  const { app } = newApp();
  playDayOne(app);
  assert.deepEqual(app.step(), {
    lead: [],
    command: 'Day 1 is done.',
    choices: [{ id: 'next', label: 'Start day 2' }, { id: 'start', label: 'Back to the start' }],
    selected: null,
  });
});

test('the end of a day is saved: no day in progress and one more finished day', () => {
  const { app, saves } = newApp();
  playDayOne(app);
  assert.equal(saves.at(-1).day, null);
  assert.equal(saves.at(-1).dayCount, 1);
});

test('the streaks of the day are saved with the end of the day', () => {
  const { app, saves } = newApp();
  playDayOne(app);
  assert.deepEqual(saves.at(-1).progress.streaks, { keys: 0, wallet: 0, phone: 0, scissors: 0 });
});

test('"Back to the start" shows the start screen with the next day to start', () => {
  const { app } = newApp();
  playDayOne(app);
  pick(app, 'start');
  assert.deepEqual(labels(app), ['Start day 2', 'Choose my home spots']);
});

test('the next day starts with the world of the day before', () => {
  const { app, saves } = newApp();
  playDayOne(app);
  pick(app, 'next');
  assert.equal(app.step().command, 'Day 2.');
  assert.deepEqual(saves.at(-1).world.things.keys, { garmentId: 'coat', pocketId: 'coat-left' });
  assert.equal(saves.at(-1).day.number, 2);
});

// ---- saving ----

test('the state is saved after a Next that changed something, with the whole plain state', () => {
  const { app, saves } = newApp();
  pick(app, 'play');
  assert.equal(saves.length, 1);
  assert.deepEqual(Object.keys(saves[0]).sort(), ['dayCount', 'day', 'plan', 'progress', 'world'].sort());
  assert.equal(saves[0].day.number, 1);
  assert.equal(saves[0].dayCount, 0);
  assert.deepEqual(saves[0].plan, defaultPlan());
  assert.deepEqual(saves[0].progress, { streaks: {} });
  assert.deepEqual(saves[0].world.things, {});
});

test('nothing is saved when Next changed nothing', () => {
  const { app, saves } = newApp();
  app.next();
  pick(app, 'play');
  const before = saves.length;
  app.next(); // the pause: this moves the day on
  const after = saves.length;
  assert.equal(after, before + 1);
  pick(app, 'spots'); // only opens a list
  assert.equal(saves.length, after);
});

test('every put-away is saved with the thing in its new place', () => {
  const { app, saves } = newApp();
  pick(app, 'play');
  app.next();
  putInTheLeftPocket(app);
  assert.deepEqual(saves.at(-1).world.things.keys, { garmentId: 'coat', pocketId: 'coat-left' });
  assert.equal(saves.at(-1).day.index, 3);
});

test('the saved state is plain data that survives a JSON round trip unchanged', () => {
  const { app, saves } = newApp();
  pick(app, 'play');
  app.next();
  putInTheLeftPocket(app);
  assert.deepEqual(JSON.parse(JSON.stringify(saves.at(-1))), saves.at(-1));
});

test('a saved state is a copy: playing on does not change it', () => {
  const { app, saves } = newApp();
  pick(app, 'play');
  app.next();
  const first = JSON.stringify(saves.at(-1));
  putInTheLeftPocket(app);
  assert.equal(JSON.stringify(saves.at(-2)), first);
});

// ---- restoring ----

test('an app started from a saved state in the middle of an event continues exactly there', () => {
  const first = newApp();
  pick(first.app, 'play');
  first.app.next();
  pick(first.app, 'doors');
  pick(first.app, 'door:kitchen');
  const again = newApp({ saved: first.saves.at(-1) });
  assert.deepEqual(labels(again.app), ['Continue day 1', 'Choose my home spots']);
  pick(again.app, 'play');
  assert.deepEqual(again.app.step(), first.app.step());
});

test('the world of the saved state is restored, so things lie where they were left', () => {
  const world = worldWith({ keys: spot('living', 'sofa'), wallet: pocket('coat', 'coat-left'), phone: spot('kitchen', 'counter'), scissors: spot('study', 'desk') }).snapshot();
  const { app, saves } = newApp({ saved: { world, dayCount: 1 } });
  pick(app, 'play');
  assert.deepEqual(saves.at(-1).world, world);
  assert.equal(saves.at(-1).day.events.some((event) => event.text === 'morning'), true); // nothing is nowhere, so you leave and come home
});

test('a saved day that cannot be continued is dropped, the world is kept and a new day starts', () => {
  const full = Day.start({ layout: LAYOUT, things: THINGS, world: new World(LAYOUT), plan: defaultPlan(), progress: { streaks: {} }, random: rand(), number: 3 });
  const world = worldWith({ keys: spot('living', 'sofa') }).snapshot();
  const withoutScissors = THINGS.filter((thing) => thing.id !== 'scissors');
  const { app, saves } = newApp({ things: withoutScissors, saved: { day: full.snapshot(), dayCount: 2, world } });
  assert.deepEqual(labels(app), ['Start day 3', 'Choose my home spots']);
  pick(app, 'play');
  assert.deepEqual(saves.at(-1).world.things.keys, spot('living', 'sofa'));
  assert.equal(saves.at(-1).day.number, 3);
  assert.equal(JSON.stringify(saves.at(-1).day.events).includes('scissors'), false);
});

test('a saved day with a broken field is dropped too', () => {
  const day = Day.start({ layout: LAYOUT, things: THINGS, world: new World(LAYOUT), plan: defaultPlan(), progress: { streaks: {} }, random: rand(), number: 1 });
  const broken = { ...day.snapshot(), events: [{ kind: 'dance' }] };
  const { app } = newApp({ saved: { day: broken } });
  assert.deepEqual(labels(app), ['Start day 1', 'Choose my home spots']);
});

// ---- the flow contract and the texts ----

checkFlowContract('AppFlow', () => newApp().app);

test('the welcome comes from the injected texts, not from the code', () => {
  assert.equal(newApp({ texts: { ...TEXTS, welcome: 'WELKOM' } }).app.step().command, 'WELKOM');
});

test('the labels of the start screen and the questions of the day come from the injected texts', () => {
  const texts = { ...TEXTS, startDay: ({ number }) => `DAG ${number}`, putCommand: () => 'LEG NEER', whereToKeep: () => 'WAAR?' };
  const { app } = newApp({ texts });
  assert.equal(labels(app)[0], 'DAG 1');
  pick(app, 'setup');
  assert.equal(app.step().command, 'WAAR?');
  const other = newApp({ texts }).app;
  pick(other, 'play');
  other.next();
  assert.equal(other.step().command, 'LEG NEER');
});
