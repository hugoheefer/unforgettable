import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RULES, buildDay, chainIdsOf } from '../app/js/day-plan.js';
import { CHAINS } from '../app/js/chains.js';
import { THINGS } from '../app/js/things.js';
import { pause, rand } from './day-helper.mjs';

const hall = { placeId: 'hall', spotId: 'console' };
const counter = { placeId: 'kitchen', spotId: 'counter' };
const [WALLET, PHONE] = ['wallet', 'phone'].map((id) => THINGS.find((thing) => thing.id === id));
const TIN = { id: 'coffee-tin', icon: '🫙', home: counter };

const move = (id, roomId) => ({ id, kind: 'move', roomId });
const goTo = (id, roomId) => ({ id, kind: 'goTo', roomId });
const take = (id, object, leftAt = counter) => ({ id, kind: 'take', object, leftAt });
const putBack = (id, object) => ({ id, kind: 'putBack', object });
const tell = (id) => ({ id, kind: 'tell' });
const check = (id) => ({ id, kind: 'check' });

// small chains of our own, so each rule is seen apart from the chains of the game
const OPEN = { id: 'open', opener: true, steps: [move('in', 'hall'), tell('t')] };
const NEEDS_KEYS = { id: 'needs-keys', opener: true, needsOnPerson: ['keys'], steps: [move('in', 'hall'), take('k', 'keys', hall), putBack('kb', 'keys')] };
const TWO = {
  id: 'two',
  steps: [move('m', 'kitchen'), take('k', 'keys', hall), take('s', 'scissors'), tell('t'), putBack('kb', 'keys'), putBack('sb', 'scissors'), check('c')],
};
const WALKING = {
  id: 'walking',
  steps: [move('m', 'hall'), take('k', 'keys', hall), goTo('g', 'kitchen'), putBack('kb', 'keys'), goTo('g2', 'living'), tell('t'), check('c')],
};
const CALL = {
  id: 'call',
  steps: [move('m', 'living'), tell('ring'), take('p', 'phone', hall), move('w', 'garden'), putBack('pb', 'phone'), goTo('in', 'living'), check('c')],
};
const PLAIN = { id: 'plain', steps: [move('m', 'dining'), tell('t'), check('c')] };
const OTHER = { id: 'other', steps: [goTo('g', 'study'), tell('t')] };

const plan = (options) => buildDay({ dayNumber: 2, chains: [OPEN, TWO, PLAIN], things: THINGS, onPerson: [], yesterday: [], random: rand(), ...options });
const kinds = (events) => events.map((event) => event.kind);
const ofChain = (events, id) => events.filter((event) => event.chain === id);
const luck = (overrides = {}) => rand({ chance: () => true, ...overrides });
const lastOf = (list) => list[list.length - 1];

// ---- the shape of a day ----

test('a day is a pause, an opener and two other chains', () => {
  const events = buildDay({ dayNumber: 2, chains: CHAINS, things: THINGS, onPerson: ['keys'], yesterday: [], random: rand() });
  assert.deepEqual(events[0], pause('day'));
  const ids = chainIdsOf(events);
  assert.equal(ids.length, 3);
  assert.ok(CHAINS.find((chain) => chain.id === ids[0]).opener);
  assert.ok(ids.slice(1).every((id) => !CHAINS.find((chain) => chain.id === id).opener));
});

test('the chains of a day follow each other: the events of one chain are together', () => {
  const events = plan();
  assert.deepEqual(chainIdsOf(events), ['open', 'two', 'plain']);
  const order = events.slice(1).map((event) => event.chain);
  assert.deepEqual(order, [...order].sort((a, b) => ['open', 'two', 'plain'].indexOf(a) - ['open', 'two', 'plain'].indexOf(b)));
});

