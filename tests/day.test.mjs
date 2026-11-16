import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Day, canContinue } from '../app/js/day.js';
import { RefusedMove } from '../app/js/errors.js';
import { LAYOUT } from '../app/js/layout.js';
import { THINGS, defaultPlan } from '../app/js/things.js';
import { World } from '../app/js/world.js';
import { dayState, find, findDay, makeDay, moveTo, pause, playOut, pocket, putAway, putAwayDay, rand, refusalOf, spot, worldWith } from './day-helper.mjs';

const coatHooks = spot('hall', 'coat-hooks');

// ---- the days of the story ----

test('a thing left on the sofa on day 1 is on the sofa at the start of day 2', () => {
  const world = new World(LAYOUT);
  const dayOne = Day.start({ layout: LAYOUT, things: THINGS, world, plan: defaultPlan(), progress: { streaks: {} }, random: rand(), number: 1 });
  playOut(dayOne);
  const dayTwo = Day.start({ layout: LAYOUT, things: THINGS, world, plan: defaultPlan(), progress: dayOne.progress(), random: rand(), number: 2 });
  assert.deepEqual(dayTwo.world.whereIs('keys'), spot('living', 'sofa'));
});

test('a new day begins on a pause that shows its number', () => {
  const day = Day.start({ layout: LAYOUT, things: THINGS, world: new World(LAYOUT), plan: defaultPlan(), progress: { streaks: {} }, random: rand(), number: 3 });
  assert.equal(day.state().number, 3);
  assert.deepEqual(day.state().event, pause('day'));
});

test('every chosen thing that is nowhere comes home with you, and no other', () => {
  const world = worldWith({ keys: spot('living', 'sofa') });
  const day = Day.start({ layout: LAYOUT, things: THINGS, world, plan: defaultPlan(), progress: { streaks: {} }, random: rand(), number: 2 });
  const comingHome = day.snapshot().events.filter((event) => event.kind === 'putAway').map((event) => event.thingId);
  assert.deepEqual(comingHome.slice(0, 3), ['wallet', 'phone', 'scissors']);
});

// ---- moving between events ----

const arriving = () => makeDay([pause('day'), moveTo('hall', 'arrive'), putAway('keys')], { state: { roomId: 'bedroom', startedIn: 'bedroom' } });

test('a move to a room puts you there at once, without a screen of its own', () => {
  const day = arriving();
  day.continue();
  assert.equal(day.state().roomId, 'hall');
  assert.equal(day.state().event.kind, 'putAway');
});

test('a thing that was nowhere is in your hand when its put-away begins', () => {
  const day = arriving();
  day.continue();
  assert.deepEqual(day.state().inHand, ['keys']);
});

test('the text of a move is pending on the screen after it', () => {
  const day = arriving();
  day.continue();
  assert.deepEqual(day.state().arrival, { text: 'arrive' });
});

test('the pending text of a move is gone after the next action', () => {
  const day = arriving();
  day.continue();
  day.walkTo('kitchen');
  assert.equal(day.state().arrival, null);
});

test('the pending text is gone after the next action even when that action is refused', () => {
  const day = arriving();
  day.continue();
  refusalOf(() => day.look('hook'));
  assert.equal(day.state().arrival, null);
});

test('a pause waits for Next and does not move on by itself', () => {
  const day = arriving();
  assert.equal(day.state().event.kind, 'pause');
  assert.equal(day.state().roomId, 'bedroom');
});

test('things found in the morning are all still in hand when you come home', () => {
  const world = worldWith({ keys: spot('hall', 'hook'), wallet: spot('hall', 'console') });
  const day = makeDay([find('keys'), find('wallet'), pause('outForTheDay'), moveTo('hall', 'arrive'), putAway('keys'), putAway('wallet')], { world });
  day.look('hook');
  day.look('console');
  day.continue();
  assert.deepEqual(day.state().inHand, ['keys', 'wallet']);
  day.putDown('hook');
  assert.deepEqual(day.state().inHand, ['wallet']);
  assert.equal(day.state().event.thingId, 'wallet');
});

test('when the last event is done the day is finished', () => {
  const day = putAwayDay('keys');
  assert.equal(day.state().finished, false);
  day.putDown('hook');
  assert.equal(day.state().finished, true);
  assert.equal(day.state().event, null);
});

test('nothing can be done in a finished day', () => {
  const day = putAwayDay('keys');
  day.putDown('hook');
  assert.equal(refusalOf(() => day.walkTo('kitchen')), 'not-now');
});

