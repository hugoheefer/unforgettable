// Turns the records of one day and the world into the data of the day's summary screen. Pure.

import { sameLocation } from './world.js';
import { findsOfDay, putsOfDay } from './history.js';

/** Searching more than this many times the possible steps is costly. */
const COSTLY_FACTOR = 2;

const sum = (records, field) => records.reduce((total, record) => total + record[field], 0);

/** The advice, first row that fits wins; the order is the order of the story. */
export const ADVICE = Object.freeze([
  { key: 'noSearch', when: (summary) => summary.finds === 0 },
  { key: 'costly', when: (summary) => summary.searched > COSTLY_FACTOR * summary.possible },
  { key: 'allHome', when: (summary) => summary.away.length === 0 },
  { key: 'someAway', when: () => true },
]);

/**
 * @param {{ dayNumber: number, history: { finds: object[], puts: object[] }, world: object, plan: object, things: { id: string }[] }} options
 */
export function summarize({ dayNumber, history, world, plan, things }) {
  const finds = findsOfDay(history, dayNumber);
  const puts = putsOfDay(history, dayNumber);
  const lying = things.map((thing) => ({ thingId: thing.id, location: world.whereIs(thing.id) }));
  const summary = {
    home: lying.filter(({ thingId, location }) => sameLocation(location, plan[thingId])).map(({ thingId }) => thingId),
    away: lying.filter(({ thingId, location }) => !sameLocation(location, plan[thingId])),
    searched: sum(finds, 'steps'),
    possible: sum(finds, 'shortest'),
    putSteps: sum(puts, 'steps'),
    finds: finds.length, // how many, so the first advice row can ask whether there was any search
  };
  return { ...summary, advice: ADVICE.find((row) => row.when(summary)).key };
}
