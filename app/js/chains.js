// The chains of events and the table of step kinds. A chain is data (chains/<id>.js); what each kind of step
// does lives in one row of STEP_KINDS, so a new kind is a new row and a new chain is a new file and a row in
// CHAINS. Pure: no DOM, no randomness.
//
// A step's object is a *thing* when it is one of the chosen things, and a *prop* otherwise: a prop's take and
// put-back are only told. `leftAt` is where a thing stays when nobody puts it back.

import { comeHome } from './chains/come-home.js';
import { goOut } from './chains/go-out.js';
import { coffee } from './chains/coffee.js';
import { present } from './chains/present.js';
import { pizza } from './chains/pizza.js';
import { call } from './chains/call.js';

export const CHAINS = Object.freeze([comeHome, goOut, coffee, present, pizza, call]);

const eventOf = (kind, step, { chainId }, extra) => ({ kind, chain: chainId, step: step.id, ...extra });
const told = (step, context) => eventOf('tell', step, context, { roomId: context.roomId });
const hasRoom = (step, { rooms }) => rooms.has(step.roomId);
const isObject = (step) => typeof step.object === 'string' && step.object.length > 0;
const inCatalogue = (step, { catalogueIds }) => catalogueIds.has(step.object);

/**
 * What each kind of step must hold (`isValid`), whether it needs a sentence of its own (`needsSentence`), and
 * the events it becomes (`expand`). `leavesRoom` marks the kinds that put the story in another room.
 */
export const STEP_KINDS = Object.freeze({
  tell: {
    isValid: () => true,
    needsSentence: () => true,
    expand: (step, context) => [told(step, context)],
  },
  move: {
    leavesRoom: true,
    isValid: hasRoom,
    needsSentence: () => true,
    expand: (step, context) => [eventOf('moveTo', step, context, { roomId: step.roomId })],
  },
  goTo: {
    leavesRoom: true,
    isValid: hasRoom,
    needsSentence: () => true,
    expand: (step, context) => [eventOf('goTo', step, context, { roomId: step.roomId })],
  },
  take: {
    isValid: (step, context) => {
      const placed = step.leftAt === undefined ? !inCatalogue(step, context) : context.hasLocation(step.leftAt);
      return isObject(step) && placed;
    },
    needsSentence: () => true,
    expand: (step, context) => (context.chosen.has(step.object)
      ? [eventOf('find', step, context, { thingId: step.object, leftAt: step.leftAt })]
      : [told(step, context)]),
  },
  putBack: {
    isValid: isObject,
    // the put-back of a thing of the catalogue needs no sentence: the put-away command is enough
    needsSentence: (step, context) => !inCatalogue(step, context),
    expand: (step, context) => (context.chosen.has(step.object)
      ? [eventOf('putAway', step, context, { thingId: step.object })]
      : [told(step, context)]),
  },
  check: {
    isValid: () => true,
    needsSentence: () => true,
    expand: (step, context) => [eventOf('check', step, context, { roomId: context.roomId })],
  },
});

/** Whether a chain has a step with this id (a saved event is checked against this). */
export const hasStep = (chainId, stepId, chains = CHAINS) =>
  chains.some((chain) => chain.id === chainId && chain.steps.some((step) => step.id === stepId));
