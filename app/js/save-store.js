// Saves the player's plan, streaks and world in the browser. The storage is injected (see pong-notice-store.js
// in my-wiki), and every access is guarded: a blocked or damaged storage must never stop the game.

import { validHistory } from './history.js';

const SAVE_KEY = 'unforgettable-save';
const VERSION = 2;
const DEFAULT_LANGUAGE = 'en';
const DEFAULT_ONE_TAP = true;

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isWholeNumber = (value) => Number.isInteger(value) && value >= 0;

function validStreaks(streaks) {
  if (!isObject(streaks)) return {};
  return Object.fromEntries(Object.entries(streaks).filter(([, value]) => isWholeNumber(value)));
}

/** A day is kept whole or not at all: half a day cannot be continued. */
const validDay = (day) => (isObject(day) && isWholeNumber(day.number) && isWholeNumber(day.index) && Array.isArray(day.events) ? day : null);

/**
 * @param {() => Storage} getStorage
 * @param {{ defaults: { plan: object, progress: object, things: string[], chainIds: string[] },
 *           world: { hasLocation: (location: object) => boolean, restore: (snapshot: unknown) => { snapshot: () => object } } }} options
 */
export function createSaveStore(getStorage, { defaults, world }) {
  function readRaw() {
    try {
      const saved = JSON.parse(getStorage().getItem(SAVE_KEY) ?? 'null');
      return isObject(saved) ? saved : null;
    } catch {
      return null;
    }
  }

  function mergePlan(saved) {
    const plan = { ...defaults.plan };
    for (const itemId of Object.keys(defaults.plan)) {
      if (isObject(saved?.[itemId]) && world.hasLocation(saved[itemId])) plan[itemId] = saved[itemId];
    }
    return plan;
  }

  const validChainIds = (ids) => (Array.isArray(ids) ? ids.filter((id) => defaults.chainIds.includes(id)) : []);

  const validThings = (things) => (Array.isArray(things) ? things.filter((id) => defaults.things.includes(id)) : [...defaults.things]);

  return {
    load() {
      const saved = readRaw();
      return {
        version: VERSION,
        language: typeof saved?.language === 'string' ? saved.language : DEFAULT_LANGUAGE,
        oneTap: typeof saved?.oneTap === 'boolean' ? saved.oneTap : DEFAULT_ONE_TAP,
        things: validThings(saved?.things),
        plan: mergePlan(saved?.plan),
        progress: { streaks: validStreaks(saved?.progress?.streaks) },
        // restoring and taking the snapshot again keeps one validator for the world
        world: world.restore(saved?.world).snapshot(),
        day: validDay(saved?.day),
        dayCount: isWholeNumber(saved?.dayCount) ? saved.dayCount : 0,
        history: validHistory(saved?.history),
        yesterdayChains: validChainIds(saved?.yesterdayChains),
        lastDayFinishedOn: typeof saved?.lastDayFinishedOn === 'string' && DATE_FORMAT.test(saved.lastDayFinishedOn) ? saved.lastDayFinishedOn : null,
      };
    },
    save(data) {
      try {
        getStorage().setItem(SAVE_KEY, JSON.stringify(data));
      } catch {
        // progress is a convenience, not a requirement
      }
    },
  };
}
