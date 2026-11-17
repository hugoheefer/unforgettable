import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSaveStore } from '../app/js/save-store.js';
import { World } from '../app/js/world.js';

const EMPTY_HISTORY = { finds: [], puts: [] };

const spots = (...ids) => ids.map((id) => ({ id, icon: '·' }));
const layout = {
  places: [
    { id: 'hall', icon: '🚪', exits: ['kitchen'], spots: spots('hook') },
    { id: 'coat', icon: '🧥', exits: [], spots: spots('pocket') },
    { id: 'kitchen', icon: '🍳', exits: ['hall'], spots: spots('counter') },
  ],
  garments: [{ id: 'coat', icon: '🧥', startsWorn: true, pockets: spots('left') }],
};
const emptyWorld = () => new World(layout).snapshot();
const defaults = {
  plan: { keys: { placeId: 'hall', spotId: 'hook' }, wallet: { placeId: 'coat', spotId: 'pocket' } },
  progress: { streaks: {} },
  things: ['keys', 'wallet'],
  chainIds: ['coffee', 'pizza', 'call'],
};
const world = {
  hasLocation: (location) => new World(layout).hasLocation(location),
  restore: (snapshot) => World.restore(layout, snapshot),
};
const freshSave = () => ({ version: 2, language: 'en', oneTap: true, things: defaults.things, plan: defaults.plan, progress: { streaks: {} }, world: emptyWorld(), day: null, dayCount: 0, history: EMPTY_HISTORY, lastDayFinishedOn: null, yesterdayChains: [] });

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), data };
}
const storeOn = (storage) => createSaveStore(() => storage, { defaults, world });
const storageWith = (saved) => memoryStorage({ 'unforgettable-save': JSON.stringify(saved) });
const loadFrom = (saved) => storeOn(storageWith(saved)).load();

test('with nothing saved the defaults are used, as a complete version 2 save', () => {
  assert.deepEqual(storeOn(memoryStorage()).load(), freshSave());
});

test('what was saved is there at the next start', () => {
  const storage = memoryStorage();
  const saved = {
    ...freshSave(),
    plan: { ...defaults.plan, keys: { placeId: 'kitchen', spotId: 'counter' } },
    progress: { streaks: { keys: 3 } },
    world: { ...emptyWorld(), things: { keys: { placeId: 'hall', spotId: 'hook' } } },
    day: { number: 2, index: 1, events: [{ kind: 'pause' }] },
    dayCount: 1,
    history: { finds: [{ day: 1, thingId: 'keys', steps: 3, shortest: 1, wasHome: false }], puts: [{ day: 1, thingId: 'keys', steps: 0, atHome: true, left: false }] },
    lastDayFinishedOn: '2026-11-16',
    yesterdayChains: ['coffee', 'call'],
  };
  storeOn(storage).save(saved);
  assert.deepEqual(storeOn(storage).load(), saved);
});

test('a damaged save falls back to the defaults', () => {
  assert.deepEqual(storeOn(memoryStorage({ 'unforgettable-save': '{not json' })).load(), freshSave());
});

test('an old save without a version keeps its plan and streaks and gets the defaults for the rest', () => {
  const plan = { ...defaults.plan, keys: { placeId: 'kitchen', spotId: 'counter' } };
  assert.deepEqual(loadFrom({ plan, progress: { streaks: { keys: 2 } } }), { ...freshSave(), plan, progress: { streaks: { keys: 2 } } });
});

test('a save with only streaks is merged with the defaults field by field', () => {
  assert.deepEqual(loadFrom({ progress: { streaks: { keys: 2 } } }), { ...freshSave(), progress: { streaks: { keys: 2 } } });
});

test('a saved home spot that no longer exists is replaced by the default one', () => {
  const stale = { plan: { keys: { placeId: 'attic', spotId: 'box' } } };
  assert.deepEqual(loadFrom(stale).plan.keys, defaults.plan.keys);
});

test('streaks that are not whole numbers are dropped', () => {
  const bad = { progress: { streaks: { keys: 'many', wallet: 2.5, phone: -1, ok: 4 } } };
  assert.deepEqual(loadFrom(bad).progress.streaks, { ok: 4 });
});

test('a browser that blocks storage still plays: load gives defaults and save does not throw', () => {
  const blocked = () => { throw new Error('blocked'); };
  const store = createSaveStore(blocked, { defaults, world });
  assert.deepEqual(store.load(), freshSave());
  assert.doesNotThrow(() => store.save(freshSave()));
});

test('a saved home spot that is not even an object is replaced by the default one', () => {
  assert.deepEqual(loadFrom({ plan: { keys: 'hook', wallet: 7 } }).plan, defaults.plan);
});

test('the saved world is kept', () => {
  const saved = { things: { keys: { placeId: 'kitchen', spotId: 'counter' }, wallet: { garmentId: 'coat', pocketId: 'left' } }, garments: { coat: { placeId: 'hall', spotId: 'hook' } } };
  assert.deepEqual(loadFrom({ version: 2, world: saved }).world, saved);
});

test('a thing in the saved world that is in an impossible place is lost, the others stay', () => {
  const saved = { things: { keys: { placeId: 'attic', spotId: 'box' }, wallet: { placeId: 'hall', spotId: 'hook' } }, garments: {} };
  assert.deepEqual(loadFrom({ version: 2, world: saved }).world.things, { wallet: { placeId: 'hall', spotId: 'hook' } });
});

test('a saved world that is not an object gives an empty world and keeps the other fields', () => {
  const loaded = loadFrom({ version: 2, world: 'text', progress: { streaks: { keys: 2 } } });
  assert.deepEqual(loaded.world, emptyWorld());
  assert.deepEqual(loaded.progress.streaks, { keys: 2 });
});

