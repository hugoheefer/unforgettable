// Builds the events of one day as plain data (see "Story 3b" in stories.md). Pure: all randomness comes in through
// `random`, so a day is deterministic in tests, and the list is stored in the save so a reload gives the same day.
//
// A day is a pause, one opener chain and a few other chains. Each step of a chain becomes events through its
// kind in STEP_KINDS. The events are plain data: { kind, chain, step, ... } (the shapes are in chains.js and
// day.js). `chain` and `step` are keys into the texts of the language, never sentences.

import { CHAINS, STEP_KINDS } from './chains.js';

const FIRST_DAY = 1;

/**
 * The numbers that decide how hard a day is, in one place: a level is later one row of such settings.
 * `otherChains`: chains after the opener. `silentChance`: the chance that a chain with a put-back of a chosen
 * thing is silent about it. `silentPerChain`: how many put-backs a silent chain leaves out.
 */
export const DEFAULT_RULES = Object.freeze({ otherChains: 2, silentChance: 1 / 2, silentPerChain: 1 });

const hasEventOfKind = (events, kind) => events.some((event) => event.kind === kind);

/** Whether the opener's need is met: only chosen things count. */
const canOpen = (chain, chosen, onPerson) =>
  chain.opener === true && (chain.needsOnPerson ?? []).filter((id) => chosen.has(id)).every((id) => onPerson.includes(id));

/** Leaves out `count` of the put-back groups, picked at random. */
function dropPutBacks(groups, count, random) {
  let remaining = groups;
  for (let left = count; left > 0; left -= 1) {
    const candidates = remaining.filter((group) => hasEventOfKind(group.events, 'putAway'));
    if (candidates.length === 0) break;
    const dropped = random.pick(candidates);
    remaining = remaining.filter((group) => group !== dropped);
  }
  return remaining;
}

/** The steps of a chain as groups of events; the room where the story stands is followed along the way. */
function expandSteps(chain, chosen) {
  let roomId;
  return chain.steps.map((step) => {
    const events = STEP_KINDS[step.kind].expand(step, { chainId: chain.id, chosen, roomId });
    roomId = events.findLast((event) => event.roomId !== undefined)?.roomId ?? roomId;
    return { step, events };
  });
}

/**
 * Lays the groups out as events and adds a `letGo` where things that nobody puts back are laid down: before
 * every move or walk after a take, and at the end of the chain. A `letGo` is left out when it has nothing to lay
 * down, and never names a thing that the rest of the chain still puts back.
 */
function withLetGos(groups, chainId) {
  const events = [];
  const held = new Set();
  let tookSomething = false;
  const letGo = (restOfChain) => {
    const putBackLater = new Set(restOfChain.flatMap((group) => group.events).filter((event) => event.kind === 'putAway').map((event) => event.thingId));
    const thingIds = [...held].filter((id) => !putBackLater.has(id));
    thingIds.forEach((id) => held.delete(id));
    if (thingIds.length > 0) events.push({ kind: 'letGo', chain: chainId, thingIds });
  };
  groups.forEach((group, index) => {
    if (tookSomething && STEP_KINDS[group.step.kind].leavesRoom) letGo(groups.slice(index));
    for (const event of group.events) {
      if (event.kind === 'find') { held.add(event.thingId); tookSomething = true; }
      if (event.kind === 'putAway') held.delete(event.thingId);
      events.push(event);
    }
  });
  letGo([]);
  return events;
}

function eventsOfChain(chain, { chosen, silentAllowed, random, rules }) {
  let groups = expandSteps(chain, chosen);
  const hasPutBack = groups.some((group) => hasEventOfKind(group.events, 'putAway'));
  if (hasPutBack && silentAllowed && random.chance(rules.silentChance)) groups = dropPutBacks(groups, rules.silentPerChain, random);
  return withLetGos(groups, chain.id);
}

/**
 * @param {{ dayNumber: number, chains?: object[], things: { id: string }[], onPerson?: string[], yesterday?: string[],
 *           random: { pick: Function, shuffle: Function, chance: Function }, rules?: typeof DEFAULT_RULES }} options
 *   `things` are the chosen catalogue entries; `onPerson` the ids of the things in hand or in a worn pocket;
 *   `yesterday` the ids of the chains of the day before
 * @returns {object[]} the events of the day
 */
export function buildDay({ dayNumber, chains = CHAINS, things, onPerson = [], yesterday = [], random, rules = DEFAULT_RULES }) {
  const chosen = new Set(things.map((thing) => thing.id));
  const openers = chains.filter((chain) => canOpen(chain, chosen, onPerson));
  // the very first day begins the way the game is introduced (at the front door), not with a random opener
  const starter = dayNumber === FIRST_DAY ? openers.find((chain) => chain.startsTheGame === true) : undefined;
  const opener = starter ?? (openers.length > 0 ? random.pick(openers) : null);
  const rest = chains.filter((chain) => chain.opener !== true);
  const fresh = rest.filter((chain) => !yesterday.includes(chain.id));
  const stale = rest.filter((chain) => yesterday.includes(chain.id));
  const others = [...random.shuffle(fresh), ...random.shuffle(stale)].slice(0, rules.otherChains);

  const events = [{ kind: 'pause', text: 'day' }];
  for (const chain of opener ? [opener, ...others] : others) {
    const firstDayOpener = dayNumber === FIRST_DAY && chain === opener;
    events.push(...eventsOfChain(chain, { chosen, silentAllowed: !firstDayOpener, random, rules }));
  }
  return events;
}

/** The ids of the chains a day played, in order; events that a forgotten thing added belong to no chain. */
export const chainIdsOf = (events) => [...new Set(events.map((event) => event.chain).filter((chain) => typeof chain === 'string'))];
