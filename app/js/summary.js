// Turns the records of one day into the data of the day's summary screen. Pure. It never says what lies where:
// the player finds that out the next time a thing is needed.

import { findsOfDay, putsOfDay } from './history.js';

/** Searching more than this many times the possible steps is costly. */
const COSTLY_FACTOR = 2;

const sum = (records, field) => records.reduce((total, record) => total + record[field], 0);

/** The advice, first row that fits wins; the order is the order of the story. */
export const ADVICE = Object.freeze([
  { key: 'noSearch', when: (summary) => summary.finds === 0 },
  { key: 'costly', when: (summary) => summary.searched > COSTLY_FACTOR * summary.possible },
  { key: 'straight', when: () => true },
]);

/**
 * @param {{ dayNumber: number, history: { finds: object[], puts: object[] } }} options
 */
export function summarize({ dayNumber, history }) {
  const finds = findsOfDay(history, dayNumber);
  const summary = {
    searched: sum(finds, 'steps'),
    possible: sum(finds, 'shortest'),
    putSteps: sum(putsOfDay(history, dayNumber), 'steps'),
    finds: finds.length, // how many, so the first advice row can ask whether there was any search
  };
  return { ...summary, advice: ADVICE.find((row) => row.when(summary)).key };
}
