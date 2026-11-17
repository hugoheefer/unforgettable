import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppFlow } from '../app/js/app-flow.js';
import { Day, EVENT_KINDS } from '../app/js/day.js';
import { chainIdsOf } from '../app/js/day-plan.js';
import { LAYOUT } from '../app/js/layout.js';
import { THINGS, defaultPlan } from '../app/js/things.js';
import { World, isPocket } from '../app/js/world.js';
import { checkFlowContract } from './flow-contract.mjs';
import { playSession } from './play-bot.mjs';
import { TEXTS } from './texts-helper.mjs';
import { LEFT_AT, dayState, find, letGo, makeDay, pocket, putAway, rand, spot, tell, worldWith } from './day-helper.mjs';

const emptySave = () => ({
  plan: defaultPlan(), progress: { streaks: {} }, world: new World(LAYOUT).snapshot(), day: null, dayCount: 0,
  history: { finds: [], puts: [] }, lastDayFinishedOn: null, yesterdayChains: [], oneTap: true,
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

test('a new player is offered to start session 1 or to choose home spots', () => {
  const { app } = newApp();
  assert.deepEqual(app.step(), {
    lead: [],
    command: 'Unforgettable. Always put your things in the same place.',
    choices: [{ id: 'play', label: 'Start session 1' }, { id: 'setup', label: 'Choose my home spots' }, { id: 'settings', label: 'Settings' }],
    selected: null,
    showNext: false,
  });
});

test('the start screen has no Menu link', () => {
  assert.notEqual(newApp().app.step().canLeave, true);
});

test('with a day in progress the player is offered to continue it', () => {
  const day = Day.start({ layout: LAYOUT, things: THINGS, world: new World(LAYOUT), plan: defaultPlan(), progress: { streaks: {} }, random: rand(), number: 3 });
  const { app } = newApp({ saved: { day: day.snapshot(), dayCount: 2 } });
  assert.deepEqual(labels(app), ['Continue session 3', 'Choose my home spots', 'Settings', 'Start again']);
});

test('after a finished day the player is offered the next day', () => {
  const { app } = newApp({ saved: { dayCount: 2 } });
  assert.deepEqual(labels(app), ['Start session 3', 'Choose my home spots', 'Settings', 'Start again']);
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

test('starting session 1 shows a pause that says it is a new game, with no choices', () => {
  const { app } = newApp();
  pick(app, 'play');
  assert.deepEqual(app.step(), {
    lead: ['A new game. Everything is in its home spot.'], command: 'Session 1.', choices: [], selected: null, canLeave: true, showNext: true,
  });
});

test('starting a later session shows a pause that says the game goes on and things are where you left them', () => {
  const { app } = newApp({ saved: { dayCount: 2 } });
  pick(app, 'play');
  assert.deepEqual(app.step(), {
    lead: ['Everything is where you left it.'], command: 'Session 3.', choices: [], selected: null, canLeave: true, showNext: true,
  });
});

test('after the pause of the first day you stand at your front door and need your keys, which are in your coat', () => {
  const { app } = newApp();
  pick(app, 'play');
  app.next();
  assert.deepEqual(app.step().lead, ['You come home and stand at your front door.', 'You need your keys to get in.']);
  assert.equal(app.step().command, 'You need your 🔑 keys. Where do you look? You are in the front garden.');
  assert.deepEqual(labels(app), ['Look here, in the front garden', 'Look in a pocket', 'Walk to another room']);
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
  assert.deepEqual(labels(app), ['Continue session 1', 'Choose my home spots', 'Settings', 'Start again']);
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
  for (const thing of THINGS) { pick(app, `thing:${thing.id}`); pick(app, 'area:kitchen'); pick(app, 'place:sink'); }
  pick(app, 'done');
};
const SINK = { placeId: 'kitchen', spotId: 'sink' };

test('choosing home spots leads through the list and the questions and then back to the start screen, with the plan saved', () => {
  const { app, saves } = newApp();
  chooseSinkForEverything(app);
  assert.deepEqual(ids(app), ['play', 'setup', 'settings']);
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
  pick(app, 'doors');
  pick(app, 'door:kitchen');
  pick(app, 'spots');
  pick(app, 'spot:sink');
  assert.equal(app.saveState().progress.streaks.keys, 1);
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
    command: 'Session 3 is done.',
    choices: [{ id: 'next', label: 'Start session 4' }, { id: 'start', label: 'Back to the start' }],
    selected: null,
    showNext: false,
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
  assert.deepEqual(labels(app), ['Start session 4', 'Choose my home spots', 'Settings', 'Start again']);
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
  assert.deepEqual(chainIdsOf(fresh.saves.at(-1).day.events), ['come-home', 'coffee', 'present', 'evening']);
  const next = newApp({ saved: { yesterdayChains: ['coffee', 'present'] } });
  pick(next.app, 'play');
  assert.deepEqual(chainIdsOf(next.saves.at(-1).day.events), ['come-home', 'pizza', 'call', 'evening']);
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
  assert.deepEqual(Object.keys(saves[0]).sort(), ['day', 'dayCount', 'history', 'lastDayFinishedOn', 'oneTap', 'plan', 'progress', 'world', 'yesterdayChains']);
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
  // a find followed by a story step in the same room, so that nothing lays the keys down yet
  const events = [find('keys', LEFT_AT.keys, 'come-home', 'keys'), tell('hall', 'come-home', 'shoes')];
  const world = worldWith(defaultPlan());
  const day = makeDay(events, { world, plan: defaultPlan(), state: { number: 1 } });
  EVENT_KINDS.find.enter(day, day.event());
  const { app, saves } = newApp({ saved: { day: day.snapshot(), world: world.snapshot() } });
  pick(app, 'play');
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
  assert.deepEqual(labels(again.app), ['Continue session 1', 'Choose my home spots', 'Settings', 'Start again']);
  pick(again.app, 'play');
  const { canLookBack, ...theScreen } = first.app.step();
  assert.equal(canLookBack, true);
  assert.deepEqual(again.app.step(), theScreen);
});

test('the screens that were left are not saved: after a reload there is nothing to look back at', () => {
  const first = newApp();
  pick(first.app, 'play');
  first.app.next();
  pick(first.app, 'doors');
  const again = newApp({ saved: first.saves.at(-1) });
  pick(again.app, 'play');
  assert.notEqual(again.app.step().canLookBack, true);
});

test('a saved day that cannot be continued is dropped, the world is kept and a new day starts', () => {
  const full = Day.start({ layout: LAYOUT, things: THINGS, world: new World(LAYOUT), plan: defaultPlan(), progress: { streaks: {} }, random: rand(), number: 3 });
  const world = worldWith({ keys: spot('living', 'sofa') }).snapshot();
  const withoutScissors = THINGS.filter((thing) => thing.id !== 'scissors');
  const { app, saves } = newApp({ things: withoutScissors, saved: { day: full.snapshot(), dayCount: 2, world } });
  assert.deepEqual(labels(app), ['Start session 3', 'Choose my home spots', 'Settings', 'Start again']);
  pick(app, 'play');
  assert.deepEqual(saves.at(-1).world.things.keys, spot('living', 'sofa'));
  assert.equal(saves.at(-1).day.number, 3);
  assert.equal(saves.at(-1).day.events.some((event) => event.thingId === 'scissors'), false);
});

test('a saved day with a broken field is dropped too', () => {
  const day = Day.start({ layout: LAYOUT, things: THINGS, world: new World(LAYOUT), plan: defaultPlan(), progress: { streaks: {} }, random: rand(), number: 1 });
  const broken = { ...day.snapshot(), events: [{ kind: 'dance' }] };
  const { app } = newApp({ saved: { day: broken } });
  assert.deepEqual(labels(app), ['Start session 1', 'Choose my home spots', 'Settings', 'Start again']);
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
  pick(app, 'thing:keys');
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
  assert.equal(app.step().command, 'Session 1 is done.');
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
  for (let guard = 0; app.step().command !== `Session ${number} is done.`; guard += 1) {
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

// ---- looking back ----

/** A session just started and the pause left, so one screen lies behind the player. */
function afterThePause() {
  const made = newApp();
  pick(made.app, 'play');
  made.app.next();
  return made;
}

test('a screen of a session that was just opened has nothing to look back at', () => {
  const { app } = newApp();
  pick(app, 'play');
  assert.notEqual(app.step().canLookBack, true);
});

test('once the player has left a screen of the session, the screens of the session offer to look back', () => {
  const { app } = afterThePause();
  assert.equal(app.step().canLookBack, true);
});

test('the start screen and the home-spot screens never offer to look back', () => {
  const { app } = afterThePause();
  app.leave();
  assert.notEqual(app.step().canLookBack, true);
  pick(app, 'setup');
  assert.notEqual(app.step().canLookBack, true);
});

test('looking back shows the screen the player just left and what they chose on it', () => {
  const { app } = afterThePause();
  pick(app, 'doors');
  app.lookBack();
  assert.match(app.step().command, /Where do you look\? You are in the front garden\. You chose: Walk to another room\.$/);
  assert.equal(app.step().lead[0], TEXTS.lookBackNote);
});

test('a screen on which the player pressed Next without having chosen is not recorded', () => {
  const { app } = afterThePause();
  app.next(); // a find screen with nothing selected: nothing happens
  app.lookBack();
  assert.match(app.step().command, /^Session 1\.$/);
});

test('the screens can be walked back through one by one, down to the first of the session', () => {
  const { app } = afterThePause();
  pick(app, 'doors');
  app.lookBack();
  app.next();
  assert.equal(app.step().command, 'Session 1.');
  assert.deepEqual(ids(app), ['later', 'return']);
});

test('going back to the game shows exactly the screen that was left, and the game goes on from there', () => {
  const { app } = afterThePause();
  pick(app, 'doors');
  const before = app.step();
  app.lookBack();
  pick(app, 'return');
  assert.deepEqual(app.step(), before);
  pick(app, 'door:kitchen');
  assert.match(app.step().command, /kitchen/);
});

test('looking back changes nothing and saves nothing', () => {
  const { app, saves } = afterThePause();
  pick(app, 'doors');
  const savedBefore = saves.length;
  const stateBefore = JSON.stringify(app.saveState());
  app.lookBack();
  app.next();
  pick(app, 'return');
  assert.equal(saves.length, savedBefore);
  assert.equal(JSON.stringify(app.saveState()), stateBefore);
});

test('the screens of the session are still there after a visit to the Menu', () => {
  const { app } = afterThePause();
  app.leave();
  pick(app, 'play');
  assert.equal(app.step().canLookBack, true);
});

test('a new session starts with nothing to look back at', () => {
  const { app } = newApp();
  pick(app, 'play');
  playDay(app, 1);
  pick(app, 'next');
  assert.equal(app.step().command, 'Session 2.');
  assert.notEqual(app.step().canLookBack, true);
});

test('looking back where it is not offered is a mistake, not a screen', () => {
  const { app } = newApp();
  assert.throws(() => app.lookBack());
});

// ---- changing only some home spots ----

test('only the home spot that was changed changes, and the player can leave the list at once', () => {
  const { app, saves } = newApp();
  pick(app, 'setup');
  pick(app, 'thing:scissors'); pick(app, 'area:kitchen'); pick(app, 'place:sink');
  pick(app, 'done');
  assert.deepEqual(saves.at(-1).plan, { ...defaultPlan(), scissors: SINK });
  assert.deepEqual(ids(app), ['play', 'setup', 'settings']);
});

test('leaving the list without changing anything saves nothing and changes nothing', () => {
  const { app, saves } = newApp();
  pick(app, 'setup');
  pick(app, 'done');
  assert.equal(saves.length, 0);
  assert.deepEqual(ids(app), ['play', 'setup', 'settings']);
});

// ---- starting again ----

const FIND = { day: 1, thingId: 'keys', steps: 2, shortest: 2, wasHome: true };
const PLAYED = () => ({
  dayCount: 2,
  progress: { streaks: { keys: 3 } },
  history: { finds: [FIND], puts: [] },
  lastDayFinishedOn: '2026-11-15',
  yesterdayChains: ['coffee'],
  world: worldWith({ keys: spot('living', 'sofa'), wallet: pocket('coat', 'coat-inside'), phone: spot('kitchen', 'counter'), scissors: spot('kitchen', 'drawer') }).snapshot(),
  plan: { ...defaultPlan(), phone: SINK },
});
const ASK = { id: 'reset', label: 'Start again' };

test('a new game has nothing to erase, so the start screen offers no way to start again', () => {
  assert.equal(ids(newApp().app).includes('reset'), false);
});

test('once a session has been started the start screen offers to start again, after the other choices', () => {
  const { app } = newApp();
  pick(app, 'play');
  app.leave();
  assert.deepEqual(app.step().choices.at(-1), ASK);
  assert.deepEqual(ids(app), ['play', 'setup', 'settings', 'reset']);
});

test('a game that has been played offers to start again too', () => {
  assert.deepEqual(newApp({ saved: PLAYED() }).app.step().choices.at(-1), ASK);
});

test('starting again asks first, and says what is erased and what stays', () => {
  const { app } = newApp({ saved: PLAYED() });
  pick(app, 'reset');
  assert.deepEqual(app.step(), {
    lead: [],
    command: 'Start again? This erases your sessions and your progress. Your home spots stay.',
    choices: [{ id: 'yes', label: 'Yes, erase my progress' }, { id: 'no', label: 'No, keep everything' }],
    selected: null,
    showNext: false,
  });
});

test('saying no changes nothing, saves nothing and returns to the start screen', () => {
  const { app, saves } = newApp({ saved: PLAYED() });
  const before = JSON.stringify(app.saveState());
  pick(app, 'reset');
  pick(app, 'no');
  assert.equal(JSON.stringify(app.saveState()), before);
  assert.equal(saves.length, 0);
  assert.deepEqual(ids(app), ['play', 'setup', 'settings', 'reset']);
});

test('saying yes erases the sessions, the streaks, the history, the dates and the day in progress, and keeps the home spots', () => {
  const { app } = newApp({ saved: PLAYED() });
  pick(app, 'reset');
  pick(app, 'yes');
  const state = app.saveState();
  assert.equal(state.dayCount, 0);
  assert.equal(state.day, null);
  assert.deepEqual(state.progress, { streaks: {} });
  assert.deepEqual(state.history, { finds: [], puts: [] });
  assert.equal(state.lastDayFinishedOn, null);
  assert.deepEqual(state.yesterdayChains, []);
  assert.deepEqual(state.plan, { ...defaultPlan(), phone: SINK });
});

test('after erasing, every thing is on its home spot again, also where a home spot was changed', () => {
  const { app } = newApp({ saved: PLAYED() });
  pick(app, 'reset');
  pick(app, 'yes');
  assert.deepEqual(app.saveState().world.things, { ...defaultPlan(), phone: SINK });
});

test('a session in progress is erased too', () => {
  const { app } = newApp();
  pick(app, 'play');
  app.next();
  app.leave();
  pick(app, 'reset');
  pick(app, 'yes');
  assert.equal(app.saveState().day, null);
});

test('starting again is saved at once, so a reload cannot bring the old game back', () => {
  const { app, saves } = newApp({ saved: PLAYED() });
  pick(app, 'reset');
  pick(app, 'yes');
  assert.equal(saves.length, 1);
  assert.equal(saves[0].dayCount, 0);
  assert.deepEqual(saves[0].history, { finds: [], puts: [] });
});

test('after starting again the start screen offers session 1 and the pause says it is a new game', () => {
  const { app } = newApp({ saved: PLAYED() });
  pick(app, 'reset');
  pick(app, 'yes');
  assert.deepEqual(labels(app), ['Start session 1', 'Choose my home spots', 'Settings']);
  pick(app, 'play');
  assert.deepEqual(app.step().lead, ['A new game. Everything is in its home spot.']);
});

test('the screens of the session before are gone after starting again', () => {
  const { app } = afterThePause();
  app.leave();
  pick(app, 'reset');
  pick(app, 'yes');
  pick(app, 'play');
  assert.notEqual(app.step().canLookBack, true);
});

test('a whole session can be played after starting again', () => {
  const { app } = newApp({ saved: PLAYED() });
  pick(app, 'reset');
  pick(app, 'yes');
  pick(app, 'play');
  playDay(app, 1);
  assert.deepEqual(ids(app), ['next', 'start']);
});

// ---- one tap or two: the setting ----

const tap = (app, id) => app.tap(id);
const twoTaps = (overrides = {}) => newApp({ ...overrides, saved: { oneTap: false, ...overrides.saved } });
const markedIds = (app) => app.step().choices.filter((entry) => entry.mark).map((entry) => entry.id);

test('with one tap a tap on a choice does what Next does, and says the screen moved on', () => {
  const { app } = newApp();
  assert.equal(tap(app, 'play'), true);
  assert.equal(app.step().command, 'Session 1.');
});

test('with two taps a tap on a choice only selects it, and says the screen did not move', () => {
  const { app } = twoTaps();
  assert.equal(tap(app, 'play'), false);
  assert.equal(app.step().selected, 'play');
  assert.equal(app.step().command, 'Unforgettable. Always put your things in the same place.');
  app.next();
  assert.equal(app.step().command, 'Session 1.');
});

test('a tap on a choice that is not on the screen is refused, with either setting', () => {
  assert.throws(() => newApp().app.tap('nope'), /not offered/i);
  assert.throws(() => twoTaps().app.tap('nope'), /not offered/i);
});

test('with one tap a screen with choices has no Next, and a screen without choices keeps it', () => {
  const { app } = newApp();
  assert.equal(app.step().showNext, false);
  pick(app, 'play');
  assert.deepEqual(ids(app), []);
  assert.equal(app.step().showNext, true);
});

test('with two taps every screen has its Next', () => {
  const { app } = twoTaps();
  assert.equal(app.step().showNext, true);
  pick(app, 'play');
  assert.equal(app.step().showNext, true);
  app.next();
  assert.equal(app.step().showNext, true);
});

test('with one tap the screens of a day, of the home spots, of looking back and of the questions have no Next', () => {
  const { app } = afterThePause();
  assert.equal(app.step().showNext, false);
  app.lookBack();
  assert.equal(app.step().showNext, false);
  pick(app, 'return');
  app.leave();
  pick(app, 'setup');
  assert.equal(app.step().showNext, false);
  pick(app, 'done');
  pick(app, 'reset');
  assert.equal(app.step().showNext, false);
});

test('one tap works through the whole day: every tap on a choice acts', () => {
  const { app } = newApp();
  tap(app, 'play');
  app.next();
  assert.equal(tap(app, 'doors'), true);
  assert.equal(tap(app, 'door:kitchen'), true);
  assert.match(app.step().command, /kitchen/);
});

test('with one tap a tap on Earlier screen looks back at once', () => {
  const { app } = afterThePause();
  tap(app, 'doors');
  app.lookBack();
  assert.equal(tap(app, 'earlier'), true);
  assert.equal(app.step().command, 'Session 1.');
});

test('the start screen offers Settings after the home spots and before Start again', () => {
  const { app } = newApp({ saved: PLAYED() });
  assert.deepEqual(ids(app), ['play', 'setup', 'settings', 'reset']);
});

test('the settings screen asks how to choose, marks the setting that is on, and has a way back', () => {
  const { app } = newApp();
  pick(app, 'settings');
  assert.deepEqual(app.step(), {
    lead: [],
    command: 'How do you want to choose?',
    choices: [
      { id: 'onetap:on', label: 'One tap: a choice happens at once', mark: '★' },
      { id: 'onetap:off', label: 'Two taps: choose, then Next' },
      { id: 'back', label: '↩ Choose something else' },
    ],
    selected: null,
    showNext: false,
  });
});

test('with two taps on, the mark is on the two taps', () => {
  const { app } = twoTaps();
  pick(app, 'settings');
  assert.deepEqual(markedIds(app), ['onetap:off']);
});

test('choosing two taps is saved at once and returns to the start screen, where Next is back', () => {
  const { app, saves } = newApp();
  pick(app, 'settings');
  tap(app, 'onetap:off');
  assert.equal(saves.at(-1).oneTap, false);
  assert.equal(app.saveState().oneTap, false);
  assert.equal(app.step().command, 'Unforgettable. Always put your things in the same place.');
  assert.equal(app.step().showNext, true);
  assert.equal(tap(app, 'play'), false);
});

test('choosing one tap again is saved too, and taps act at once again', () => {
  const { app, saves } = twoTaps();
  pick(app, 'settings');
  pick(app, 'onetap:on');
  assert.equal(saves.at(-1).oneTap, true);
  assert.equal(app.step().showNext, false);
  assert.equal(tap(app, 'play'), true);
});

test('choosing the setting that is on changes nothing and saves nothing', () => {
  const { app, saves } = newApp();
  pick(app, 'settings');
  pick(app, 'onetap:on');
  assert.equal(saves.length, 0);
  assert.deepEqual(ids(app), ['play', 'setup', 'settings']);
});

test('going back from the settings saves nothing', () => {
  const { app, saves } = newApp();
  pick(app, 'settings');
  pick(app, 'back');
  assert.equal(saves.length, 0);
  assert.deepEqual(ids(app), ['play', 'setup', 'settings']);
});

test('the setting is part of the saved state and survives a reload', () => {
  const first = newApp();
  pick(first.app, 'settings');
  pick(first.app, 'onetap:off');
  const again = newApp({ saved: first.saves.at(-1) });
  assert.equal(again.app.step().showNext, true);
  assert.equal(again.app.saveState().oneTap, false);
});

test('starting again keeps the setting: it is not part of the game', () => {
  const { app } = twoTaps({ saved: PLAYED() });
  pick(app, 'reset');
  pick(app, 'yes');
  assert.equal(app.saveState().oneTap, false);
});

// ---- praise on the screen log ----

test('looking back shows the praise of a screen as its first line after the note', () => {
  const day = dayState([putAway('keys'), putAway('wallet')], { number: 1, inHand: ['keys', 'wallet'] });
  const { app } = newApp({ saved: { day, dayCount: 0, world: worldWith({}).snapshot() } });
  pick(app, 'play');
  pick(app, 'pockets');
  pick(app, 'pocket:coat/coat-right'); // the home spot of the keys
  assert.equal(app.step().praise, '✨ Well done! You put your 🔑 keys on the home spot.');
  pick(app, 'doors');
  app.lookBack();
  assert.deepEqual(app.step().lead.slice(0, 2), [TEXTS.lookBackNote, '✨ Well done! You put your 🔑 keys on the home spot.']);
});

test('a saved state without the one-tap field behaves as one tap', () => {
  const { oneTap, ...withoutField } = emptySave();
  const { app } = newApp({ saved: withoutField });
  assert.equal(app.step().showNext, false);
  assert.equal(app.tap('play'), true);
  assert.equal(app.saveState().oneTap, true);
});

// ---- a natural flow from story to story (real chains, fixed random, a player who knows the house) ----

const session = (saved = {}) => playSession(newApp({ saved }).app);
const commandsOf = (screens) => screens.map((screen) => screen.command);
const textOf = (screens) => screens.flatMap((screen) => [...screen.lead, screen.command]);
// the day of the story: come-home, pizza, call (coffee and present were yesterday)
const PIZZA_DAY = { yesterdayChains: ['coffee', 'present'] };

test('a story after another one starts where the player is: nothing says "You are in the living room."', () => {
  assert.equal(textOf(session(PIZZA_DAY)).includes('You are in the living room.'), false);
});

test('the pizza story opens with the doorbell, straight after the last screen of the story before it and with no lead of its own', () => {
  const screens = session(PIZZA_DAY);
  const bell = screens.findIndex((screen) => screen.command === 'The doorbell rings: your pizza is here.');
  assert.ok(bell > 0, 'the doorbell rings');
  assert.equal(screens[bell - 1].command, 'You take off your shoes.');
  assert.deepEqual(screens[bell].lead, []);
});

test('in the present story, the call is told in the kitchen where the phone was fetched, with no walk back first', () => {
  const screens = session();
  const call = screens.findIndex((screen) => screen.command === 'The party starts at eight.');
  assert.ok(call > 0, 'the call is told');
  assert.equal(screens[call].room, 'kitchen');
  assert.equal(screens[call - 1].command.startsWith('Go back'), false);
});

test('a session ends with the evening and the check, and asks "Is everything back in its place?" only once', () => {
  const screens = session();
  const commands = commandsOf(screens);
  assert.deepEqual(commands.slice(-2), ['It is evening.', 'Is everything back in its place?']);
  assert.equal(commands.filter((command) => command === 'Is everything back in its place?').length, 1);
});

test('a well-played session of come-home, coffee and present asks the player back at most twice', () => {
  const commands = commandsOf(session());
  assert.equal(commands.filter((command) => command.startsWith('Go back')).length <= 2, true);
});

// ---- no clues ----

test('a whole session through the real chains never tells the player to put a thing back, on the first day or later', () => {
  const { app } = newApp();
  for (const screen of [...playSession(app), ...playSession(app)]) {
    const said = [...screen.lead, screen.command].join(' ');
    assert.doesNotMatch(said, /Put your .* back/, said);
  }
});