// ---- uses ----

test('a use ends with you in the use room, holding the thing, asked to put it away', () => {
  const world = worldWith({ phone: spot('kitchen', 'counter') });
  const day = makeDay([find('phone', 'call'), moveTo('garden', 'after', { thingId: 'phone', useId: 'call' }), putAway('phone')], { world, state: { roomId: 'kitchen' } });
  day.look('counter');
  assert.equal(day.state().roomId, 'garden');
  assert.deepEqual(day.state().event, putAway('phone'));
  assert.deepEqual(day.state().inHand, ['phone']);
  assert.deepEqual(day.state().arrival, { text: 'after', thingId: 'phone', useId: 'call' });
});

// ---- finding ----

test('after a find the thing is in hand and no longer on its spot', () => {
  const day = findDay('keys', { world: worldWith({ keys: spot('hall', 'hook') }) });
  day.look('hook');
  assert.deepEqual(day.state().inHand, ['keys']);
  assert.equal(day.world.whereIs('keys'), null);
  assert.deepEqual(day.world.itemsOn(spot('hall', 'hook')), []);
});

test('looking at the right spot tells you what it found and what it took', () => {
  const day = findDay('keys', { world: worldWith({ keys: spot('hall', 'hook') }) });
  assert.deepEqual(day.look('hook'), { found: true, steps: 1, location: spot('hall', 'hook'), seen: [] });
});

test('looking costs one step whether or not the thing is there', () => {
  const day = findDay('keys', { world: worldWith({ keys: spot('hall', 'hook') }) });
  assert.equal(day.look('console').steps, 1);
  assert.equal(day.state().steps, 1);
  assert.equal(day.look('hook').steps, 2);
});

test('looking in the wrong place tells you what else lies there', () => {
  const world = worldWith({ keys: spot('hall', 'hook'), wallet: spot('hall', 'console') });
  const result = findDay('keys', { world }).look('console');
  assert.equal(result.found, false);
  assert.deepEqual(result.seen, ['wallet']);
});

test('looking at the same spot twice costs twice', () => {
  const day = findDay('keys', { world: worldWith({ keys: spot('hall', 'hook') }) });
  day.look('console');
  assert.equal(day.look('console').steps, 2);
});

test('a find ends the event and the next event starts at zero steps', () => {
  const world = worldWith({ keys: spot('hall', 'hook') });
  const day = makeDay([find('keys'), putAway('keys')], { world });
  day.look('console');
  day.look('hook');
  assert.equal(day.state().steps, 0);
  assert.equal(day.state().event.kind, 'putAway');
});

test('a thing in a pocket of the coat you wear is found in any room for one step', () => {
  const world = worldWith({ wallet: pocket('coat', 'coat-inside') });
  const day = findDay('wallet', { world, roomId: 'kitchen' });
  assert.deepEqual(day.lookInPocket('coat', 'coat-inside'), { found: true, steps: 1, location: pocket('coat', 'coat-inside'), seen: [] });
  assert.deepEqual(day.state().inHand, ['wallet']);
  assert.equal(day.world.whereIs('wallet'), null);
});

test('a thing in a pocket of the coat that hangs in the hallway is found by walking there and looking in that pocket', () => {
  const world = worldWith({ wallet: pocket('coat', 'coat-inside') }, { coat: coatHooks });
  const day = findDay('wallet', { world, roomId: 'kitchen' });
  assert.equal(refusalOf(() => day.lookInPocket('coat', 'coat-inside')), 'out-of-reach');
  day.walkTo('hall');
  const result = day.lookInPocket('coat', 'coat-inside');
  assert.equal(result.found, true);
  assert.equal(result.steps, 2);
});

test('a spot you looked at shows what lies there, one you did not look at shows nothing', () => {
  const world = worldWith({ keys: spot('hall', 'hook'), wallet: spot('hall', 'console') });
  const day = findDay('keys', { world });
  day.look('console');
  assert.deepEqual(day.seenAt(spot('hall', 'console')), ['wallet']);
  assert.deepEqual(day.seenAt(spot('hall', 'shoes')), []);
  assert.deepEqual(day.seenAt(spot('hall', 'hook')), []);
});

