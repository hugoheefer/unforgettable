import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSaveStore } from '../app/js/save-store.js';

const defaults = {
  plan: { keys: { placeId: 'hall', spotId: 'hook' }, wallet: { placeId: 'coat', spotId: 'pocket' } },
  progress: { streaks: {} },
};
const locationExists = ({ placeId, spotId }) => ['hall/hook', 'coat/pocket', 'kitchen/counter'].includes(`${placeId}/${spotId}`);

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), data };
}
const storeOn = (storage) => createSaveStore(() => storage, { defaults, locationExists });

test('with nothing saved the defaults are used', () => {
  assert.deepEqual(storeOn(memoryStorage()).load(), defaults);
});

test('what was saved is there at the next start', () => {
  const storage = memoryStorage();
  const saved = { plan: { ...defaults.plan, keys: { placeId: 'kitchen', spotId: 'counter' } }, progress: { streaks: { keys: 3 } } };
  storeOn(storage).save(saved);
  assert.deepEqual(storeOn(storage).load(), saved);
});

test('a damaged save falls back to the defaults', () => {
  assert.deepEqual(storeOn(memoryStorage({ 'unforgettable-save': '{not json' })).load(), defaults);
});

test('an old save is merged with the defaults field by field', () => {
  const storage = memoryStorage({ 'unforgettable-save': JSON.stringify({ progress: { streaks: { keys: 2 } } }) });
  assert.deepEqual(storeOn(storage).load(), { plan: defaults.plan, progress: { streaks: { keys: 2 } } });
});

test('a saved home spot that no longer exists is replaced by the default one', () => {
  const stale = { plan: { keys: { placeId: 'attic', spotId: 'box' } } };
  const storage = memoryStorage({ 'unforgettable-save': JSON.stringify(stale) });
  assert.deepEqual(storeOn(storage).load().plan.keys, defaults.plan.keys);
});

test('streaks that are not whole numbers are dropped', () => {
  const bad = { progress: { streaks: { keys: 'many', wallet: 2.5, phone: -1, ok: 4 } } };
  const storage = memoryStorage({ 'unforgettable-save': JSON.stringify(bad) });
  assert.deepEqual(storeOn(storage).load().progress.streaks, { ok: 4 });
});

test('a browser that blocks storage still plays: load gives defaults and save does not throw', () => {
  const blocked = () => { throw new Error('blocked'); };
  const store = createSaveStore(blocked, { defaults, locationExists });
  assert.deepEqual(store.load(), defaults);
  assert.doesNotThrow(() => store.save(defaults));
});

test('a saved home spot that is not even an object is replaced by the default one', () => {
  const storage = memoryStorage({ 'unforgettable-save': JSON.stringify({ plan: { keys: 'hook', wallet: 7 } }) });
  assert.deepEqual(storeOn(storage).load().plan, defaults.plan);
});