test('the ids of the chains of a day come from its events, without the events a forgotten thing adds', () => {
  const events = [pause('day'), { kind: 'tell', chain: 'a', step: 't', roomId: 'hall' }, { kind: 'find', chain: null, step: null }, { kind: 'tell', chain: 'a', step: 'u', roomId: 'hall' }, { kind: 'tell', chain: 'b', step: 't', roomId: 'hall' }];
  assert.deepEqual(chainIdsOf(events), ['a', 'b']);
});

test('the events are plain data that survive a JSON round trip unchanged', () => {
  const events = buildDay({ dayNumber: 2, chains: CHAINS, things: THINGS, onPerson: ['keys'], yesterday: [], random: luck() });
  assert.deepEqual(JSON.parse(JSON.stringify(events)), events);
});

// ---- the opener ----

test('with the keys on the person the opener can be come-home', () => {
  const chains = [NEEDS_KEYS, OPEN, PLAIN, OTHER];
  assert.equal(chainIdsOf(buildDay({ dayNumber: 2, chains, things: THINGS, onPerson: ['keys'], yesterday: [], random: rand() }))[0], 'needs-keys');
});

test('with the keys on the hook only the opener that needs nothing can be picked', () => {
  const chains = [NEEDS_KEYS, OPEN, PLAIN, OTHER];
  for (const pick of [(list) => list[0], lastOf]) {
    assert.equal(chainIdsOf(buildDay({ dayNumber: 2, chains, things: THINGS, onPerson: [], yesterday: [], random: rand({ pick }) }))[0], 'open');
  }
});

test('a need for a thing that is not chosen does not block the opener', () => {
  const chains = [NEEDS_KEYS, OPEN, PLAIN, OTHER];
  const events = buildDay({ dayNumber: 2, chains, things: [WALLET, PHONE], onPerson: [], yesterday: [], random: rand() });
  assert.equal(chainIdsOf(events)[0], 'needs-keys');
});

test('the opener is picked at random from those whose need is met', () => {
  const chains = [NEEDS_KEYS, OPEN, PLAIN, OTHER];
  const events = buildDay({ dayNumber: 2, chains, things: THINGS, onPerson: ['keys'], yesterday: [], random: rand({ pick: lastOf }) });
  assert.equal(chainIdsOf(events)[0], 'open');
});

// ---- the other chains ----

test('the two other chains are different from each other and from the opener', () => {
  const [, ...others] = chainIdsOf(buildDay({ dayNumber: 2, chains: [OPEN, TWO, PLAIN, OTHER], things: THINGS, onPerson: [], yesterday: [], random: rand() }));
  assert.equal(new Set(others).size, 2);
  assert.ok(!others.includes('open'));
});

test('the other chains are picked at random', () => {
  const chains = [OPEN, TWO, PLAIN, OTHER];
  const shuffled = buildDay({ dayNumber: 2, chains, things: THINGS, onPerson: [], yesterday: [], random: rand({ shuffle: (list) => [...list].reverse() }) });
  assert.deepEqual(chainIdsOf(shuffled), ['open', 'other', 'plain']);
});

test('chains that were not played yesterday are preferred', () => {
  const chains = [OPEN, TWO, PLAIN, OTHER, WALKING];
  const ids = chainIdsOf(buildDay({ dayNumber: 2, chains, things: THINGS, onPerson: [], yesterday: ['two', 'plain'], random: rand() }));
  assert.deepEqual(ids, ['open', 'other', 'walking']);
});

test('when too few chains are left, a chain of yesterday fills the day', () => {
  const chains = [OPEN, TWO, PLAIN, OTHER];
  const ids = chainIdsOf(buildDay({ dayNumber: 2, chains, things: THINGS, onPerson: [], yesterday: ['two', 'plain'], random: rand() }));
  assert.deepEqual(ids, ['open', 'other', 'two']);
});

test('with only one other chain in the list the day has only that one', () => {
  assert.deepEqual(chainIdsOf(buildDay({ dayNumber: 2, chains: [OPEN, PLAIN], things: THINGS, onPerson: [], yesterday: [], random: rand() })), ['open', 'plain']);
});

// ---- silent chains ----