test('while putting away you see everything within reach, and nothing in a pocket that is out of reach', () => {
  const world = worldWith({ wallet: spot('hall', 'console'), phone: pocket('coat', 'coat-left') }, { coat: spot('kitchen', 'counter') });
  const day = putAwayDay('keys', { world });
  assert.deepEqual(day.seenAt(spot('hall', 'console')), ['wallet']);
  assert.deepEqual(day.seenAt(pocket('coat', 'coat-left')), []);
});

// ---- putting away ----

test('putting a thing down on a spot of the room leaves it there, out of your hand', () => {
  const day = makeDay([putAway('keys'), putAway('wallet')], { state: { roomId: 'living', startedIn: 'living', inHand: ['keys'] } });
  const result = day.putDown('sofa');
  assert.deepEqual(day.world.whereIs('keys'), spot('living', 'sofa'));
  assert.deepEqual(day.state().inHand, ['wallet']);
  assert.deepEqual(result, { thingId: 'keys', location: spot('living', 'sofa'), atHome: false, steps: 0 });
});

test('putting a thing in a pocket of the coat you wear leaves it in that pocket', () => {
  const day = putAwayDay('wallet', { roomId: 'kitchen' });
  const result = day.putInPocket('coat', 'coat-inside');
  assert.deepEqual(day.world.whereIs('wallet'), pocket('coat', 'coat-inside'));
  assert.equal(result.atHome, true);
});

test('putting a thing down costs no steps of its own', () => {
  const day = putAwayDay('keys', { roomId: 'kitchen' });
  day.walkTo('hall');
  assert.equal(day.putDown('hook').steps, 1);
});

test('putting a thing in a pocket of a coat that hangs in this room works', () => {
  const day = putAwayDay('wallet', { world: worldWith({}, { coat: coatHooks }) });
  assert.equal(day.putInPocket('coat', 'coat-inside').atHome, true);
});

// ---- walking and the coat: what each action costs ----

test('walking to a room two doors away costs two steps and arrives there in one action', () => {
  const day = putAwayDay('keys');
  day.walkTo('dining');
  assert.equal(day.state().roomId, 'dining');
  assert.equal(day.state().steps, 2);
});

test('walking to a room next door costs one step', () => {
  const day = putAwayDay('keys');
  day.walkTo('kitchen');
  assert.equal(day.state().steps, 1);
});

test('steps add up over the actions of one event', () => {
  const day = putAwayDay('keys');
  day.walkTo('dining');
  day.walkTo('kitchen');
  assert.equal(day.state().steps, 3);
});

test('taking the coat off hangs it on a spot of this room and costs one step', () => {
  const day = putAwayDay('keys');
  day.takeOff('coat', 'coat-hooks');
  assert.equal(day.world.isWorn('coat'), false);
  assert.deepEqual(day.world.garmentSpot('coat'), coatHooks);
  assert.equal(day.state().steps, 1);
});

test('putting the coat on again costs one step', () => {
  const day = putAwayDay('keys');
  day.takeOff('coat', 'coat-hooks');
  day.putOn('coat');
  assert.equal(day.world.isWorn('coat'), true);
  assert.equal(day.state().steps, 2);
});

test('a refused action costs nothing and changes nothing', () => {
  const day = putAwayDay('keys');
  const before = day.snapshot();
  refusalOf(() => day.takeOff('trousers', 'coat-hooks'));
  assert.deepEqual({ ...day.snapshot(), arrival: null }, { ...before, arrival: null });
});

// ---- refusals ----

test('a spot that is not in this room is refused', () => {
  assert.equal(refusalOf(() => putAwayDay('keys').putDown('counter')), 'spot-not-here');
});

test('a pocket of a coat that hangs in another room is out of reach', () => {
  const day = putAwayDay('keys', { world: worldWith({}, { coat: spot('kitchen', 'counter') }) });
  assert.equal(refusalOf(() => day.putInPocket('coat', 'coat-left')), 'out-of-reach');
});

test('trousers cannot be taken off', () => {
  assert.equal(refusalOf(() => putAwayDay('keys').takeOff('trousers', 'coat-hooks')), 'not-removable');
});

test('a coat that is already off cannot be taken off again', () => {
  const day = putAwayDay('keys');
  day.takeOff('coat', 'coat-hooks');
  assert.equal(refusalOf(() => day.takeOff('coat', 'coat-hooks')), 'not-worn');
});

test('a coat can only be hung on a spot of the room you are in', () => {
  assert.equal(refusalOf(() => putAwayDay('keys').takeOff('coat', 'counter')), 'spot-not-here');
});

