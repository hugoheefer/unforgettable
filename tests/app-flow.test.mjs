import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppFlow } from '../app/js/app-flow.js';
import { Day } from '../app/js/day.js';
import { LAYOUT } from '../app/js/layout.js';
import { THINGS, defaultPlan } from '../app/js/things.js';
import { World } from '../app/js/world.js';
import { checkFlowContract } from './flow-contract.mjs';
import { TEXTS } from './texts-helper.mjs';
import { dayState, pocket, putAway, rand, spot, worldWith } from './day-helper.mjs';

const emptySave = () => ({
  plan: defaultPlan(), progress: { streaks: {} }, world: new World(LAYOUT).snapshot(), day: null, dayCount: 0,
  history: { finds: [], puts: [] }, lastDayFinishedOn: null,
});

const TODAY = '2026-11-16';
const clockAt = (date) => ({ today: () => date });

function newApp(overrides = {}) {
  const { saved, ...rest } = overrides;
  const saves = [];
  const app = new AppFlow({
    layout: LAYOUT,
    things: THINGS,
    texts: TEXTS,
    random: rand(),
    clock: clockAt(TODAY),
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

test('when the last event is done the app says the day is done, with the summary of the day and the next steps', () => {
  const { app } = newApp();
  playDayOne(app);
  assert.deepEqual(app.step(), {
    lead: [
      'Somewhere else: keys (in the left pocket of your coat), wallet (in the left pocket of your coat), phone (in the left pocket of your coat), scissors (in the left pocket of your coat).',
      'Searching cost 2 steps today. Going straight to each thing: 2.',
      'Putting things away cost 0 steps.',
      'Remember where you left: keys, wallet, phone, scissors. Tomorrow you will know.',
    ],
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
  assert.deepEqual(Object.keys(saves[0]).sort(), ['dayCount', 'day', 'history', 'lastDayFinishedOn', 'plan', 'progress', 'world'].sort());
  assert.equal(saves[0].day.number, 1);
  assert.equal(saves[0].dayCount, 0);
  assert.deepEqual(saves[0].plan, defaultPlan());
  assert.deepEqual(saves[0].progress, { streaks: {} });
  assert.deepEqual(saves[0].world.things, {});
  assert.deepEqual(saves[0].history, { finds: [], puts: [] });
  assert.equal(saves[0].lastDayFinishedOn, null);
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

// ---- the history of finds and put-aways ----

test('every find and put-away of a day is saved with the number of the day', () => {
  const { app, saves } = newApp();
  playDayOne(app);
  const { finds, puts } = saves.at(-1).history;
  assert.deepEqual(finds.map((record) => [record.day, record.thingId, record.steps, record.shortest, record.wasHome]), [
    [1, 'keys', 1, 1, false],
    [1, 'wallet', 1, 1, false],
  ]);
  assert.deepEqual(puts.map((record) => [record.day, record.thingId, record.steps, record.atHome, record.hurry]), [
    [1, 'keys', 0, false, false], [1, 'wallet', 0, false, false], [1, 'phone', 0, false, false],
    [1, 'scissors', 0, false, false], [1, 'keys', 0, false, false], [1, 'wallet', 0, false, false],
  ]);
});

test('the history that was saved is kept and the new records come after it', () => {
  const old = { day: 0, thingId: 'keys', steps: 9, shortest: 1, wasHome: false };
  const { app, saves } = newApp({ saved: { history: { finds: [old], puts: [] } } });
  playDayOne(app);
  assert.equal(saves.at(-1).history.finds.length, 3);
  assert.deepEqual(saves.at(-1).history.finds[0], old);
});

test('the saved history is plain data that survives a JSON round trip', () => {
  const { app, saves } = newApp();
  playDayOne(app);
  assert.deepEqual(JSON.parse(JSON.stringify(saves.at(-1))), saves.at(-1));
});

// ---- the summary of a day, from days built for it ----

const REST_AT_HOME = { wallet: pocket('coat', 'coat-inside'), phone: spot('kitchen', 'counter'), scissors: spot('study', 'desk-drawer') };
const found = (day, thingId, steps, shortest, wasHome = true) => ({ day, thingId, steps, shortest, wasHome });
const put = (day, thingId, steps, atHome = true) => ({ day, thingId, steps, atHome, hurry: false });

/** Day 3 stands at its last event: the keys in hand in the living room, one walk of 1 step away from the key hook. */
function dayThreeAtItsLastPutAway({ placed = {}, finds = [], puts = [], lastDayFinishedOn = null }) {
  const world = worldWith({ ...REST_AT_HOME, ...placed }).snapshot();
  const day = dayState([putAway('keys')], { number: 3, roomId: 'living', startedIn: 'living', inHand: ['keys'] });
  return newApp({ saved: { world, day, dayCount: 2, history: { finds, puts }, lastDayFinishedOn } }).app;
}
function putTheKeysOnTheHook(app) {
  pick(app, 'play');
  pick(app, 'doors');
  pick(app, 'door:hall');
  pick(app, 'spots');
  pick(app, 'spot:hook');
}
const OTHER_DAY_FIND = found(2, 'phone', 50, 2, false);
const OTHER_DAY_PUT = put(2, 'phone', 9, false);

test('a day with everything on its home spot ends with the allHome summary and no line about things elsewhere', () => {
  const app = dayThreeAtItsLastPutAway({
    finds: [OTHER_DAY_FIND, found(3, 'keys', 1, 1), found(3, 'wallet', 1, 1)],
    puts: [OTHER_DAY_PUT, put(3, 'wallet', 4)],
  });
  putTheKeysOnTheHook(app);
  assert.deepEqual(app.step(), {
    lead: [
      'On the home spot tonight: keys, wallet, phone, scissors.',
      'Searching cost 2 steps today. Going straight to each thing: 2.',
      'Putting things away cost 5 steps.',
      'Everything is in its place. Tomorrow you will find it without thinking.',
    ],
    command: 'Day 3 is done.',
    choices: [{ id: 'next', label: 'Start day 4' }, { id: 'start', label: 'Back to the start' }],
    selected: null,
  });
});

test('a day with a thing elsewhere and costly searching ends with both lines and the costly advice', () => {
  const app = dayThreeAtItsLastPutAway({
    placed: { phone: spot('garden', 'garden-table') },
    finds: [found(3, 'phone', 7, 2, false), found(3, 'keys', 2, 2)],
    puts: [put(3, 'phone', 4, false)],
  });
  putTheKeysOnTheHook(app);
  assert.deepEqual(app.step().lead, [
    'On the home spot tonight: keys, wallet, scissors.',
    'Somewhere else: phone (on the garden table).',
    'Searching cost 9 steps today. Going straight to each thing: 4.',
    'Putting things away cost 5 steps.',
    "Most of today's steps went into searching. A fixed place costs a few steps once.",
  ]);
});

test('a day without a find says there was nothing to search for and does not repeat it as advice', () => {
  const app = dayThreeAtItsLastPutAway({
    placed: { phone: spot('garden', 'garden-table') },
    finds: [found(2, 'phone', 50, 2, false)],
    puts: [put(3, 'phone', 4, false)],
  });
  putTheKeysOnTheHook(app);
  assert.deepEqual(app.step().lead, [
    'On the home spot tonight: keys, wallet, scissors.',
    'Somewhere else: phone (on the garden table).',
    'Nothing to search for today.',
    'Putting things away cost 5 steps.',
  ]);
});

test('the last put-away of the day is already in the summary of that day', () => {
  const app = dayThreeAtItsLastPutAway({ finds: [found(3, 'keys', 1, 1)], puts: [] });
  putTheKeysOnTheHook(app);
  assert.equal(app.step().lead.includes('Putting things away cost 1 step.'), true);
});

test('the summary comes from the injected texts', () => {
  const app = new AppFlow({
    layout: LAYOUT, things: THINGS, random: rand(), clock: clockAt(TODAY), onSave: () => {},
    texts: { ...TEXTS, puttingLine: () => 'LEGGEN', searchedLine: () => 'ZOEKEN' },
    saved: {
      ...emptySave(),
      world: worldWith(REST_AT_HOME).snapshot(),
      day: dayState([putAway('keys')], { number: 3, inHand: ['keys'] }),
      dayCount: 2,
      history: { finds: [found(3, 'keys', 1, 1)], puts: [] },
    },
  });
  pick(app, 'play');
  pick(app, 'spots');
  pick(app, 'spot:hook');
  assert.deepEqual(app.step().lead.slice(1, 3), ['ZOEKEN', 'LEGGEN']);
});

// ---- the next night is the real test ----

const oneThing = [THINGS[0]];
const comeBack = 'Come back tomorrow. A night in between is the real test.';

/** With only the keys: put them away, find them, put them away again. */
function playKeysOnlyDayOne(app) {
  pick(app, 'play');
  app.next();
  for (let i = 0; i < 3; i += 1) putInTheLeftPocket(app);
}
/** Day 2 with only the keys: leave (a find), put away, a use (a find) and put away. */
function playKeysOnlyDayTwo(app) {
  app.next(); // "Day 2."
  putInTheLeftPocket(app);
  app.next(); // "You are out for the day."
  for (let i = 0; i < 3; i += 1) putInTheLeftPocket(app);
}

test('the first day ever has no line about coming back tomorrow', () => {
  const { app } = newApp({ things: oneThing });
  playKeysOnlyDayOne(app);
  assert.equal(app.step().command, 'Day 1 is done.');
  assert.equal(app.step().lead.includes(comeBack), false);
});

test('a second day finished on the same date as the first ends with the line about coming back tomorrow', () => {
  const { app } = newApp({ things: oneThing });
  playKeysOnlyDayOne(app);
  pick(app, 'next');
  playKeysOnlyDayTwo(app);
  assert.equal(app.step().command, 'Day 2 is done.');
  assert.equal(app.step().lead.at(-1), comeBack);
});

test('a day finished on a later date than the day before does not have that line', () => {
  let date = TODAY;
  const { app } = newApp({ things: oneThing, clock: { today: () => date } });
  playKeysOnlyDayOne(app);
  pick(app, 'next');
  date = '2026-11-17';
  playKeysOnlyDayTwo(app);
  assert.equal(app.step().command, 'Day 2 is done.');
  assert.equal(app.step().lead.includes(comeBack), false);
});

test('the date on which a day was finished is saved when it ends, not when it starts', () => {
  let date = TODAY;
  const { app, saves } = newApp({ things: oneThing, clock: { today: () => date } });
  pick(app, 'play');
  assert.equal(saves.at(-1).lastDayFinishedOn, null);
  app.next();
  for (let i = 0; i < 3; i += 1) putInTheLeftPocket(app);
  assert.equal(saves.at(-1).lastDayFinishedOn, TODAY);
  date = '2026-11-17';
  pick(app, 'next');
  playKeysOnlyDayTwo(app);
  assert.equal(saves.at(-1).lastDayFinishedOn, '2026-11-17');
});

test('the line about coming back tomorrow survives a reload in the middle of the day', () => {
  const app = dayThreeAtItsLastPutAway({ finds: [found(3, 'keys', 1, 1)], lastDayFinishedOn: TODAY });
  putTheKeysOnTheHook(app);
  assert.equal(app.step().lead.at(-1), comeBack);
});