const putAwaysOf = (events, id) => ofChain(events, id).filter((event) => event.kind === 'putAway').map((event) => event.thingId);

test('without luck no chain is silent: every put-back of a chosen thing is there', () => {
  const events = plan();
  assert.deepEqual(putAwaysOf(events, 'two'), ['keys', 'scissors']);
});

test('the chance of a silent chain is one in two, asked once for each chain that has a put-back of a chosen thing', () => {
  const asked = [];
  plan({ chains: [NEEDS_KEYS, TWO, PLAIN], onPerson: ['keys'], random: rand({ chance: (probability) => { asked.push(probability); return false; } }) });
  assert.deepEqual(asked, [1 / 2, 1 / 2]);
});

test('a silent chain misses exactly one put-back, of a chosen thing, and keeps the other', () => {
  const events = plan({ random: luck() });
  assert.deepEqual(putAwaysOf(events, 'two'), ['scissors']);
});

test('which thing the app stays silent about is picked at random', () => {
  const events = plan({ random: luck({ pick: lastOf }) });
  assert.deepEqual(putAwaysOf(events, 'two'), ['keys']);
});

test('the silent thing is still taken: only its put-back is left out', () => {
  const events = plan({ random: luck() });
  assert.deepEqual(ofChain(events, 'two').filter((event) => event.kind === 'find').map((event) => event.thingId), ['keys', 'scissors']);
});

test('the opener of the very first day is never silent, even with luck', () => {
  const events = plan({ dayNumber: 1, chains: [NEEDS_KEYS, TWO, PLAIN], onPerson: ['keys'], random: luck() });
  assert.deepEqual(putAwaysOf(events, 'needs-keys'), ['keys']);
  assert.deepEqual(putAwaysOf(events, 'two'), ['scissors']);
});

test('on a later day the opener can be silent', () => {
  const events = plan({ chains: [NEEDS_KEYS, TWO, PLAIN], onPerson: ['keys'], random: luck() });
  assert.deepEqual(putAwaysOf(events, 'needs-keys'), []);
});

test('a chain whose put-backs are all of things that are not chosen is never silent', () => {
  const asked = [];
  const events = plan({ things: [WALLET], random: rand({ chance: (p) => { asked.push(p); return true; } }) });
  assert.deepEqual(asked, []);
  assert.equal(events.some((event) => event.kind === 'putAway'), false);
});

test('a chain without any put-back is never silent', () => {
  const asked = [];
  const events = plan({ chains: [OPEN, PLAIN], random: rand({ chance: (p) => { asked.push(p); return true; } }) });
  assert.deepEqual(chainIdsOf(events), ['open', 'plain']);
  assert.deepEqual(asked, []);
});

// ---- props and things: one chain, one catalogue ----

const coffee = () => CHAINS.find((chain) => chain.id === 'coffee');
const coffeeEvents = (things) => ofChain(buildDay({ dayNumber: 2, chains: [OPEN, coffee(), PLAIN], things, onPerson: [], yesterday: [], random: rand() }), 'coffee');
const eventOfStep = (events, step) => events.find((event) => event.step === step);

test('the tin of the coffee chain is only told while it is a prop', () => {
  const events = coffeeEvents(THINGS);
  assert.equal(eventOfStep(events, 'tin').kind, 'tell');
  assert.equal(eventOfStep(events, 'tin-back').kind, 'tell');
});

test('the same chain, with the tin added to the catalogue, finds and puts away the tin: the chain did not change', () => {
  const events = coffeeEvents([...THINGS, TIN]);
  assert.equal(eventOfStep(events, 'tin').kind, 'find');
  assert.equal(eventOfStep(events, 'tin').thingId, 'coffee-tin');
  assert.equal(eventOfStep(events, 'tin-back').kind, 'putAway');
});

test('the scissors of the coffee chain are a find in both cases', () => {
  for (const things of [THINGS, [...THINGS, TIN]]) assert.equal(eventOfStep(coffeeEvents(things), 'scissors').kind, 'find');
});

