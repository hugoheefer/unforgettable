import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppFlow } from '../app/js/app-flow.js';
import { Day } from '../app/js/day.js';
import { chainIdsOf } from '../app/js/day-plan.js';
import { LAYOUT } from '../app/js/layout.js';
import { THINGS, defaultPlan } from '../app/js/things.js';
import { World, isPocket } from '../app/js/world.js';
import { checkFlowContract } from './flow-contract.mjs';
import { TEXTS } from './texts-helper.mjs';
import { dayState, find, letGo, pocket, putAway, rand, spot, tell, worldWith } from './day-helper.mjs';

const emptySave = () => ({
  plan: defaultPlan(), progress: { streaks: {} }, world: new World(LAYOUT).snapshot(), day: null, dayCount: 0,
  history: { finds: [], puts: [] }, lastDayFinishedOn: null, yesterdayChains: [],
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

// ---- a new game ----

test('a new game has every chosen thing on its home spot, before anything is played', () => {
  const { app } = newApp();
  assert.deepEqual(app.saveState().world.things, defaultPlan());
});

test('only the chosen things are put on their home spot', () => {
  const { app } = newApp({ things: [THINGS[0]] });
  assert.deepEqual(app.saveState().world.things, { keys: defaultPlan().keys });
});

test('starting day 1 shows a pause with the day number and no choices', () => {
  const { app } = newApp();
  pick(app, 'play');
  assert.deepEqual(app.step(), { lead: [], command: 'Day 1.', choices: [], selected: null, canLeave: true });
});

test('after the pause of the first day you stand at your front door and need your keys, which are in your coat', () => {
  const { app } = newApp();
  pick(app, 'play');
  app.next();
  assert.deepEqual(app.step().lead, ['You come home and stand at your front door.', 'You need your keys to get in.']);
  assert.equal(app.step().command, 'You need your 🔑 keys. Where do you look? You are in the garden.');
  assert.deepEqual(labels(app), ['Look here, in the garden', 'Look in a pocket', 'Walk to another room']);
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
  pick(app, 'door:kitchen');
  app.leave();
  assert.equal(saves.at(-1).day.steps, 2);
});

// ---- the home spots ----

const chooseSinkForEverything = (app) => {
  pick(app, 'setup');
  for (let i = 0; i < THINGS.length; i += 1) { pick(app, 'area:kitchen'); pick(app, 'place:sink'); }
};
const SINK = { placeId: 'kitchen', spotId: 'sink' };

test('choosing home spots leads through the questions and then back to the start screen, with the plan saved', () => {
  const { app, saves } = newApp();
  chooseSinkForEverything(app);
  assert.deepEqual(ids(app), ['play', 'setup']);
  assert.deepEqual(saves.at(-1).plan.keys, SINK);
});

test('before the first day has been started, a changed home spot moves the thing with it', () => {
  const { app, saves } = newApp();
  chooseSinkForEverything(app);
  assert.deepEqual(saves.at(-1).world.things, { keys: SINK, wallet: SINK, phone: SINK, scissors: SINK });
});

test('once the first day has been started, a changed home spot leaves the thing where it is', () => {
  const { app, saves } = newApp();
  pick(app, 'play');
  app.leave();
  chooseSinkForEverything(app);
  assert.deepEqual(saves.at(-1).world.things.keys, defaultPlan().keys);
});

test('after a finished day a changed home spot leaves the thing where it is', () => {
  const world = worldWith({ keys: spot('living', 'sofa'), wallet: pocket('coat', 'coat-inside'), phone: spot('kitchen', 'counter'), scissors: spot('kitchen', 'drawer') }).snapshot();
  const { app, saves } = newApp({ saved: { world, dayCount: 1 } });
  chooseSinkForEverything(app);
  assert.deepEqual(saves.at(-1).world.things.keys, spot('living', 'sofa'));
});

test('home spots chosen between two events of a day apply to the next put-away', () => {
  const day = dayState([putAway('keys')], { number: 3, inHand: ['keys'] });
  const { app } = newApp({ saved: { day, dayCount: 2, world: worldWith({}).snapshot() } });
  chooseSinkForEverything(app);
  pick(app, 'play');
  assert.deepEqual(app.step().lead, ['Your plan: in the sink in the kitchen.']);
});

// ---- the end of a day: the summary ----

const REST_AT_HOME = { wallet: pocket('coat', 'coat-inside'), phone: spot('kitchen', 'counter'), scissors: spot('study', 'desk-drawer') };
const found = (day, thingId, steps, shortest, wasHome = true) => ({ day, thingId, steps, shortest, wasHome });
const put = (day, thingId, steps, atHome = true) => ({ day, thingId, steps, atHome, left: false });

/** Day 3 stands at its last put-away: the keys in hand in the hallway. */
function dayThreeAtItsLastPutAway({ placed = {}, finds = [], puts = [], lastDayFinishedOn = null, dayCount = 2, number = 3 } = {}) {
  const world = worldWith({ ...REST_AT_HOME, ...placed }).snapshot();
  const day = dayState([putAway('keys')], { number, inHand: ['keys'] });
  return newApp({ saved: { world, day, dayCount, history: { finds, puts }, lastDayFinishedOn } });
}
function putTheKeysOnTheHook(app) {
  pick(app, 'play');
  pick(app, 'pockets');
  pick(app, 'pocket:coat/coat-right'); // their home spot: the right pocket of the coat
}
const OTHER_DAY_FIND = found(2, 'phone', 50, 2, false);
const OTHER_DAY_PUT = put(2, 'phone', 9, false);
const STRAIGHT = 'You went straight to your things. That is what a fixed place gives you.';

test('a cheap day ends with the searching line, the putting-away line and the straight advice', () => {
  const { app } = dayThreeAtItsLastPutAway({
    finds: [OTHER_DAY_FIND, found(3, 'keys', 1, 1), found(3, 'wallet', 1, 1)],
    puts: [OTHER_DAY_PUT, put(3, 'wallet', 4)],
  });
  putTheKeysOnTheHook(app);
  assert.deepEqual(app.step(), {
    lead: ['Searching cost 2 steps today. Going straight to each thing: 2.', 'Putting things away cost 4 steps.', STRAIGHT],
    command: 'Day 3 is done.',
    choices: [{ id: 'next', label: 'Start day 4' }, { id: 'start', label: 'Back to the start' }],
    selected: null,
  });
});

test('a costly day ends with the costly advice', () => {
  const { app } = dayThreeAtItsLastPutAway({ finds: [found(3, 'phone', 7, 2, false), found(3, 'keys', 2, 2)], puts: [put(3, 'phone', 4, false)] });
  putTheKeysOnTheHook(app);
  assert.deepEqual(app.step().lead, [
    'Searching cost 9 steps today. Going straight to each thing: 4.',
    'Putting things away cost 4 steps.',
    "Most of today's steps went into searching. A fixed place costs a few steps once.",
  ]);
});

test('a day without a find says there was nothing to search for and does not repeat it as advice', () => {
  const { app } = dayThreeAtItsLastPutAway({ finds: [found(2, 'phone', 50, 2, false)], puts: [put(3, 'phone', 4, false)] });
  putTheKeysOnTheHook(app);
  assert.deepEqual(app.step().lead, ['Nothing to search for today.', 'Putting things away cost 4 steps.']);
});

test('the summary does not say what lies where, whatever the world looks like', () => {
  const { app } = dayThreeAtItsLastPutAway({ placed: { phone: spot('garden', 'garden-table') }, finds: [found(3, 'keys', 1, 1)] });
  putTheKeysOnTheHook(app);
  assert.equal(/home spot|Somewhere else|Remember where|tonight|garden/i.test(app.step().lead.join(' ')), false);
});

test('the last put-away of the day is already in the summary of that day', () => {
  const { app } = dayThreeAtItsLastPutAway({ finds: [found(3, 'keys', 1, 1)] });
  putTheKeysOnTheHook(app);
  assert.equal(app.step().lead.includes('Putting things away cost 0 steps.'), true);
});

test('the summary comes from the injected texts', () => {
  const { app } = dayThreeAtItsLastPutAway({ finds: [found(3, 'keys', 1, 1)] });
  const custom = new AppFlow({
    layout: LAYOUT, things: THINGS, random: rand(), clock: clockAt(TODAY), onSave: () => {},
    texts: { ...TEXTS, puttingLine: () => 'LEGGEN', searchedLine: () => 'ZOEKEN' },
    saved: app.saveState(),
  });
  putTheKeysOnTheHook(custom);
  assert.deepEqual(custom.step().lead.slice(0, 2), ['ZOEKEN', 'LEGGEN']);
});

test('the end of a day is saved: no day in progress, one more finished day, and the streaks', () => {
  const { app, saves } = dayThreeAtItsLastPutAway({ finds: [found(3, 'keys', 1, 1)] });
  putTheKeysOnTheHook(app);
  assert.equal(saves.at(-1).day, null);
  assert.equal(saves.at(-1).dayCount, 3);
  assert.equal(saves.at(-1).progress.streaks.keys, 1);
});

test('"Back to the start" shows the start screen with the next day to start', () => {
  const { app } = dayThreeAtItsLastPutAway({ finds: [found(3, 'keys', 1, 1)] });
  putTheKeysOnTheHook(app);
  pick(app, 'start');
  assert.deepEqual(labels(app), ['Start day 4', 'Choose my home spots']);
});

// ---- the chains of a day ----

test('the chains a day played are saved when it ends, in the order they were played', () => {
  const { app, saves } = dayThreeAtItsLastPutAway({ finds: [found(3, 'keys', 1, 1)] });
  putTheKeysOnTheHook(app);
  assert.deepEqual(saves.at(-1).yesterdayChains, ['coffee']);
});

test('a new day is built from what was played yesterday: those chains are left for later', () => {
  const fresh = newApp();
  pick(fresh.app, 'play');
  assert.deepEqual(chainIdsOf(fresh.saves.at(-1).day.events), ['come-home', 'coffee', 'present']);
  const next = newApp({ saved: { yesterdayChains: ['coffee', 'present'] } });
  pick(next.app, 'play');
  assert.deepEqual(chainIdsOf(next.saves.at(-1).day.events), ['come-home', 'pizza', 'call']);
});

test('with the keys not on the person the day opens with going out', () => {
  const world = worldWith({ keys: spot('living', 'sofa'), wallet: pocket('coat', 'coat-inside'), phone: spot('kitchen', 'counter'), scissors: spot('kitchen', 'drawer') }).snapshot();
  const { app, saves } = newApp({ saved: { world, dayCount: 1 } });
  pick(app, 'play');
  assert.equal(chainIdsOf(saves.at(-1).day.events)[0], 'go-out');
  assert.deepEqual(saves.at(-1).world, world);
});

test('a chosen thing that is nowhere is put on its home spot when the day starts', () => {
  const world = worldWith({ keys: spot('living', 'sofa') }).snapshot();
  const { app, saves } = newApp({ saved: { world, dayCount: 1 } });
  pick(app, 'play');
  assert.deepEqual(saves.at(-1).world.things.wallet, defaultPlan().wallet);
  assert.deepEqual(saves.at(-1).world.things.keys, spot('living', 'sofa'));
});

// ---- the history ----

test('a find is saved with the number of the day', () => {
  const day = dayState([find('keys')], { number: 3, findStart: { shortest: 1, wasHome: true }, leftAt: { keys: spot('hall', 'console') } });
  const { app, saves } = newApp({ saved: { day, dayCount: 2, world: worldWith({ keys: spot('hall', 'hook') }).snapshot() } });
  pick(app, 'play');
  pick(app, 'spots');
  pick(app, 'spot:hook');
  assert.deepEqual(saves.at(-1).history.finds, [{ day: 3, thingId: 'keys', steps: 1, shortest: 1, wasHome: true }]);
});

test('a put-away is saved with the number of the day', () => {
  const { app, saves } = dayThreeAtItsLastPutAway();
  putTheKeysOnTheHook(app);
  assert.deepEqual(saves.at(-1).history.puts, [{ day: 3, thingId: 'keys', steps: 0, atHome: true, left: false }]);
});

test('a thing that was let go is saved as a put-away with left set, and lies where the story left it', () => {
  const day = dayState([tell('hall'), letGo(['keys'])], { number: 3, inHand: ['keys'], leftAt: { keys: spot('hall', 'console') } });
  const { app, saves } = newApp({ saved: { day, dayCount: 2, world: worldWith({}).snapshot() } });
  pick(app, 'play');
  pick(app, 'go');
  assert.deepEqual(saves.at(-1).history.puts, [{ day: 3, thingId: 'keys', steps: 0, atHome: false, left: true }]);
  assert.deepEqual(saves.at(-1).world.things.keys, spot('hall', 'console'));
  assert.equal(saves.at(-1).progress.streaks.keys, 0);
});

test('the history that was saved is kept and the new records come after it', () => {
  const old = put(2, 'keys', 9, false);
  const { app, saves } = dayThreeAtItsLastPutAway({ puts: [old] });
  putTheKeysOnTheHook(app);
  assert.equal(saves.at(-1).history.puts.length, 2);
  assert.deepEqual(saves.at(-1).history.puts[0], old);
});

// ---- saving ----

test('the state is saved after a Next that changed something, with the whole plain state', () => {
  const { app, saves } = newApp();
  pick(app, 'play');
  assert.equal(saves.length, 1);
  assert.deepEqual(Object.keys(saves[0]).sort(), ['day', 'dayCount', 'history', 'lastDayFinishedOn', 'plan', 'progress', 'world', 'yesterdayChains']);
  assert.equal(saves[0].day.number, 1);
  assert.equal(saves[0].dayCount, 0);
  assert.deepEqual(saves[0].plan, defaultPlan());
  assert.deepEqual(saves[0].progress, { streaks: {} });
  assert.deepEqual(saves[0].world.things, defaultPlan());
  assert.deepEqual(saves[0].history, { finds: [], puts: [] });
  assert.equal(saves[0].lastDayFinishedOn, null);
  assert.deepEqual(saves[0].yesterdayChains, []);
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

test('every find is saved with the thing in your hand and out of the world', () => {
  const { app, saves } = newApp();
  pick(app, 'play');
  app.next();
  pick(app, 'pockets');
  pick(app, 'pocket:coat/coat-right');
  assert.equal(saves.at(-1).world.things.keys, undefined);
  assert.deepEqual(saves.at(-1).day.inHand, ['keys']);
});

test('the saved state is plain data that survives a JSON round trip unchanged, and is a copy', () => {
  const { app, saves } = newApp();
  pick(app, 'play');
  app.next();
  const first = JSON.stringify(saves.at(-1));
  pick(app, 'pockets');
  pick(app, 'pocket:coat/coat-right');
  assert.equal(JSON.stringify(saves.at(-2)), first);
  assert.deepEqual(JSON.parse(JSON.stringify(saves.at(-1))), saves.at(-1));
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

test('a saved day that cannot be continued is dropped, the world is kept and a new day starts', () => {
  const full = Day.start({ layout: LAYOUT, things: THINGS, world: new World(LAYOUT), plan: defaultPlan(), progress: { streaks: {} }, random: rand(), number: 3 });
  const world = worldWith({ keys: spot('living', 'sofa') }).snapshot();
  const withoutScissors = THINGS.filter((thing) => thing.id !== 'scissors');
  const { app, saves } = newApp({ things: withoutScissors, saved: { day: full.snapshot(), dayCount: 2, world } });
  assert.deepEqual(labels(app), ['Start day 3', 'Choose my home spots']);
  pick(app, 'play');
  assert.deepEqual(saves.at(-1).world.things.keys, spot('living', 'sofa'));
  assert.equal(saves.at(-1).day.number, 3);
  assert.equal(saves.at(-1).day.events.some((event) => event.thingId === 'scissors'), false);
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
  const texts = { ...TEXTS, startDay: ({ number }) => `DAG ${number}`, findCommand: () => 'ZOEK', whereToKeep: () => 'WAAR?' };
  const { app } = newApp({ texts });
  assert.equal(labels(app)[0], 'DAG 1');
  pick(app, 'setup');
  assert.equal(app.step().command, 'WAAR?');
  const other = newApp({ texts }).app;
  pick(other, 'play');
  other.next();
  assert.equal(other.step().command, 'ZOEK');
});

// ---- the next night is the real test ----

const comeBack = 'Come back tomorrow. A night in between is the real test.';

test('the first day ever has no line about coming back tomorrow', () => {
  const { app } = dayThreeAtItsLastPutAway({ dayCount: 0, number: 1 });
  putTheKeysOnTheHook(app);
  assert.equal(app.step().command, 'Day 1 is done.');
  assert.equal(app.step().lead.includes(comeBack), false);
});

test('a day finished on the same date as the day before ends with the line about coming back tomorrow', () => {
  const { app } = dayThreeAtItsLastPutAway({ lastDayFinishedOn: TODAY });
  putTheKeysOnTheHook(app);
  assert.equal(app.step().lead.at(-1), comeBack);
});

test('a day finished on a later date than the day before does not have that line', () => {
  const { app } = dayThreeAtItsLastPutAway({ lastDayFinishedOn: '2026-11-15' });
  putTheKeysOnTheHook(app);
  assert.equal(app.step().lead.includes(comeBack), false);
});

test('the date on which a day was finished is saved when it ends, not when it starts', () => {
  const { app, saves } = dayThreeAtItsLastPutAway();
  pick(app, 'play');
  assert.equal(app.saveState().lastDayFinishedOn, null);
  pick(app, 'pockets');
  pick(app, 'pocket:coat/coat-right');
  assert.equal(saves.at(-1).lastDayFinishedOn, TODAY);
});

// ---- whole days through the screens ----

const walkTo = (app, roomId) => { pick(app, 'doors'); pick(app, `door:${roomId}`); };

/** Answers whatever screen is up, the way a player who knows the house would. */
function answer(app) {
  const state = app.day.state();
  const offered = ids(app);
  if (offered.length === 0) return app.next();
  if (offered.includes('go')) return pick(app, 'go');
  if (offered.includes('yes')) return pick(app, 'yes');
  if (state.returnTo) return walkTo(app, state.returnTo);
  const { event } = state;
  if (event.kind === 'goTo') return walkTo(app, event.roomId);
  if (event.kind === 'putAway') { pick(app, 'pockets'); return pick(app, 'pocket:coat/coat-left'); }
  const at = app.world.whereIs(event.thingId);
  if (isPocket(at)) { pick(app, 'pockets'); return pick(app, `pocket:${at.garmentId}/${at.pocketId}`); }
  if (at.placeId !== state.roomId) return walkTo(app, at.placeId);
  pick(app, 'spots');
  return pick(app, `spot:${at.spotId}`);
}

function playDay(app, number) {
  for (let guard = 0; app.step().command !== `Day ${number} is done.`; guard += 1) {
    if (guard > 400) throw new Error(`stuck on: ${app.step().command}`);
    answer(app);
  }
}

test('a whole first day of the real chains can be played through the screens, and ends with its summary', () => {
  const { app } = newApp();
  pick(app, 'play');
  playDay(app, 1);
  assert.equal(app.step().lead.length >= 2, true);
  assert.deepEqual(ids(app), ['next', 'start']);
});

test('two days in a row, with a silent chain on both, can be played, and what was let go is in the history', () => {
  const { app, saves } = newApp({ random: rand({ chance: () => true }) });
  pick(app, 'play');
  playDay(app, 1);
  pick(app, 'next');
  playDay(app, 2);
  assert.equal(saves.at(-1).dayCount, 2);
  assert.equal(saves.at(-1).history.puts.some((record) => record.left === true), true);
});