test('a save whose day index is not a whole number loads with no day and its world intact', () => {
  const savedWorld = { things: { keys: { placeId: 'hall', spotId: 'hook' } }, garments: {} };
  const loaded = loadFrom({ version: 2, world: savedWorld, day: { number: 1, index: 'two', events: [] } });
  assert.equal(loaded.day, null);
  assert.deepEqual(loaded.world.things, savedWorld.things);
});

test('a day with a good number, index and events is kept as it is', () => {
  const day = { number: 3, index: 0, events: [{ kind: 'pause' }], roomId: 'hall', inHand: ['keys'], steps: 4 };
  assert.deepEqual(loadFrom({ version: 2, day }).day, day);
});

test('a day is dropped when its number, its index or its events are wrong', () => {
  const good = { number: 1, index: 0, events: [] };
  for (const bad of [{ ...good, number: -1 }, { ...good, number: 1.5 }, { ...good, index: -1 }, { ...good, events: 'none' }, 'today', 7, [], null])
    assert.equal(loadFrom({ version: 2, day: bad }).day, null, JSON.stringify(bad));
});

test('the language is kept when it is a string, and is English otherwise', () => {
  assert.equal(loadFrom({ version: 2, language: 'nl' }).language, 'nl');
  for (const bad of [7, null, ['nl'], {}]) assert.equal(loadFrom({ version: 2, language: bad }).language, 'en', JSON.stringify(bad));
});

test('the chosen things are kept, unknown ids are dropped, and a non-array gives the default', () => {
  assert.deepEqual(loadFrom({ version: 2, things: ['wallet', 'dragon', 'keys'] }).things, ['wallet', 'keys']);
  for (const bad of ['keys', 7, null, { keys: true }]) assert.deepEqual(loadFrom({ version: 2, things: bad }).things, defaults.things, JSON.stringify(bad));
});

test('the number of finished days is kept when it is a whole number >= 0, and 0 otherwise', () => {
  assert.equal(loadFrom({ version: 2, dayCount: 5 }).dayCount, 5);
  for (const bad of [-1, 1.5, '3', null]) assert.equal(loadFrom({ version: 2, dayCount: bad }).dayCount, 0, JSON.stringify(bad));
});

test('a save always says it is version 2, whatever it said before', () => {
  assert.equal(loadFrom({ version: 1 }).version, 2);
  assert.equal(loadFrom({}).version, 2);
});

test('a save that is not an object at all gives the defaults', () => {
  for (const nonsense of ['text', 7, [], null]) assert.deepEqual(loadFrom(nonsense), freshSave(), JSON.stringify(nonsense));
});

test('a save without a history gets an empty one, field by field with the rest', () => {
  assert.deepEqual(loadFrom({ version: 2, dayCount: 3 }).history, EMPTY_HISTORY);
});

test('records of the saved history that are not objects or miss a number are dropped on load, the good ones stay', () => {
  const good = { day: 2, thingId: 'keys', steps: 4, shortest: 1, wasHome: true };
  const history = { finds: [good, 'keys', { day: 2, thingId: 'keys', shortest: 1, wasHome: true }], puts: [null, { day: 2, thingId: 'keys', steps: 'x', atHome: true, left: false }] };
  assert.deepEqual(loadFrom({ version: 2, history }).history, { finds: [good], puts: [] });
});

test('a saved history that is not an object gives an empty history', () => {
  for (const bad of ['many', 7, [], null]) assert.deepEqual(loadFrom({ version: 2, history: bad }).history, EMPTY_HISTORY, JSON.stringify(bad));
});

test('the date on which the last day was finished is kept when it is year-month-day, and is null otherwise', () => {
  assert.equal(loadFrom({ version: 2, lastDayFinishedOn: '2026-11-16' }).lastDayFinishedOn, '2026-11-16');
  for (const bad of ['16-11-2026', '2026-1-5', 20261116, 'yesterday', null, ['2026-11-16']]) assert.equal(loadFrom({ version: 2, lastDayFinishedOn: bad }).lastDayFinishedOn, null, JSON.stringify(bad));
});

test('the ids of yesterday\'s chains are kept in the order they were played', () => {
  assert.deepEqual(loadFrom({ version: 2, yesterdayChains: ['pizza', 'coffee', 'call'] }).yesterdayChains, ['pizza', 'coffee', 'call']);
});

test('a chain id that no chain has any more is dropped from yesterday\'s chains, the others stay', () => {
  assert.deepEqual(loadFrom({ version: 2, yesterdayChains: ['coffee', 'dragons', 7, null, 'call'] }).yesterdayChains, ['coffee', 'call']);
});

test('yesterday\'s chains that are not a list give an empty list', () => {
  for (const bad of ['coffee', 7, null, { coffee: true }]) assert.deepEqual(loadFrom({ version: 2, yesterdayChains: bad }).yesterdayChains, [], JSON.stringify(bad));
});

test('a save without yesterday\'s chains gets an empty list, field by field with the rest', () => {
  assert.deepEqual(loadFrom({ version: 2, dayCount: 3 }).yesterdayChains, []);
});

test('one tap is on when nothing is saved about it', () => {
  assert.equal(loadFrom({}).oneTap, true);
});

test('the choice for two taps is restored', () => {
  assert.equal(loadFrom({ oneTap: false }).oneTap, false);
});

test('a saved one-tap setting that is not true or false gives the default', () => {
  for (const damaged of ['no', 0, null, [], {}]) assert.equal(loadFrom({ oneTap: damaged }).oneTap, true, JSON.stringify(damaged));
});