test('a coat that hangs in another room cannot be put on', () => {
  const day = putAwayDay('keys', { world: worldWith({}, { coat: spot('kitchen', 'counter') }) });
  assert.equal(refusalOf(() => day.putOn('coat')), 'garment-not-here');
});

test('walking to the room you are in is refused', () => {
  assert.equal(refusalOf(() => putAwayDay('keys').walkTo('hall')), 'already-here');
});

test('there is nothing to put away while you are looking for something', () => {
  assert.equal(refusalOf(() => findDay('keys').putDown('hook')), 'nothing-in-hand');
});

test('there is nothing to look for while you are putting something away', () => {
  assert.equal(refusalOf(() => putAwayDay('keys').look('hook')), 'nothing-to-find');
});

test('the coat is handled while putting away only, not while looking', () => {
  assert.equal(refusalOf(() => findDay('keys').takeOff('coat', 'coat-hooks')), 'not-now');
});

test('nothing but Next works on a pause', () => {
  assert.equal(refusalOf(() => arriving().walkTo('kitchen')), 'not-now');
});

test('Next does nothing when the event is not a pause', () => {
  assert.equal(refusalOf(() => putAwayDay('keys').continue()), 'not-now');
});

test('a refusal is a RefusedMove, so the flow can tell it from a bug', () => {
  assert.throws(() => putAwayDay('keys').putDown('counter'), RefusedMove);
});

test('a room that does not exist is a mistake in the code, not a refusal', () => {
  assert.throws(() => putAwayDay('keys').walkTo('moon'), (error) => !(error instanceof RefusedMove) && /room/i.test(error.message));
});

// ---- hurry ----

test('the day says why you are in a hurry', () => {
  assert.equal(putAwayDay('keys', { hurry: 'doorbell' }).state().hurry, 'doorbell');
  assert.equal(putAwayDay('keys').state().hurry, null);
});

test('in a hurry a room at two steps is refused', () => {
  const day = putAwayDay('keys', { hurry: 'doorbell' });
  assert.equal(refusalOf(() => day.walkTo('dining')), 'too-far-in-a-hurry');
});

test('in a hurry a room at one step is accepted', () => {
  const day = putAwayDay('keys', { hurry: 'doorbell' });
  day.walkTo('kitchen');
  assert.equal(day.state().roomId, 'kitchen');
});

test('in a hurry the distance counts from where you stand, so you can still go on step by step', () => {
  const day = putAwayDay('keys', { hurry: 'doorbell' });
  day.walkTo('kitchen');
  day.walkTo('dining');
  assert.equal(day.state().roomId, 'dining');
});

test('in a hurry everything else still works', () => {
  const day = putAwayDay('keys', { hurry: 'doorbell' });
  day.takeOff('coat', 'coat-hooks');
  assert.equal(day.state().steps, 1);
});

// ---- the streak ----

const streakOf = (day, thingId) => day.progress().streaks[thingId];

test('putting a thing on its home spot adds one to its streak', () => {
  const day = putAwayDay('keys', { streaks: { keys: 2 } });
  day.putDown('hook');
  assert.equal(streakOf(day, 'keys'), 3);
});

test('a first time on the home spot starts a streak of one', () => {
  const day = putAwayDay('keys');
  assert.equal(day.putDown('hook').atHome, true);
  assert.equal(streakOf(day, 'keys'), 1);
});

test('putting a thing on another spot sets its streak to zero', () => {
  const day = putAwayDay('keys', { streaks: { keys: 4 } });
  day.putDown('console');
  assert.equal(streakOf(day, 'keys'), 0);
});

test('in a hurry with the home spot out of reach, another spot leaves the streak as it was', () => {
  const day = putAwayDay('scissors', { hurry: 'pan', streaks: { scissors: 3 } }); // home: the desk drawer, two steps away
  day.putDown('console');
  assert.equal(streakOf(day, 'scissors'), 3);
});

test('in a hurry with the home spot in reach, another spot sets the streak to zero', () => {
  const day = putAwayDay('phone', { hurry: 'pan', streaks: { phone: 3 } }); // home: the kitchen counter, one step away
  day.putDown('console');
  assert.equal(streakOf(day, 'phone'), 0);
});

test('in a hurry with the home spot in a pocket of a coat that hangs two steps away, the streak stays', () => {
  const world = worldWith({}, { coat: spot('study', 'desk') });
  const day = putAwayDay('wallet', { hurry: 'pan', world, streaks: { wallet: 3 } });
  day.putDown('console');
  assert.equal(streakOf(day, 'wallet'), 3);
});