test('a tell, a walk-to and a check carry the room where the story stands', () => {
  const events = ofChain(plan({ chains: [OPEN, WALKING, PLAIN] }), 'walking');
  assert.deepEqual(events.filter((event) => ['goTo', 'tell', 'check'].includes(event.kind)).map((event) => [event.kind, event.roomId]),
    [['goTo', 'kitchen'], ['goTo', 'living'], ['tell', 'living'], ['check', 'living']]);
});

test('every event of a chain carries the chain and the step it comes from', () => {
  const events = plan().slice(1).filter((event) => event.kind !== 'letGo');
  assert.ok(events.every((event) => typeof event.chain === 'string' && typeof event.step === 'string'));
});

// ---- letting go ----

const sequence = (events, id) => ofChain(events, id).map((event) => (event.kind === 'letGo' ? `letGo:${event.thingIds.join(',')}` : event.kind));
const letGosOf = (events) => events.filter((event) => event.kind === 'letGo');

test('a guided chain has no let-go at all: there is nothing to lay down', () => {
  const events = plan({ chains: [OPEN, WALKING, PLAIN] });
  assert.deepEqual(sequence(events, 'walking'), ['moveTo', 'find', 'goTo', 'putAway', 'goTo', 'tell', 'check']);
  assert.deepEqual(letGosOf(plan()), []);
});

test('in a silent chain the let-go at the end names the silent thing, and the guided thing is left alone', () => {
  const events = plan({ random: luck() });
  assert.deepEqual(sequence(events, 'two'), ['moveTo', 'find', 'find', 'tell', 'putAway', 'check', 'letGo:keys']);
});

test('a silent thing is laid down at the next move or walk, and not named again afterwards', () => {
  const events = plan({ chains: [OPEN, WALKING, PLAIN], random: luck() });
  assert.deepEqual(sequence(events, 'walking'), ['moveTo', 'find', 'letGo:keys', 'goTo', 'goTo', 'tell', 'check']);
});

test('a let-go before a move leaves a thing in hand when the same chain puts it back later: the call chain keeps the phone in the garden', () => {
  const events = plan({ chains: [OPEN, CALL, PLAIN] });
  assert.deepEqual(sequence(events, 'call'), ['moveTo', 'tell', 'find', 'moveTo', 'putAway', 'goTo', 'check']);
});

test('the same call chain with a silent phone lays the phone down before the move to the garden', () => {
  const events = plan({ chains: [OPEN, CALL, PLAIN], random: luck() });
  assert.deepEqual(sequence(events, 'call'), ['moveTo', 'tell', 'find', 'letGo:phone', 'moveTo', 'goTo', 'check']);
});

test('a let-go knows the chain it belongs to and never has an empty list', () => {
  const letGos = letGosOf(plan({ random: luck() }));
  assert.ok(letGos.length > 0);
  assert.ok(letGos.every((event) => typeof event.chain === 'string' && event.thingIds.length > 0));
});

test('a chain whose things are all props has no let-go', () => {
  assert.deepEqual(letGosOf(plan({ things: [WALLET] })), []);
});

// ---- the rules of a day: one settings object ----

const presentDay = (things, rules) => buildDay({ dayNumber: 2, chains: [OPEN, CHAINS.find((chain) => chain.id === 'present'), PLAIN], things, onPerson: [], yesterday: [], random: luck(), rules });
const chosen = (...ids) => THINGS.filter((thing) => ids.includes(thing.id));

test('the default rules are two other chains, a silent chance of one in two and one silent put-back per chain', () => {
  assert.deepEqual(DEFAULT_RULES, { otherChains: 2, silentChance: 1 / 2, silentPerChain: 1 });
});

test('without rules given, the default rules are used', () => {
  const given = buildDay({ dayNumber: 2, chains: [OPEN, TWO, PLAIN], things: THINGS, onPerson: [], yesterday: [], random: rand(), rules: DEFAULT_RULES });
  assert.deepEqual(chainIdsOf(given), ['open', 'two', 'plain']);
  assert.deepEqual(plan(), given);
});

