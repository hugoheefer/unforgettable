import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Day, canContinue } from '../app/js/day.js';
import { RefusedMove } from '../app/js/errors.js';
import { LAYOUT } from '../app/js/layout.js';
import { THINGS, defaultPlan } from '../app/js/things.js';
import { World } from '../app/js/world.js';
import { PLAN, check, dayState, find, findDay, goTo, letGo, makeDay, moveTo, pause, playOut, pocket, putAway, putAwayDay, rand, refusalOf, spot, tell, worldWith } from './day-helper.mjs';

const coatHooks = spot('hall', 'coat-hooks');
const start = (world, options = {}) => Day.start({ layout: LAYOUT, things: THINGS, world, plan: defaultPlan(), progress: { streaks: {} }, random: rand(), number: 2, ...options });

// ---- the start of a game and of a day ----

test('a new game has every chosen thing on its home spot', () => {
  const day = start(new World(LAYOUT), { number: 1 });
  for (const thing of THINGS) assert.deepEqual(day.world.whereIs(thing.id), defaultPlan()[thing.id], thing.id);
});

test('a thing that is nowhere is on its home spot when the next day starts, the others stay where they are', () => {
  const world = worldWith({ keys: spot('living', 'sofa'), wallet: pocket('coat', 'coat-inside'), phone: spot('kitchen', 'counter') });
  const day = start(world);
  assert.deepEqual(day.world.whereIs('scissors'), defaultPlan().scissors);
  assert.deepEqual(day.world.whereIs('keys'), spot('living', 'sofa'));
});

test('a thing left on the sofa is still on the sofa when the next day starts', () => {
  const world = worldWith({ keys: spot('living', 'sofa') });
  assert.deepEqual(start(world, { number: 3 }).world.whereIs('keys'), spot('living', 'sofa'));
});

test('a new day begins on a pause that shows its number', () => {
  const day = start(new World(LAYOUT), { number: 3 });
  assert.equal(day.state().number, 3);
  assert.deepEqual(day.state().event, pause('day'));
});

test('the day starts with nothing in hand and the player in the start room', () => {
  const state = start(new World(LAYOUT)).state();
  assert.deepEqual([state.inHand, state.roomId], [[], LAYOUT.startRoomId]);
});

test('a whole day made by the game can be played to its end', () => {
  const day = playOut(start(new World(LAYOUT), { number: 1 }));
  assert.equal(day.state().finished, true);
});

// ---- moving between events ----

const arriving = () => makeDay([pause('day'), moveTo('hall'), putAway('keys')], { state: { roomId: 'bedroom', startedIn: 'bedroom', inHand: ['keys'] } });

test('a move to a room puts you there at once, without a screen of its own', () => {
  const day = arriving();
  day.continue();
  assert.equal(day.state().roomId, 'hall');
  assert.equal(day.state().event.kind, 'putAway');
});

test('a put-away for a thing that is not in your hand is done at once: you put it away on your own earlier', () => {
  const day = makeDay([pause('day'), putAway('keys'), putAway('wallet')], { state: { inHand: ['wallet'] } });
  day.continue();
  assert.deepEqual(day.state().event, putAway('wallet'));
});

