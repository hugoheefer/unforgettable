// Builds the events of one day as plain data (see "The events of a day" in stories.md). Pure: all randomness
// comes in through `random`, so a day is deterministic in tests, and the list is stored in the save so a reload
// gives the same day.
//
// Events: { kind: 'pause', text } | { kind: 'moveTo', roomId, text, thingId?, useId? }
//       | { kind: 'find', thingId, useId } | { kind: 'putAway', thingId, hurry }
// `text` and `hurry` are keys into the texts of the language, never sentences.

const ARRIVAL_ROOM = 'hall';
const MORNING_ROOMS = ['bedroom', 'kitchen', 'living'];
const MOST_CARRIED = 3;
const USES_PER_DAY = 2;
const HURRY_CHANCE = 1 / 2;
const FIRST_DAY = 1;

/** Why you are in a hurry. `notFor` names the thing the reason would make absurd (the phone rings in another room). */
export const HURRY_REASONS = Object.freeze([
  { id: 'doorbell', notFor: null },
  { id: 'pan', notFor: null },
  { id: 'phone', notFor: 'phone' },
  { id: 'toilet', notFor: null },
]);

const pause = (text) => ({ kind: 'pause', text });
const moveTo = (roomId, text) => ({ kind: 'moveTo', roomId, text });
const find = (thingId, useId = null) => ({ kind: 'find', thingId, useId });
const putAway = (thingId) => ({ kind: 'putAway', thingId, hurry: null });

function leaveAndComeHome(things, random) {
  const going = random.shuffle(things.filter((thing) => thing.carry).map((thing) => thing.id)).slice(0, MOST_CARRIED);
  if (going.length === 0) return { events: [], going };
  const events = [
    moveTo(random.pick(MORNING_ROOMS), 'morning'),
    ...going.map((id) => find(id)),
    pause('outForTheDay'),
    moveTo(ARRIVAL_ROOM, 'arrive'),
    ...going.map((id) => putAway(id)),
  ];
  return { events, going };
}

/** Things that did not leave with you come first, so the day does not wear out the same few things. */
function uses(things, going, random) {
  const withUses = things.filter((thing) => thing.uses.length > 0);
  const stayed = withUses.filter((thing) => !going.includes(thing.id));
  const left = withUses.filter((thing) => going.includes(thing.id));
  return [...random.shuffle(stayed), ...random.shuffle(left)].slice(0, USES_PER_DAY).flatMap((thing) => {
    const chosen = random.pick(thing.uses);
    return [
      find(thing.id, chosen.id),
      { ...moveTo(chosen.roomId, 'after'), thingId: thing.id, useId: chosen.id },
      putAway(thing.id),
    ];
  });
}

function hurryOnePutAway(events, random) {
  const putAways = events.filter((event) => event.kind === 'putAway');
  const hurried = random.pick(putAways);
  hurried.hurry = random.pick(HURRY_REASONS.filter((reason) => reason.notFor !== hurried.thingId).map((reason) => reason.id));
}

/**
 * @param {{ dayNumber: number, things: object[], nowhere: string[], random: { pick: Function, shuffle: Function, chance: Function } }} options
 *   `things` are the chosen catalogue entries; `nowhere` the ids of those that lie nowhere in the world
 */
export function buildDay({ dayNumber, things, nowhere, random }) {
  const events = [pause('day')];
  let going = [];
  if (nowhere.length > 0) {
    events.push(moveTo(ARRIVAL_ROOM, 'arrive'), ...random.shuffle(nowhere).map((id) => putAway(id)));
  } else {
    const leaving = leaveAndComeHome(things, random);
    going = leaving.going;
    events.push(...leaving.events);
  }
  events.push(...uses(things, going, random));
  if (dayNumber > FIRST_DAY && random.chance(HURRY_CHANCE)) hurryOnePutAway(events, random);
  return events;
}
