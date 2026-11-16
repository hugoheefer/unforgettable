// Saves the player's plan and streaks in the browser. The storage is injected (see pong-notice-store.js in
// my-wiki), and every access is guarded: a blocked or damaged storage must never stop the game.

const SAVE_KEY = 'unforgettable-save';

const isWholeStreak = (value) => Number.isInteger(value) && value >= 0;

function validStreaks(streaks) {
  if (typeof streaks !== 'object' || streaks === null) return {};
  return Object.fromEntries(Object.entries(streaks).filter(([, value]) => isWholeStreak(value)));
}

/**
 * @param {() => Storage} getStorage
 * @param {{ defaults: { plan: object, progress: object }, spotExists: (location: object) => boolean }} options
 */
export function createSaveStore(getStorage, { defaults, spotExists }) {
  function readRaw() {
    try {
      return JSON.parse(getStorage().getItem(SAVE_KEY) ?? 'null');
    } catch {
      return null;
    }
  }

  function mergePlan(saved) {
    const plan = { ...defaults.plan };
    for (const itemId of Object.keys(defaults.plan)) {
      if (saved && spotExists(saved[itemId] ?? {})) plan[itemId] = saved[itemId];
    }
    return plan;
  }

  return {
    load() {
      const saved = readRaw();
      return { plan: mergePlan(saved?.plan), progress: { streaks: validStreaks(saved?.progress?.streaks) } };
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
