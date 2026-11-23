// Builds the events of one day as plain data (see "Story 3b" in stories.md). Pure: all randomness comes in through
// `random`, so a day is deterministic in tests, and the list is stored in the save so a reload gives the same day.
//
// A day is a pause, one opener chain, a few other chains and the closing chain. Each step of a chain becomes events through its
// kind in STEP_KINDS. The events are plain data: { kind, chain, step, ... } (the shapes are in chains.js and
// day.js). `chain` and `step` are keys into the texts of the language, never sentences. A choose step puts the events of
// all its options after the question (tagged `option`); the Day removes the options not taken when the player chooses.

import { CHAINS, STEP_KINDS, expandGroups } from './chains.js';

const FIRST_DAY = 1;

// The parts of a day in the order they are played. A chain without a time (not allowed in the game: the chain
// contract checks it) ranks before all of them.
const TIMES_OF_DAY = ['morning', 'day', 'evening'];
const timeRank = (chain) => TIMES_OF_DAY.indexOf(chain.time);

/**
 * The numbers that decide how hard a day is, in one place: a level is later one row of such settings.
 * `otherChains`: chains after the opener. `silentChance`: the chance that a chain with a put-back of a chosen
 * thing is silent about it. `silentPerChain`: how many put-backs a silent chain leaves out. `guideFirstOpener`:
 * whether the opener of the very first session always tells the player to put things back.
 * By default the app never tells the player to put a thing back (user decision 2026-11-17: the game trains the
 * player to think of it, so it gives no clues): silent every time, about every thing, from the first session on.
 * A level that guides the player is a row with a lower chance.
 */
export const DEFAULT_RULES = Object.freeze({ otherChains: 2, silentChance: 1, silentPerChain: Infinity, guideFirstOpener: false });

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

/** The ids of the things found so far, each once, in the order they were first found. */
const usedIn = (events) => [...new Set(events.filter((event) => event.kind === 'find').map((event) => event.thingId))];

/** The steps of a chain as groups of events. `used` and `nightSpots` serve the closer, which needs the used things again. */
const expandSteps = (chain, chosen, { used, nightSpots }) =>
  chain.steps.flatMap((step) => expandGroups(step, { chainId: chain.id, chosen, used, nightSpots }));

/**
 * Lays the groups out as events and adds a `letGo` where things that nobody puts back are laid down: after
 * every walk out of a room, and at the end of the chain. A story move takes the player along with what they
 * hold, so the player always gets a screen with the thing in hand where it was used. A `letGo` is left out when
 * it has nothing to lay down, and never names a thing that the rest of the chain still puts back.
 */
function withLetGos(groups, chainId) {
  const events = [];
  const held = new Set();
  const letGo = (restOfChain) => {
    const putBackLater = new Set(restOfChain.flatMap((group) => group.events).filter((event) => event.kind === 'putAway').map((event) => event.thingId));
    const thingIds = [...held].filter((id) => !putBackLater.has(id));
    thingIds.forEach((id) => held.delete(id));
    if (thingIds.length > 0) events.push({ kind: 'letGo', chain: chainId, thingIds });
  };
  groups.forEach((group, index) => {
    for (const event of group.events) {
      if (event.kind === 'find') held.add(event.thingId);
      if (event.kind === 'putAway') held.delete(event.thingId);
      events.push(event);
    }
    if (STEP_KINDS[group.step.kind].walksAway) letGo(groups.slice(index + 1));
  });
  letGo([]);
  return events;
}

function eventsOfChain(chain, { chosen, silentAllowed, random, rules, used, nightSpots }) {
  let groups = expandSteps(chain, chosen, { used, nightSpots });
  const hasPutBack = groups.some((group) => hasEventOfKind(group.events, 'putAway'));
  // a chance of one needs no luck: the app is then silent every time
  const silent = hasPutBack && silentAllowed && (rules.silentChance >= 1 || random.chance(rules.silentChance));
  if (silent) groups = dropPutBacks(groups, rules.silentPerChain, random);
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
  // openers take turns: yesterday's is only played again when no other can open
  const freshOpeners = openers.filter((chain) => !yesterday.includes(chain.id));
  const choices = freshOpeners.length > 0 ? freshOpeners : openers;
  const opener = starter ?? (choices.length > 0 ? random.pick(choices) : null);
  const closer = chains.find((chain) => chain.closer === true);
  // a session never goes back in time: only chains not earlier than the opener are played, and in time order
  const rest = chains.filter((chain) => chain.opener !== true && chain.closer !== true && (!opener || timeRank(chain) >= timeRank(opener)));
  const fresh = rest.filter((chain) => !yesterday.includes(chain.id));
  const stale = rest.filter((chain) => yesterday.includes(chain.id));
  const others = [...random.shuffle(fresh), ...random.shuffle(stale)].slice(0, rules.otherChains).sort((a, b) => timeRank(a) - timeRank(b));

  const nightSpots = Object.fromEntries(things.map((thing) => [thing.id, thing.nightSpot]));
  const events = [{ kind: 'pause', text: 'day' }];
  // the closer ends every session; it has no put-back, so it can never be silent
  for (const chain of [...(opener ? [opener] : []), ...others, ...(closer ? [closer] : [])]) {
    const firstDayOpener = rules.guideFirstOpener && dayNumber === FIRST_DAY && chain === opener;
    events.push(...eventsOfChain(chain, { chosen, silentAllowed: !firstDayOpener, random, rules, used: usedIn(events), nightSpots }));
  }
  return events;
}

/** The ids of the chains a day played, in order; events that a forgotten thing added belong to no chain. */
export const chainIdsOf = (events) => [...new Set(events.map((event) => event.chain).filter((chain) => typeof chain === 'string'))];