test('one other chain gives an opener and one chain', () => {
  const events = plan({ chains: [OPEN, TWO, PLAIN, OTHER], rules: { ...DEFAULT_RULES, otherChains: 1 } });
  assert.deepEqual(chainIdsOf(events), ['open', 'two']);
});

test('three other chains give an opener and three chains', () => {
  const events = plan({ chains: [OPEN, TWO, PLAIN, OTHER, WALKING], rules: { ...DEFAULT_RULES, otherChains: 3 } });
  assert.deepEqual(chainIdsOf(events), ['open', 'two', 'plain', 'other']);
});

test('a silent chance of zero gives no silent chain, and the chance asked is the one of the rules', () => {
  const asked = [];
  const events = plan({ rules: { ...DEFAULT_RULES, silentChance: 0 }, random: rand({ chance: (p) => { asked.push(p); return p > 0; } }) });
  assert.deepEqual(putAwaysOf(events, 'two'), ['keys', 'scissors']);
  assert.deepEqual(asked, [0]);
});

test('a silent chance of one makes every chain with a chosen put-back silent, except the opener of the first day', () => {
  const chance = (p) => p >= 1;
  const rules = { ...DEFAULT_RULES, silentChance: 1 };
  const events = plan({ dayNumber: 1, chains: [NEEDS_KEYS, TWO, PLAIN], onPerson: ['keys'], rules, random: rand({ chance }) });
  assert.deepEqual(putAwaysOf(events, 'needs-keys'), ['keys']);
  assert.deepEqual(putAwaysOf(events, 'two'), ['scissors']);
});

test('two silent put-backs leave out two put-backs in a chain with two chosen things', () => {
  const events = presentDay(chosen('scissors', 'phone'), { ...DEFAULT_RULES, silentPerChain: 2 });
  assert.deepEqual(putAwaysOf(events, 'present'), []);
  assert.deepEqual(letGosOf(events).flatMap((event) => event.thingIds).sort(), ['phone', 'scissors']);
});

test('two silent put-backs leave out only one in a chain that has one chosen thing', () => {
  const events = presentDay(chosen('scissors'), { ...DEFAULT_RULES, silentPerChain: 2 });
  assert.equal(events.some((event) => event.kind === 'putAway' && event.chain === 'present'), false);
  assert.equal(ofChain(events, 'present').filter((event) => event.kind === 'find').length, 1);
});

test('one silent put-back leaves out one of two', () => {
  assert.equal(putAwaysOf(presentDay(chosen('scissors', 'phone'), DEFAULT_RULES), 'present').length, 1);
});

// ---- the very first day ----
const lastPick = () => rand({ pick: (list) => list[list.length - 1] });
const START = { ...NEEDS_KEYS, id: 'start', startsTheGame: true };

test('the first day ever opens with the chain that starts the game, whatever the luck', () => {
  const events = buildDay({ dayNumber: 1, chains: [START, OPEN, PLAIN], things: THINGS, onPerson: ['keys'], yesterday: [], random: lastPick() });
  assert.equal(chainIdsOf(events)[0], 'start');
});

test('on a later day the opener is picked by luck again', () => {
  const events = buildDay({ dayNumber: 2, chains: [START, OPEN, PLAIN], things: THINGS, onPerson: ['keys'], yesterday: [], random: lastPick() });
  assert.equal(chainIdsOf(events)[0], 'open');
});

test('when the chain that starts the game cannot open, the first day opens with another opener', () => {
  const events = buildDay({ dayNumber: 1, chains: [START, OPEN, PLAIN], things: THINGS, onPerson: [], yesterday: [], random: lastPick() });
  assert.equal(chainIdsOf(events)[0], 'open');
});

test('the real game starts at the front door: come-home starts the game', () => {
  assert.deepEqual(CHAINS.filter((chain) => chain.startsTheGame).map((chain) => chain.id), ['come-home']);
});
