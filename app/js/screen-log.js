// The screens the player has left during a session, kept so they can be looked at again. Pure. Entries are
// { lead, command, picked }: what the screen said and the label of the choice made on it (null when it had none).
// Everything is copied in and out, so a screen that was left cannot change afterwards.

const DEFAULT_LIMIT = 60;

/** @param {number} [limit] how many screens are kept: the oldest is pushed out */
export function createScreenLog(limit = DEFAULT_LIMIT) {
  let entries = [];
  return {
    record(screen) {
      entries = [...entries, structuredClone(screen)].slice(-limit);
    },
    entries: () => structuredClone(entries),
    isEmpty: () => entries.length === 0,
    clear() {
      entries = [];
    },
  };
}