test('in a hurry with the home spot in a pocket of the coat you wear, another spot sets the streak to zero', () => {
  const day = putAwayDay('wallet', { hurry: 'pan', streaks: { wallet: 3 } });
  day.putDown('console');
  assert.equal(streakOf(day, 'wallet'), 0);
});

test('without a hurry a home spot far away is no excuse', () => {
  const day = putAwayDay('scissors', { streaks: { scissors: 3 } });
  day.putDown('console');
  assert.equal(streakOf(day, 'scissors'), 0);
});

test('the home spot counts from where the event started, not from where you walked to', () => {
  const day = putAwayDay('scissors', { hurry: 'pan', streaks: { scissors: 3 } });
  day.walkTo('toilet'); // one step from the hall, but the study is still two steps from where you started
  day.putDown('cistern');
  assert.equal(streakOf(day, 'scissors'), 3);
});

test('the streaks you hand in are not changed behind your back', () => {
  const streaks = { keys: 2 };
  putAwayDay('keys', { streaks }).putDown('hook');
  assert.deepEqual(streaks, { keys: 2 });
});

test('the hint for a thing follows its streak', () => {
  assert.equal(putAwayDay('keys', { streaks: { keys: 0 } }).hintFor('keys'), 'shown');
  assert.equal(putAwayDay('keys', { streaks: { keys: 5 } }).hintFor('keys'), 'hidden');
});

// ---- saving and continuing ----

function midFind() {
  const world = worldWith({ keys: spot('living', 'sofa'), wallet: spot('hall', 'console') });
  const day = makeDay([find('keys'), putAway('keys')], { world, state: { number: 5 } });
  day.look('console');
  day.walkTo('living');
  return day;
}

const resumed = (day) => new Day({
  layout: LAYOUT, things: THINGS, world: World.restore(LAYOUT, day.world.snapshot()), plan: defaultPlan(),
  progress: day.progress(), state: JSON.parse(JSON.stringify(day.snapshot())),
});

test('a day restored from its saved state in the middle of a find continues with the same event, room, steps and world', () => {
  const day = midFind();
  const again = resumed(day);
  assert.deepEqual(again.state(), day.state());
  assert.deepEqual(again.world.snapshot(), day.world.snapshot());
  assert.equal(again.state().steps, 2);
});

test('a restored day goes on exactly like the original', () => {
  const again = resumed(midFind());
  assert.equal(again.look('sofa').steps, 3);
  assert.deepEqual(again.state().inHand, ['keys']);
});

test('a restored day remembers which spots you already looked at', () => {
  const world = worldWith({ keys: spot('living', 'sofa'), wallet: spot('hall', 'console') });
  const day = findDay('keys', { world });
  day.look('console');
  const again = resumed(day);
  assert.deepEqual(again.seenAt(spot('hall', 'console')), ['wallet']);
  assert.deepEqual(again.seenAt(spot('hall', 'shoes')), []);
});

test('a day restored right after a move still has the text of that move pending', () => {
  const day = arriving();
  day.continue();
  assert.deepEqual(resumed(day).state().arrival, { text: 'arrive' });
});

test('the saved state is plain data that survives a JSON round trip unchanged', () => {
  const snapshot = midFind().snapshot();
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot);
});

test('the saved state carries the fields of the save', () => {
  const snapshot = midFind().snapshot();
  assert.equal(snapshot.number, 5);
  assert.equal(snapshot.index, 0);
  assert.equal(snapshot.roomId, 'living');
  assert.equal(snapshot.steps, 2);
  assert.deepEqual(snapshot.inHand, []);
  assert.equal(Array.isArray(snapshot.events), true);
});

test('the saved state is a copy: later actions do not change it', () => {
  const day = midFind();
  const snapshot = day.snapshot();
  day.look('sofa');
  assert.equal(snapshot.steps, 2);
  assert.equal(snapshot.index, 0);
});

// ---- changing the home spots between two events ----

test('a plan chosen between two events applies to the next put-away', () => {
  const day = putAwayDay('keys', { roomId: 'kitchen' });
  day.usePlan({ ...defaultPlan(), keys: spot('kitchen', 'counter') });
  assert.equal(day.putDown('counter').atHome, true);
  assert.equal(day.progress().streaks.keys, 1);
});

