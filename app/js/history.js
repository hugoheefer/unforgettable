// The records of finds and put-aways (a put-away has `left` set when the thing was let go, not put away), kept so the player's own numbers can be shown. Pure: a history is plain
// data, and every change gives a new one. Statistics are computed from the records, never stored.

/** Only the most recent records are kept: enough for the progress the game shows, small enough for the save. */
const KEEP = 300;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isWholeNumber = (value) => Number.isInteger(value) && value >= 0;
const isPositiveNumber = (value) => Number.isInteger(value) && value >= 1;

const isFind = (r) => isWholeNumber(r.day) && typeof r.thingId === 'string' && isWholeNumber(r.steps)
  && isPositiveNumber(r.shortest) && typeof r.wasHome === 'boolean';
const isPut = (r) => isWholeNumber(r.day) && typeof r.thingId === 'string' && isWholeNumber(r.steps)
  && typeof r.atHome === 'boolean' && typeof r.left === 'boolean';

const append = (list, record) => [...list, record].slice(-KEEP);
const loaded = (list, isValid) => (Array.isArray(list) ? list.filter((r) => isObject(r) && isValid(r)).slice(-KEEP) : []);

/** @param {{ finds: object[], puts: object[] }} history */
export const recordFind = (history, record) => ({ ...history, finds: append(history.finds, record) });

/** @param {{ finds: object[], puts: object[] }} history */
export const recordPut = (history, record) => ({ ...history, puts: append(history.puts, record) });

export const findsOfDay = (history, day) => history.finds.filter((record) => record.day === day);

export const putsOfDay = (history, day) => history.puts.filter((record) => record.day === day);

/** A history from a save that may be damaged: whatever is not a well-formed record is dropped. */
export function validHistory(value) {
  return isObject(value) ? { finds: loaded(value.finds, isFind), puts: loaded(value.puts, isPut) } : { finds: [], puts: [] };
}
