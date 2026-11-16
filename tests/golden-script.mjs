// One whole scripted round played through AppFlow, shared by the golden test and the one-off fixture generator
// so the two cannot drift apart. Randomness is deterministic: the first choice, no shuffling.

import { AppFlow } from '../app/js/app-flow.js';
import { Round } from '../app/js/round.js';
import { LAYOUT, ITEMS, DEFAULT_PLAN } from '../app/js/layout.js';
import { TEXTS } from './texts-helper.mjs';

const firstChoice = { pick: (list) => list[0], shuffle: (list) => [...list] };

// Dropping: take the coat off in the hall and hang it, then place the four things.
// Finding: the round puts the player in the hall (first room that is not the kitchen); the coat still hangs there.
const CHOICES = [
  'play',
  'hang:coat', 'spot:coat-hooks',
  'pockets', 'pocket:coat/coat-right', // keys
  'spots', 'spot:shoes', // wallet
  'doors', 'door:kitchen',
  'spots', 'spot:counter', // phone
  'pockets', 'pocket:trousers/trousers-back', // scissors
  null, // Next on the distraction
  'pockets', 'pocket:coat/coat-right', // find keys
  'spots', 'spot:shoes', // find wallet
  'doors', 'door:kitchen', 'spots', 'spot:counter', // find phone
  'pockets', 'pocket:trousers/trousers-back', // find scissors
];

/** @returns {object[]} the step() before the first choice and after every next() */
export function playScriptedRound() {
  const app = new AppFlow({
    layout: LAYOUT,
    items: ITEMS,
    plan: DEFAULT_PLAN,
    progress: { streaks: {} },
    texts: TEXTS,
    createRound: (plan, progress) => new Round({ layout: LAYOUT, items: ITEMS, plan, random: firstChoice, progress, texts: TEXTS }),
    onPlanChange: () => {},
    onProgressChange: () => {},
  });
  const steps = [structuredClone(app.step())];
  for (const choice of CHOICES) {
    if (choice !== null) app.choose(choice);
    app.next();
    steps.push(structuredClone(app.step()));
  }
  return steps;
}