test('the hint follows the plan that was chosen last', () => {
  const day = putAwayDay('keys');
  day.usePlan({ ...defaultPlan(), keys: spot('kitchen', 'counter') });
  assert.deepEqual(day.plan.keys, spot('kitchen', 'counter'));
});

// ---- a saved day that cannot be continued ----

const context = { layout: LAYOUT, things: THINGS };
/** A day in the middle of a use, with every field filled in. */
const goodState = () => structuredClone(dayState(
  [pause('day'), find('keys', 'shed'), moveTo('shed', 'after', { thingId: 'keys', useId: 'shed' }), putAway('keys', 'doorbell')],
  { index: 3, roomId: 'shed', startedIn: 'shed', inHand: ['keys'], steps: 2, opened: ['hall/hook'], arrival: { text: 'after', thingId: 'keys', useId: 'shed' } },
));

test('a day made by the game can be continued, at its start and in the middle of an event', () => {
  const day = Day.start({ layout: LAYOUT, things: THINGS, world: new World(LAYOUT), plan: defaultPlan(), progress: { streaks: {} }, random: rand({ chance: () => true }), number: 2 });
  assert.equal(canContinue(day.snapshot(), context), true);
  day.continue();
  day.walkTo('kitchen');
  assert.equal(canContinue(day.snapshot(), context), true);
});

test('a state with every field filled in can be continued', () => {
  assert.equal(canContinue(goodState(), context), true);
});

test('a state without a pending text and without a hurry can be continued', () => {
  const state = goodState();
  state.arrival = null;
  state.events[3].hurry = null;
  assert.equal(canContinue(state, context), true);
});

const BROKEN = {
  'something that is not an object': () => 'a day',
  'a list instead of an object': () => [],
  'no number': (s) => { delete s.number; return s; },
  'no events': (s) => { s.events = []; return s; },
  'events that are not a list': (s) => { s.events = 'many'; return s; },
  'an unknown kind of event': (s) => { s.events[1] = { kind: 'dance' }; return s; },
  'an event that is not an object': (s) => { s.events[1] = 'find'; return s; },
  'a pause with an unknown text': (s) => { s.events[0].text = 'nap'; return s; },
  'a move to a room that does not exist': (s) => { s.events[2].roomId = 'moon'; return s; },
  'a move with an unknown text': (s) => { s.events[2].text = 'teleport'; return s; },
  'a move after a use without the thing': (s) => { delete s.events[2].thingId; return s; },
  'a move after a use that the thing does not have': (s) => { s.events[2].useId = 'moon'; return s; },
  'a find for a thing that does not exist': (s) => { s.events[1].thingId = 'ghost'; return s; },
  'a find with a use that the thing does not have': (s) => { s.events[1].useId = 'moon'; return s; },
  'a put-away for a thing that does not exist': (s) => { s.events[3].thingId = 'ghost'; return s; },
  'a put-away with an unknown reason to hurry': (s) => { s.events[3].hurry = 'earthquake'; return s; },
  'an index past the last event': (s) => { s.index = 4; return s; },
  'a negative index': (s) => { s.index = -1; return s; },
  'an index that is not a whole number': (s) => { s.index = 1.5; return s; },
  'a room that does not exist': (s) => { s.roomId = 'moon'; return s; },
  'a room where the event started that does not exist': (s) => { s.startedIn = 'moon'; return s; },
  'a thing in hand that does not exist': (s) => { s.inHand = ['ghost']; return s; },
  'things in hand that are not a list': (s) => { s.inHand = 'keys'; return s; },
  'steps that are negative': (s) => { s.steps = -1; return s; },
  'steps that are not a whole number': (s) => { s.steps = '2'; return s; },
  'spots looked at that are not strings': (s) => { s.opened = [1]; return s; },
  'spots looked at that are not a list': (s) => { s.opened = 'hall/hook'; return s; },
  'a pending text that is not an object': (s) => { s.arrival = 'arrive'; return s; },
  'a pending text with an unknown key': (s) => { s.arrival = { text: 'teleport' }; return s; },
};

for (const [name, spoil] of Object.entries(BROKEN)) {
  test(`a saved day with ${name} cannot be continued`, () => {
    assert.equal(canContinue(spoil(goodState()), context), false);
  });
}

test('a saved day for a thing that is no longer chosen cannot be continued', () => {
  const withoutKeys = { layout: LAYOUT, things: THINGS.filter((thing) => thing.id !== 'keys') };
  assert.equal(canContinue(goodState(), withoutKeys), false);
});
