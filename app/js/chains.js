// The chains of events and the table of step kinds. A chain is data (chains/<id>.js); what each kind of step
// does lives in one row of STEP_KINDS, so a new kind is a new row and a new chain is a new file and a row in
// CHAINS. Pure: no DOM, no randomness.
//
// A step's object is a *thing* when it is one of the chosen things, and a *prop* otherwise: a prop's take and
// put-back are only told. `leftAt` is where a thing stays when nobody puts it back. A `choose` step holds options of
// ordinary steps (story 3f); `expandGroups` gives every step as groups of events, a choose as its question and then each
// option step apart, so the day plan can work on one step at a time.

import { comeHome } from './chains/come-home.js';
import { goOut } from './chains/go-out.js';
import { morning } from './chains/morning.js';
import { coffee } from './chains/coffee.js';
import { present } from './chains/present.js';
import { pizza } from './chains/pizza.js';
import { call } from './chains/call.js';
import { evening } from './chains/evening.js';

export const CHAINS = Object.freeze([comeHome, goOut, morning, coffee, present, pizza, call, evening]);

const eventOf = (kind, step, { chainId }, extra) => ({ kind, chain: chainId, step: step.id, ...extra });
// a step is tied to a room only when `at` says so; otherwise it happens wherever the player is
const told = (step, context) => eventOf('tell', step, context, { roomId: step.at ?? null });
const hasRoom = (step, { rooms }) => rooms.has(step.roomId);
const atExists = (step, { rooms }) => step.at === undefined || rooms.has(step.at);
const isObject = (step) => typeof step.object === 'string' && step.object.length > 0;
const inCatalogue = (step, { catalogueIds }) => catalogueIds.has(step.object);

/**
 * What each kind of step must hold (`isValid`), whether it needs a sentence of its own (`needsSentence`), and
 * the events it becomes (`expand`). `walksAway` marks the kinds where the player walks out of a room (a move takes them along with what they hold).
 */
export const STEP_KINDS = Object.freeze({
  tell: {
    isValid: atExists,
    needsSentence: () => true,
    // `uses`: the thing the step needs in hand; a tell that carries it asks for the thing again when it is not there
    expand: (step, context) => [{ ...told(step, context), ...(step.uses === undefined ? {} : { uses: step.uses }) }],
  },
  move: {
    isValid: hasRoom,
    needsSentence: () => true,
    expand: (step, context) => [eventOf('moveTo', step, context, { roomId: step.roomId })],
  },
  goTo: {
    walksAway: true,
    isValid: hasRoom,
    needsSentence: () => true,
    expand: (step, context) => [eventOf('goTo', step, context, { roomId: step.roomId })],
  },
  take: {
    isValid: (step, context) => {
      const placed = step.leftAt === undefined ? !inCatalogue(step, context) : context.hasLocation(step.leftAt);
      return isObject(step) && placed && atExists(step, context);
    },
    needsSentence: () => true,
    expand: (step, context) => (context.chosen.has(step.object)
      ? [eventOf('find', step, context, { thingId: step.object, leftAt: step.leftAt })]
      : [told(step, context)]),
  },
  putBack: {
    isValid: (step, context) => isObject(step) && atExists(step, context),
    // the put-back of a thing of the catalogue needs no sentence: the put-away command is enough
    needsSentence: (step, context) => !inCatalogue(step, context),
    expand: (step, context) => (context.chosen.has(step.object)
      ? [eventOf('putAway', step, context, { thingId: step.object })]
      : [told(step, context)]),
  },
  // The evening needs again every thing the session used: `context.used` holds their ids and `context.nightSpots`
  // where each lies when nobody puts it away. The sentence of each thing is a table in the language file.
  needAgain: {
    isValid: () => true,
    needsSentence: () => false,
    // `ifUsed`: the day asks only when the thing was really found earlier, since the options not taken used nothing
    expand: (step, context) => context.used.map((thingId) => eventOf('find', step, context, { thingId, leftAt: context.nightSpots[thingId], ifUsed: true })),
  },
  // A question with two or three options, each a short list of ordinary steps. The question's sentence is
  // `texts.chains.<chain>.<step>`, the labels are `texts.options.<chain>.<step>.<option>`. The events of every option
  // follow the choose event, tagged `option: '<step>/<option>'`; the day removes the options not taken when the player chooses.
  choose: {
    isValid: (step, context) => atExists(step, context) && Array.isArray(step.options) && step.options.length > 0
      && step.options.every((option) => Array.isArray(option.steps) && option.steps.length > 0
        && option.steps.every((sub) => OPTION_KINDS.includes(sub.kind) && STEP_KINDS[sub.kind].isValid(sub, context))),
    needsSentence: () => true,
    expand: (step, context) => STEP_KINDS.choose.groups(step, context).flatMap((group) => group.events),
    groups: (step, context) => [
      { step, events: [eventOf('choose', step, context, { options: step.options.map((option) => option.id), roomId: step.at ?? null })] },
      ...step.options.flatMap((option) => option.steps.map((sub) => ({
        step: sub,
        events: STEP_KINDS[sub.kind].expand(sub, context).map((event) => ({ ...event, option: `${step.id}/${option.id}` })),
      }))),
    ],
  },
  check: {
    isValid: () => true,
    needsSentence: () => true,
    expand: (step, context) => [eventOf('check', step, context, { roomId: null })],
  },
});

// the kinds of step that may stand inside an option: no move, no check, no nested choose
const OPTION_KINDS = ['take', 'tell', 'putBack', 'goTo'];

/** A step's events as groups, one per step: a choose gives its question and then every option step apart. */
export const expandGroups = (step, context) =>
  STEP_KINDS[step.kind].groups?.(step, context) ?? [{ step, events: STEP_KINDS[step.kind].expand(step, context) }];

const stepsInside = (chain) => chain.steps.flatMap((step) => [step, ...(step.options ?? []).flatMap((option) => option.steps)]);

/** Whether a chain has a step with this id, also inside an option (a saved event is checked against this). */
export const hasStep = (chainId, stepId, chains = CHAINS) =>
  chains.some((chain) => chain.id === chainId && stepsInside(chain).some((step) => step.id === stepId));

/** The ids of the options of a choose step of a chain, or null when there is no such question. */
export const optionIdsOf = (chainId, stepId, chains = CHAINS) =>
  chains.find((chain) => chain.id === chainId)?.steps.find((step) => step.id === stepId && step.kind === 'choose')?.options.map((option) => option.id) ?? null;