test('the text of a move is pending on the screen after it', () => {
  const day = arriving();
  day.continue();
  assert.deepEqual(day.state().arrival, { chain: 'come-home', step: 'door' });
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
  const day = makeDay([find('keys'), find('wallet'), tell('hall'), moveTo('hall'), putAway('keys'), putAway('wallet')], { world });
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

// ---- the new kinds of event ----

test('a find for a thing that is in hand is done at once and the day goes on', () => {
  const day = makeDay([pause('day'), find('keys'), putAway('keys')], { state: { inHand: ['keys'] } });
  day.continue();
  assert.deepEqual(day.state().event, putAway('keys'));
});

test('a find keeps where the thing stays when nobody puts it back, in the state of the day', () => {
  const day = findDay('keys', { world: worldWith({ keys: spot('hall', 'hook') }) });
  assert.deepEqual(day.snapshot().leftAt, { keys: spot('hall', 'console') });
});

test('a find that is done at once keeps where the thing stays as well', () => {
  const day = makeDay([pause('day'), find('keys'), tell('hall')], { state: { inHand: ['keys'] } });
  day.continue();
  assert.deepEqual(day.snapshot().leftAt, { keys: spot('hall', 'console') });
});

test('a walk-to event is not done before you stand in the room', () => {
  const day = makeDay([goTo('kitchen'), tell('kitchen')]);
  assert.equal(day.state().event.kind, 'goTo');
  day.walkTo('dining');
  assert.equal(day.state().event.kind, 'goTo');
});

test('a walk-to event for the room you already stand in is done at once, and its reason waits as the text of the next screen', () => {
  const day = makeDay([tell('hall'), goTo('hall'), tell('hall')]);
  day.continue();
  assert.equal(day.state().event.kind, 'tell');
  assert.deepEqual(day.state().arrival, { chain: 'coffee', step: 'go' });
});

test('a walk-to event for another room leaves no text waiting', () => {
  const day = makeDay([tell('hall'), goTo('kitchen'), tell('kitchen')]);
  day.continue();
  assert.equal(day.state().arrival, null);
});

test('a walk-to event is done the moment you arrive in the room, also after a longer way', () => {
  const day = makeDay([goTo('kitchen'), tell('kitchen')]);
  day.walkTo('kitchen');
  assert.equal(day.state().event.kind, 'tell');
});

test('the steps of a walk-to event do not carry over to the next event', () => {
  const day = makeDay([goTo('kitchen'), tell('kitchen')]);
  day.walkTo('kitchen');
  assert.equal(day.state().steps, 0);
});

test('a tell waits for Next', () => {
  const day = makeDay([tell('hall'), tell('hall')]);
  assert.equal(day.state().event.kind, 'tell');
  day.continue();
  assert.equal(day.state().finished, false);
  day.continue();
  assert.equal(day.state().finished, true);
});

// ---- letting go ----

const silentCoffee = () => {
  const day = makeDay(
    [pause('day'), find('scissors'), tell('kitchen'), letGo(['scissors']), tell('kitchen')],
    { world: worldWith({ scissors: spot('kitchen', 'drawer') }), plan: defaultPlan(), streaks: { scissors: 3 }, state: { roomId: 'kitchen', startedIn: 'kitchen' } },
  );
  day.continue();
  return day;
};

test('in a silent chain the thing lies on its left-at spot after the chain, without a word', () => {
  const day = silentCoffee();
  day.look('drawer');
  day.continue();
  assert.deepEqual(day.world.whereIs('scissors'), spot('kitchen', 'counter'));
  assert.deepEqual(day.state().inHand, []);
  assert.deepEqual(day.state().event, tell('kitchen'));
});

test('letting go sets the streak of the thing to zero', () => {
  const day = silentCoffee();
  day.look('drawer');
  day.continue();
  assert.equal(day.progress().streaks.scissors, 0);
});

test('what was let go is handed over once, for the history', () => {
  const day = silentCoffee();
  day.look('drawer');
  day.continue();
  assert.deepEqual(day.takeLeftBehind(), ['scissors']);
  assert.deepEqual(day.takeLeftBehind(), []);
});

test('letting go does not touch a thing that is not in hand any more', () => {
  const day = makeDay([letGo(['scissors']), tell('kitchen')], { world: worldWith({ scissors: spot('study', 'desk') }), streaks: { scissors: 3 } });
  assert.deepEqual(day.world.whereIs('scissors'), spot('study', 'desk'));
  assert.equal(day.progress().streaks.scissors, 3);
});

test('letting go leaves a thing alone that is not in its list, so the call chain keeps the phone in the garden', () => {
  const day = makeDay([letGo([]), tell('garden')], { state: { inHand: ['phone'], roomId: 'garden' } });
  assert.deepEqual(day.state().inHand, ['phone']);
});

test('in a guided chain nothing is let go: the put-away puts the thing where the player wants it', () => {
  const day = makeDay(
    [find('scissors'), putAway('scissors'), letGo([])],
    { world: worldWith({ scissors: spot('kitchen', 'drawer') }), plan: defaultPlan(), state: { roomId: 'kitchen', startedIn: 'kitchen' } },
  );
  day.look('drawer');
  day.putDown('sofa'.replace('sofa', 'fruit-bowl'));
  assert.deepEqual(day.world.whereIs('scissors'), spot('kitchen', 'fruit-bowl'));
  assert.deepEqual(day.takeLeftBehind(), []);
});

// ---- doing something else first ----

const FREE_EVENTS = { tell: () => tell('kitchen'), goTo: () => goTo('dining'), check: () => check('kitchen') };

for (const [kind, event] of Object.entries(FREE_EVENTS)) {
  test(`during a ${kind} you can walk, take your coat off and put it on again`, () => {
    const day = makeDay([event(), tell('kitchen')], { state: { roomId: 'kitchen', startedIn: 'kitchen' } });
    day.takeOff('coat', 'counter');
    assert.equal(day.world.isWorn('coat'), false);
    day.putOn('coat');
    assert.equal(day.world.isWorn('coat'), true);
    day.walkTo('hall');
    assert.equal(day.state().roomId, 'hall');
  });

  test(`during a ${kind} you can put a thing in your hand away on your own, and it counts for the streak`, () => {
    const day = makeDay([event(), tell('kitchen')], { state: { roomId: 'kitchen', startedIn: 'kitchen', inHand: ['phone'] }, streaks: { phone: 1 } });
    const result = day.putDown('counter', 'phone');
    assert.deepEqual(day.world.whereIs('phone'), spot('kitchen', 'counter'));
    assert.deepEqual(day.state().inHand, []);
    assert.equal(result.atHome, true);
    assert.equal(day.progress().streaks.phone, 2);
  });

  test(`during a ${kind} you can put a thing in a pocket on your own`, () => {
    const day = makeDay([event(), tell('kitchen')], { state: { roomId: 'kitchen', startedIn: 'kitchen', inHand: ['wallet'] } });
    assert.equal(day.putInPocket('coat', 'coat-left', 'wallet').atHome, false);
    assert.deepEqual(day.world.whereIs('wallet'), pocket('coat', 'coat-left'));
  });
}

test('putting a thing away on your own, somewhere else than home, sets its streak to zero', () => {
  const day = makeDay([tell('kitchen')], { state: { roomId: 'kitchen', startedIn: 'kitchen', inHand: ['phone'] }, streaks: { phone: 3 } });
  day.putDown('sink', 'phone');
  assert.equal(day.progress().streaks.phone, 0);
});

test('putting a thing away on your own costs the steps walked since the last put-away, and no more', () => {
  const day = makeDay([tell('kitchen')], { state: { roomId: 'kitchen', startedIn: 'kitchen', inHand: ['phone', 'wallet'] } });
  day.walkTo('hall');
  assert.equal(day.putDown('hook', 'phone').steps, 1);
  assert.equal(day.putDown('console', 'wallet').steps, 0);
});

test('a thing you do not hold cannot be put away on your own', () => {
  const day = makeDay([tell('kitchen')], { state: { roomId: 'kitchen', startedIn: 'kitchen' } });
  assert.equal(refusalOf(() => day.putDown('counter', 'phone')), 'nothing-in-hand');
});

test('during a put-away you can put another thing in your hand away first', () => {
  const day = makeDay([putAway('keys'), tell('hall')], { state: { inHand: ['keys', 'phone'] } });
  day.putDown('console', 'phone');
  assert.deepEqual(day.state().inHand, ['keys']);
  assert.equal(day.state().event.kind, 'putAway');
});

test('during a find you can only walk: nothing is put away and no coat is handled', () => {
  const day = findDay('keys', { world: worldWith({ keys: spot('hall', 'hook') }), state: { inHand: ['phone'] } });
  assert.equal(refusalOf(() => day.putDown('console', 'phone')), 'nothing-in-hand');
  assert.equal(refusalOf(() => day.takeOff('coat', 'coat-hooks')), 'not-now');
  day.walkTo('kitchen');
  assert.equal(day.state().roomId, 'kitchen');
});

// ---- coming back ----

test('when you walked off from a tell, the story asks you back to the room it stands in', () => {
  const day = makeDay([tell('kitchen'), tell('kitchen')], { state: { roomId: 'kitchen', startedIn: 'kitchen' } });
  assert.equal(day.state().returnTo, null);
  day.walkTo('study');
  assert.equal(day.state().returnTo, 'kitchen');
});

test('when you walked off from a check, the story asks you back to the room it stands in', () => {
  const day = makeDay([check('living'), tell('living')], { state: { roomId: 'living', startedIn: 'living' } });
  day.walkTo('dining');
  assert.equal(day.state().returnTo, 'living');
});

test('while the story asks you back it does not go on: Next and the answers of the check are refused', () => {
  const day = makeDay([tell('kitchen'), tell('kitchen')], { state: { roomId: 'study', startedIn: 'study' } });
  assert.equal(refusalOf(() => day.continue()), 'come-back');
  const checking = makeDay([check('kitchen'), tell('kitchen')], { state: { roomId: 'study', startedIn: 'study' } });
  assert.equal(refusalOf(() => checking.answerCheck(true)), 'come-back');
  assert.equal(refusalOf(() => checking.answerCheck(false)), 'come-back');
  assert.equal(refusalOf(() => checking.forgot('keys')), 'come-back');
  assert.equal(refusalOf(() => day.answerCheck(true)), 'not-now');
});

test('while the story asks you back you can still put a thing away on your own in the room you walked to', () => {
  const day = makeDay([tell('kitchen'), tell('kitchen')], { state: { roomId: 'kitchen', startedIn: 'kitchen', inHand: ['scissors'] } });
  day.walkTo('study');
  assert.equal(day.state().returnTo, 'kitchen');
  assert.equal(day.putDown('desk-drawer', 'scissors').steps, 3);
  day.walkTo('kitchen');
  assert.equal(day.state().returnTo, null);
  day.continue();
  assert.equal(day.state().event.kind, 'tell');
});

test('a check asks you back too, and refuses the answer until you are there', () => {
  const day = makeDay([check('living'), tell('living')], { state: { roomId: 'dining', startedIn: 'dining' } });
  assert.equal(refusalOf(() => day.answerCheck(true)), 'come-back');
});

test('a walk-to event never asks you back: walking to its room is what it asks', () => {
  const day = makeDay([goTo('kitchen'), tell('kitchen')], { state: { roomId: 'study', startedIn: 'study' } });
  assert.equal(day.state().returnTo, null);
});

// ---- the check ----

test('answering yes ends the check and changes nothing', () => {
  const world = worldWith({ scissors: spot('kitchen', 'counter') });
  const day = makeDay([check('living'), tell('living')], { world, state: { roomId: 'living', startedIn: 'living' }, streaks: { scissors: 2 } });
  const before = JSON.stringify([day.world.snapshot(), day.progress(), day.state().inHand]);
  day.answerCheck(true);
  assert.equal(day.state().event.kind, 'tell');
  assert.equal(JSON.stringify([day.world.snapshot(), day.progress(), day.state().inHand]), before);
});

test('answering no does not end the check and offers every chosen thing to pick from', () => {
  const day = makeDay([check('living'), tell('living')], { state: { roomId: 'living', startedIn: 'living' } });
  assert.deepEqual(day.answerCheck(false), ['keys', 'wallet', 'phone', 'scissors']);
  assert.equal(day.state().event.kind, 'check');
});

test('forgetting a thing puts a find and a put-away for it right after the check, and ends the check', () => {
  const world = worldWith({ scissors: spot('kitchen', 'counter') });
  const day = makeDay([check('living'), tell('living')], { world, plan: defaultPlan(), state: { roomId: 'living', startedIn: 'living' } });
  day.forgot('scissors');
  assert.deepEqual(day.state().event.kind, 'find');
  assert.equal(day.state().event.thingId, 'scissors');
  assert.deepEqual(day.snapshot().events.map((event) => event.kind), ['check', 'find', 'putAway', 'tell']);
  assert.deepEqual(day.snapshot().events[2].thingId, 'scissors');
});

test('the forgotten thing is searched for and put away with the normal events, also when it lies on its home spot', () => {
  const world = worldWith({ scissors: spot('kitchen', 'drawer') });
  const day = makeDay([check('kitchen'), tell('kitchen')], { world, plan: defaultPlan(), state: { roomId: 'kitchen', startedIn: 'kitchen' }, streaks: { scissors: 1 } });
  day.forgot('scissors');
  assert.equal(day.look('drawer').found, true);
  assert.equal(day.state().event.kind, 'putAway');
  assert.equal(day.putDown('drawer').atHome, true);
  assert.equal(day.progress().streaks.scissors, 2);
  assert.equal(day.state().event.kind, 'tell');
});

test('a thing that is not chosen cannot be forgotten', () => {
  const day = makeDay([check('living'), tell('living')], { state: { roomId: 'living', startedIn: 'living' } });
  assert.throws(() => day.forgot('dragon'), (error) => !(error instanceof RefusedMove));
});

test('forgetting outside a check is refused', () => {
  assert.equal(refusalOf(() => makeDay([tell('hall')]).forgot('keys')), 'not-now');
});

test('the events a forgotten thing adds survive saving and are not chains of the story', () => {
  const day = makeDay([check('living'), tell('living')], { world: worldWith({ keys: spot('hall', 'hook') }), state: { roomId: 'living', startedIn: 'living' } });
  day.forgot('keys');
  const added = day.snapshot().events.slice(1, 3);
  assert.deepEqual(added.map((event) => [event.chain, event.step]), [[null, null], [null, null]]);
  assert.deepEqual(JSON.parse(JSON.stringify(day.snapshot())), day.snapshot());
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
  assert.deepEqual(day.look('hook'), { found: true, steps: 1, location: spot('hall', 'hook'), seen: [], shortest: 1, wasHome: true });
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
  assert.deepEqual(day.lookInPocket('coat', 'coat-inside'), { found: true, steps: 1, location: pocket('coat', 'coat-inside'), seen: [], shortest: 1, wasHome: true });
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
  const day = makeDay([putAway('keys'), putAway('wallet')], { state: { roomId: 'living', startedIn: 'living', inHand: ['keys', 'wallet'] } });
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

test('a home spot far away is no excuse: another spot sets the streak to zero', () => {
  const day = putAwayDay('scissors', { streaks: { scissors: 3 } });
  day.putDown('console');
  assert.equal(streakOf(day, 'scissors'), 0);
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
  layout: LAYOUT, things: THINGS, world: World.restore(LAYOUT, day.world.snapshot()), plan: PLAN,
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
  assert.deepEqual(resumed(day).state().arrival, { chain: 'come-home', step: 'door' });
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
  day.usePlan({ ...PLAN, keys: spot('kitchen', 'counter') });
  assert.equal(day.putDown('counter').atHome, true);
  assert.equal(day.progress().streaks.keys, 1);
});

test('the hint follows the plan that was chosen last', () => {
  const day = putAwayDay('keys');
  day.usePlan({ ...PLAN, keys: spot('kitchen', 'counter') });
  assert.deepEqual(day.plan.keys, spot('kitchen', 'counter'));
});

// ---- a saved day that cannot be continued ----

const context = { layout: LAYOUT, things: THINGS };
/** A day in the middle of a chain, with an event of every kind and every field filled in. */
const goodState = () => structuredClone(dayState(
  [pause('day'), moveTo('hall'), goTo('kitchen'), tell('kitchen'), find('keys'), check('kitchen'), letGo(['keys']), putAway('keys')],
  { index: 7, roomId: 'kitchen', startedIn: 'kitchen', inHand: ['keys'], steps: 2, opened: ['hall/hook'], arrival: { chain: 'come-home', step: 'door' }, leftAt: { keys: spot('hall', 'console') } },
));

test('a day made by the game can be continued, at its start and in the middle of an event', () => {
  const day = start(new World(LAYOUT));
  assert.equal(canContinue(day.snapshot(), context), true);
  day.continue();
  day.walkTo('kitchen');
  assert.equal(canContinue(day.snapshot(), context), true);
});

test('a state with every field filled in, and an event of every kind, can be continued', () => {
  assert.equal(canContinue(goodState(), context), true);
});

test('a state without a pending text can be continued', () => {
  const state = goodState();
  state.arrival = null;
  assert.equal(canContinue(state, context), true);
});

test('a day with events that a forgotten thing added can be continued', () => {
  const state = goodState();
  state.events[4] = { ...find('keys'), chain: null, step: null };
  state.events[7] = { ...putAway('keys'), chain: null, step: null };
  assert.equal(canContinue(state, context), true);
});

const BROKEN = {
  'no events': (s) => { s.events = []; return s; },
  'events that are not a list': (s) => { s.events = 'many'; return s; },
  'an event of an unknown kind': (s) => { s.events[1] = { kind: 'teleport' }; return s; },
  'an event that is not an object': (s) => { s.events[1] = 'x'; return s; },
  'a pause with an unknown text': (s) => { s.events[0] = pause('teatime'); return s; },
  'a move to a room that does not exist': (s) => { s.events[1].roomId = 'moon'; return s; },
  'a move for a step that no chain has': (s) => { s.events[1].step = 'teleport'; return s; },
  'a move for a chain that does not exist': (s) => { s.events[1].chain = 'dragons'; return s; },
  'a walk-to for a room that does not exist': (s) => { s.events[2].roomId = 'moon'; return s; },
  'a walk-to for a step that no chain has': (s) => { s.events[2].step = 'teleport'; return s; },
  'a tell in a room that does not exist': (s) => { s.events[3].roomId = 'moon'; return s; },
  'a tell for a chain that does not exist': (s) => { s.events[3].chain = 'dragons'; return s; },
  'a find for a thing that does not exist': (s) => { s.events[4].thingId = 'ghost'; return s; },
  'a find without a left-at spot': (s) => { delete s.events[4].leftAt; return s; },
  'a find with a left-at spot that does not exist': (s) => { s.events[4].leftAt = spot('moon', 'rock'); return s; },
  'a find for a step that no chain has': (s) => { s.events[4].step = 'teleport'; return s; },
  'a check in a room that does not exist': (s) => { s.events[5].roomId = 'moon'; return s; },
  'a check for a step that no chain has': (s) => { s.events[5].step = 'teleport'; return s; },
  'a let-go that is not a list': (s) => { s.events[6].thingIds = 'keys'; return s; },
  'a let-go of a thing that does not exist': (s) => { s.events[6].thingIds = ['ghost']; return s; },
  'a put-away for a thing that does not exist': (s) => { s.events[7].thingId = 'ghost'; return s; },
  'a put-away for a step that no chain has': (s) => { s.events[7].step = 'teleport'; return s; },
  'an index past the last event': (s) => { s.index = 8; return s; },
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
  'a pending text for a step that no chain has': (s) => { s.arrival = { chain: 'come-home', step: 'teleport' }; return s; },
  'left-at spots that are not an object': (s) => { s.leftAt = 'console'; return s; },
  'a left-at spot of a thing that does not exist': (s) => { s.leftAt = { ghost: spot('hall', 'console') }; return s; },
  'a left-at spot that does not exist': (s) => { s.leftAt = { keys: spot('moon', 'rock') }; return s; },
  'no left-at spots at all': (s) => { delete s.leftAt; return s; },
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

test('a day saved in the middle of each new kind of event survives saving and goes on', () => {
  const world = worldWith({ keys: spot('hall', 'hook') });
  const days = {
    goTo: makeDay([goTo('kitchen'), tell('kitchen')], { world }),
    tell: makeDay([tell('hall'), tell('hall')], { world }),
    check: makeDay([check('hall'), tell('hall')], { world }),
    find: findDay('keys', { world }),
  };
  for (const [kind, day] of Object.entries(days)) {
    const saved = JSON.parse(JSON.stringify(day.snapshot()));
    assert.equal(canContinue(saved, context), true, kind);
    assert.deepEqual(resumed(day).state(), day.state(), kind);
  }
});

// ---- what a find costs ----

const costOf = ({ found: wasFound, steps, shortest, wasHome }) => ({ found: wasFound, steps, shortest, wasHome });
const keysAt = (location, hang = {}) => worldWith({ keys: location }, hang);

test('a thing found on its home spot in the room where the event started costs 1 step, 1 possible, was home', () => {
  const day = findDay('keys', { world: keysAt(spot('hall', 'hook')) });
  assert.deepEqual(costOf(day.look('hook')), { found: true, steps: 1, shortest: 1, wasHome: true });
});

test('looking at three wrong spots first costs 4 steps and 1 possible', () => {
  const day = findDay('keys', { world: keysAt(spot('hall', 'console')) });
  day.look('hook');
  day.look('coat-hooks');
  day.look('shoes');
  assert.deepEqual(costOf(day.look('console')), { found: true, steps: 4, shortest: 1, wasHome: false });
});

test('a thing two rooms away found by the shortest way costs 3 and 3', () => {
  const day = findDay('keys', { world: keysAt(spot('dining', 'sideboard')) });
  day.walkTo('living');
  day.walkTo('dining');
  assert.deepEqual(costOf(day.look('sideboard')), { found: true, steps: 3, shortest: 3, wasHome: false });
});

test('a thing in a pocket of the coat you wear has 1 possible step', () => {
  const day = findDay('wallet', { world: worldWith({ wallet: pocket('coat', 'coat-left') }) });
  assert.deepEqual(costOf(day.lookInPocket('coat', 'coat-left')), { found: true, steps: 1, shortest: 1, wasHome: false });
});

test('a thing in the pocket that is its home spot was home', () => {
  const day = findDay('wallet', { world: worldWith({ wallet: pocket('coat', 'coat-inside') }) });
  assert.equal(day.lookInPocket('coat', 'coat-inside').wasHome, true);
});

test('a thing in the pocket of a coat that hangs in the next room has 2 possible steps', () => {
  const world = worldWith({ wallet: pocket('coat', 'coat-inside') }, { coat: spot('living', 'sofa') });
  const day = findDay('wallet', { world });
  day.walkTo('living');
  assert.deepEqual(costOf(day.lookInPocket('coat', 'coat-inside')), { found: true, steps: 2, shortest: 2, wasHome: true });
});

test('a look that finds nothing tells nothing about the cost', () => {
  const result = findDay('keys', { world: keysAt(spot('hall', 'console')) }).look('hook');
  assert.equal(result.found, false);
  assert.equal('shortest' in result, false);
  assert.equal('wasHome' in result, false);
});

test('the shortest way is counted from the room where the event started, not from where you stand', () => {
  const day = findDay('keys', { world: keysAt(spot('dining', 'sideboard')) });
  for (const room of ['garden', 'hall', 'living', 'dining']) day.walkTo(room);
  assert.deepEqual(costOf(day.look('sideboard')), { found: true, steps: 5, shortest: 3, wasHome: false });
});

test('a find that begins after a move counts from the room that move ended in', () => {
  const events = [pause('day'), moveTo('living'), find('keys')];
  const day = makeDay(events, { world: keysAt(spot('dining', 'sideboard')) });
  day.continue();
  day.walkTo('dining');
  assert.deepEqual(costOf(day.look('sideboard')), { found: true, steps: 2, shortest: 2, wasHome: false });
});

test('a find that is continued after a reload keeps its shortest way', () => {
  const day = findDay('keys', { world: keysAt(spot('dining', 'sideboard')) });
  day.walkTo('living');
  const again = resumed(day);
  again.walkTo('dining');
  assert.deepEqual(costOf(again.look('sideboard')), { found: true, steps: 3, shortest: 3, wasHome: false });
});

test('home spots chosen in the middle of a find do not change whether the thing was home when the event began', () => {
  const day = findDay('keys', { world: keysAt(spot('hall', 'console')) });
  day.usePlan({ ...PLAN, keys: spot('hall', 'console') });
  assert.equal(day.look('console').wasHome, false);
});

test('the note about the find is part of the saved state and is gone when the find is over', () => {
  const world = keysAt(spot('hall', 'hook'));
  const day = makeDay([pause('day'), find('keys'), putAway('keys')], { world });
  day.continue();
  assert.deepEqual(day.snapshot().findStart, { shortest: 1, wasHome: true });
  day.look('hook');
  assert.equal(day.snapshot().findStart, null);
  assert.equal(canContinue(day.snapshot(), context), true);
});

// ---- a saved day in the middle of a find needs its note ----

const goodFindState = () => structuredClone(dayState([pause('day'), find('keys')], { index: 1, findStart: { shortest: 2, wasHome: false }, leftAt: { keys: spot('hall', 'console') } }));

test('a day in the middle of a find, with its note, can be continued', () => {
  assert.equal(canContinue(goodFindState(), context), true);
});

const BROKEN_NOTES = {
  'no note while a find is running': (s) => { delete s.findStart; return s; },
  'a note that is null while a find is running': (s) => { s.findStart = null; return s; },
  'a note that is not an object': (s) => { s.findStart = '2'; return s; },
  'a note without a shortest way': (s) => { delete s.findStart.shortest; return s; },
  'a shortest way of 0': (s) => { s.findStart.shortest = 0; return s; },
  'a shortest way that is not a whole number': (s) => { s.findStart.shortest = 1.5; return s; },
  'a note without wasHome': (s) => { delete s.findStart.wasHome; return s; },
  'a wasHome that is not true or false': (s) => { s.findStart.wasHome = 'yes'; return s; },
};

for (const [name, spoil] of Object.entries(BROKEN_NOTES)) {
  test(`a saved day with ${name} cannot be continued`, () => {
    assert.equal(canContinue(spoil(goodFindState()), context), false);
  });
}

test('a saved day in the middle of a find without the left-at spot of that thing cannot be continued', () => {
  const state = goodFindState();
  state.leftAt = {};
  assert.equal(canContinue(state, context), false);
});

test('a saved day with a note left over from a find that is over cannot be continued', () => {
  const state = goodState();
  state.findStart = { shortest: 1, wasHome: true };
  assert.equal(canContinue(state, context), false);
});
