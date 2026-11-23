import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RULES, buildDay, chainIdsOf } from '../app/js/day-plan.js';
import { CHAINS } from '../app/js/chains.js';
import { evening } from '../app/js/chains/evening.js';
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
const CLOSE = { id: 'close', closer: true, steps: [tell('dusk'), check('look')] };

/** The rules of the early versions, to test the seam that levels will use: sometimes silent, the first opener guided. */
const SOMETIMES_SILENT = Object.freeze({ otherChains: 2, silentChance: 1 / 2, silentPerChain: 1, guideFirstOpener: true });

const plan = (options) => buildDay({ dayNumber: 2, chains: [OPEN, TWO, PLAIN], things: THINGS, onPerson: [], yesterday: [], random: rand(), rules: SOMETIMES_SILENT, ...options });
const kinds = (events) => events.map((event) => event.kind);
const ofChain = (events, id) => events.filter((event) => event.chain === id);
const luck = (overrides = {}) => rand({ chance: () => true, ...overrides });
const lastOf = (list) => list[list.length - 1];

// ---- the shape of a day ----

test('a day is a pause, an opener, two other chains and the closing chain', () => {
  const events = buildDay({ dayNumber: 2, chains: CHAINS, things: THINGS, onPerson: ['keys'], yesterday: [], random: rand() });
  assert.deepEqual(events[0], pause('day'));
  const ids = chainIdsOf(events);
  const chainOf = (id) => CHAINS.find((chain) => chain.id === id);
  assert.equal(ids.length, 4);
  assert.ok(chainOf(ids[0]).opener);
  assert.ok(ids.slice(1, 3).every((id) => !chainOf(id).opener && !chainOf(id).closer));
  assert.ok(chainOf(ids[3]).closer);
});

test('a session ends with the events of the closing chain, however many other chains there are', () => {
  const events = plan({ chains: [OPEN, TWO, PLAIN, OTHER, CLOSE] });
  assert.deepEqual(chainIdsOf(events), ['open', 'two', 'plain', 'close']);
  assert.deepEqual(events.slice(-2).map((event) => [event.kind, event.step]), [['tell', 'dusk'], ['check', 'look']]);
});

test('the closing chain is not one of the other chains, so it does not take their place', () => {
  assert.deepEqual(chainIdsOf(plan({ chains: [OPEN, CLOSE, TWO, PLAIN] })), ['open', 'two', 'plain', 'close']);
});

test('the closing chain is never silent, also when every chain is', () => {
  const quiet = ofChain(plan({ chains: [OPEN, TWO, PLAIN, CLOSE] }), 'close');
  const loud = ofChain(plan({ chains: [OPEN, TWO, PLAIN, CLOSE], rules: { ...SOMETIMES_SILENT, silentChance: 1 }, random: rand({ chance: (p) => p >= 1 }) }), 'close');
  assert.equal(quiet.length, 2);
  assert.deepEqual(loud, quiet);
});

test('a session of the real chains holds exactly one check, whatever the luck', () => {
  for (const random of [rand(), luck(), luck({ pick: lastOf, shuffle: (list) => [...list].reverse() })]) {
    for (const onPerson of [[], ['keys']]) {
      const events = buildDay({ dayNumber: 2, chains: CHAINS, things: THINGS, onPerson, yesterday: [], random });
      assert.equal(events.filter((event) => event.kind === 'check').length, 1);
      // after the check only the evening's own finds, its last story screen and the let-go of what they leave in hand may follow
      const afterCheck = events.slice(events.findIndex((event) => event.kind === 'check') + 1);
      assert.ok(afterCheck.every((event) => event.chain === 'evening' && ['find', 'tell', 'letGo'].includes(event.kind)));
    }
  }
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

// ---- openers take turns ----

const ALT = { id: 'alt', opener: true, steps: [move('in', 'kitchen'), tell('t')] };

test('the opener of yesterday is not picked again when another opener can open', () => {
  const events = buildDay({ dayNumber: 2, chains: [OPEN, ALT, PLAIN], things: THINGS, onPerson: [], yesterday: ['open'], random: rand() });
  assert.equal(chainIdsOf(events)[0], 'alt');
});

test('the opener of yesterday is picked when it is the only one that can open', () => {
  const events = buildDay({ dayNumber: 2, chains: [OPEN, PLAIN], things: THINGS, onPerson: [], yesterday: ['open'], random: rand() });
  assert.equal(chainIdsOf(events)[0], 'open');
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

// ---- the time of day (story 3e, U2) ----

const timed = (chain, time) => ({ ...chain, time });
const M_OPEN = timed({ ...OPEN, id: 'm-open' }, 'morning');
const D_OPEN = timed({ ...OPEN, id: 'd-open' }, 'day');
const E_OPEN = timed({ ...OPEN, id: 'e-open' }, 'evening');
const DAY_A = timed({ ...PLAIN, id: 'day-a' }, 'day');
const EVENING_A = timed({ ...PLAIN, id: 'evening-a' }, 'evening');
const MORNING_A = timed({ ...PLAIN, id: 'morning-a' }, 'morning');
const byTime = (chains) => plan({ chains, rules: DEFAULT_RULES });

test('a morning opener can be followed by a day chain and an evening chain, played in that order although the evening chain was picked first', () => {
  assert.deepEqual(chainIdsOf(byTime([M_OPEN, EVENING_A, DAY_A])), ['m-open', 'day-a', 'evening-a']);
});

test('after a day opener the day chain comes before the evening chain, however they were picked', () => {
  assert.deepEqual(chainIdsOf(byTime([D_OPEN, EVENING_A, DAY_A])), ['d-open', 'day-a', 'evening-a']);
});

test('a day opener is never followed by a morning chain', () => {
  assert.deepEqual(chainIdsOf(byTime([D_OPEN, MORNING_A, DAY_A, EVENING_A])), ['d-open', 'day-a', 'evening-a']);
});

test('with too few chains of a later time the session has fewer stories rather than going back in time', () => {
  assert.deepEqual(chainIdsOf(byTime([E_OPEN, DAY_A, MORNING_A, EVENING_A])), ['e-open', 'evening-a']);
  assert.deepEqual(chainIdsOf(byTime([E_OPEN, DAY_A, MORNING_A])), ['e-open']);
});

test('the closing chain stays last, also when it is an evening chain like the others', () => {
  assert.deepEqual(chainIdsOf(byTime([D_OPEN, EVENING_A, DAY_A, timed(CLOSE, 'evening')])), ['d-open', 'day-a', 'evening-a', 'close']);
});

test('the real chains in a real session follow the time of day, with pizza (evening) last of the stories even when luck puts it first', () => {
  const pizzaFirst = rand({ shuffle: (list) => [...list].sort((a, b) => Number(b.id === 'pizza') - Number(a.id === 'pizza')) });
  const ids = chainIdsOf(buildDay({ dayNumber: 2, chains: CHAINS, things: THINGS, onPerson: ['keys'], yesterday: [], random: pizzaFirst }));
  assert.deepEqual(ids, ['come-home', 'coffee', 'pizza', 'evening']);
});

test('the first session still opens with come-home, whatever the luck', () => {
  const ids = chainIdsOf(buildDay({ dayNumber: 1, chains: CHAINS, things: THINGS, onPerson: ['keys'], yesterday: [], random: lastPick() }));
  assert.equal(ids[0], 'come-home');
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

test('the opener of the very first day can be guided by a rule, even with luck', () => {
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
const coffeeEvents = (things) => ofChain(buildDay({ dayNumber: 2, chains: [OPEN, coffee(), PLAIN], things, onPerson: [], yesterday: [], random: rand(), rules: SOMETIMES_SILENT }), 'coffee');
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

test('a tell tied to a room carries it, a tell without one and a check carry none', () => {
  const tied = { id: 'tied', steps: [goTo('g', 'kitchen'), { id: 't1', kind: 'tell', at: 'kitchen' }, tell('t2'), check('c')] };
  const events = ofChain(plan({ chains: [OPEN, tied, PLAIN] }), 'tied');
  assert.deepEqual(events.filter((event) => ['tell', 'check'].includes(event.kind)).map((event) => [event.step, event.roomId]),
    [['t1', 'kitchen'], ['t2', null], ['c', null]]);
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

test('a silent thing is laid down after the walk out of the room, and not named again afterwards', () => {
  const events = plan({ chains: [OPEN, WALKING, PLAIN], random: luck() });
  assert.deepEqual(sequence(events, 'walking'), ['moveTo', 'find', 'goTo', 'letGo:keys', 'goTo', 'tell', 'check']);
});

const HOME = { id: 'home', steps: [tell('t0'), take('k', 'keys', hall), move('m', 'hall'), putBack('kb', 'keys'), tell('t')] };

test('a story move takes the player along with what they hold: the let-go comes after the tell, not before the move', () => {
  const events = plan({ chains: [OPEN, HOME, PLAIN], random: luck() });
  assert.deepEqual(sequence(events, 'home'), ['tell', 'find', 'moveTo', 'tell', 'letGo:keys']);
});

test('a guided chain keeps the phone in hand over the move: the call chain keeps the phone in the garden', () => {
  const events = plan({ chains: [OPEN, CALL, PLAIN] });
  assert.deepEqual(sequence(events, 'call'), ['moveTo', 'tell', 'find', 'moveTo', 'putAway', 'goTo', 'check']);
});

test('the same call chain with a silent phone keeps it in hand in the garden and lays it down after the walk inside', () => {
  const events = plan({ chains: [OPEN, CALL, PLAIN], random: luck() });
  assert.deepEqual(sequence(events, 'call'), ['moveTo', 'tell', 'find', 'moveTo', 'goTo', 'letGo:phone', 'check']);
});

// every chain of the game, alone in a day, with the default rules: every put-back is silent
const SCREENS = ['tell', 'goTo', 'check'];
function eventsOfRealChain(chain) {
  const chains = chain.opener === true ? [chain] : [OPEN, chain];
  return ofChain(buildDay({ dayNumber: 2, chains, things: THINGS, onPerson: ['keys'], yesterday: [], random: rand() }), chain.id);
}

for (const chain of CHAINS.filter((candidate) => candidate.closer !== true)) {
  test(`in ${chain.id} the player gets a screen holding each thing, where the story stands, before it is let go`, () => {
    const events = eventsOfRealChain(chain);
    events.forEach((event, at) => {
      if (event.kind !== 'letGo') return;
      for (const thingId of event.thingIds) {
        const found = events.findLastIndex((other, index) => index < at && other.kind === 'find' && other.thingId === thingId);
        const moved = events.findLastIndex((other, index) => index < at && other.kind === 'moveTo');
        const since = Math.max(found, moved);
        const screens = events.slice(since + 1, at).filter((other) => SCREENS.includes(other.kind));
        assert.ok(found >= 0 && screens.length > 0, `${chain.id}: ${thingId} is let go without a screen in the room where the story stands`);
      }
    });
  });
}

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

test('the default rules are two other chains, silence about every put-back and no guidance, not even in the first session', () => {
  assert.deepEqual(DEFAULT_RULES, { otherChains: 2, silentChance: 1, silentPerChain: Infinity, guideFirstOpener: false });
});

test('without rules given, the default rules are used', () => {
  const day = { dayNumber: 2, chains: [OPEN, TWO, PLAIN], things: THINGS, onPerson: [], yesterday: [], random: rand() };
  const given = buildDay({ ...day, rules: DEFAULT_RULES });
  assert.deepEqual(chainIdsOf(given), ['open', 'two', 'plain']);
  assert.deepEqual(buildDay(day), given);
});

test('one other chain gives an opener and one chain', () => {
  const events = plan({ chains: [OPEN, TWO, PLAIN, OTHER], rules: { ...SOMETIMES_SILENT, otherChains: 1 } });
  assert.deepEqual(chainIdsOf(events), ['open', 'two']);
});

test('three other chains give an opener and three chains', () => {
  const events = plan({ chains: [OPEN, TWO, PLAIN, OTHER, WALKING], rules: { ...SOMETIMES_SILENT, otherChains: 3 } });
  assert.deepEqual(chainIdsOf(events), ['open', 'two', 'plain', 'other']);
});

test('a silent chance of zero gives no silent chain, and the chance asked is the one of the rules', () => {
  const asked = [];
  const events = plan({ rules: { ...SOMETIMES_SILENT, silentChance: 0 }, random: rand({ chance: (p) => { asked.push(p); return p > 0; } }) });
  assert.deepEqual(putAwaysOf(events, 'two'), ['keys', 'scissors']);
  assert.deepEqual(asked, [0]);
});

test('a silent chance of one makes every chain with a chosen put-back silent, except the opener of the first day when a rule guides it', () => {
  const chance = (p) => p >= 1;
  const rules = { ...SOMETIMES_SILENT, silentChance: 1 };
  const events = plan({ dayNumber: 1, chains: [NEEDS_KEYS, TWO, PLAIN], onPerson: ['keys'], rules, random: rand({ chance }) });
  assert.deepEqual(putAwaysOf(events, 'needs-keys'), ['keys']);
  assert.deepEqual(putAwaysOf(events, 'two'), ['scissors']);
});

test('two silent put-backs leave out two put-backs in a chain with two chosen things', () => {
  const events = presentDay(chosen('scissors', 'phone'), { ...SOMETIMES_SILENT, silentPerChain: 2 });
  assert.deepEqual(putAwaysOf(events, 'present'), []);
  assert.deepEqual(letGosOf(events).flatMap((event) => event.thingIds).sort(), ['phone', 'scissors']);
});

test('two silent put-backs leave out only one in a chain that has one chosen thing', () => {
  const events = presentDay(chosen('scissors'), { ...SOMETIMES_SILENT, silentPerChain: 2 });
  assert.equal(events.some((event) => event.kind === 'putAway' && event.chain === 'present'), false);
  assert.equal(ofChain(events, 'present').filter((event) => event.kind === 'find').length, 1);
});

test('one silent put-back leaves out one of two', () => {
  assert.equal(putAwaysOf(presentDay(chosen('scissors', 'phone'), SOMETIMES_SILENT), 'present').length, 1);
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

// ---- the app never tells the player to put a thing back ----

const putAwaysIn = (events) => events.filter((event) => event.kind === 'putAway');
const realDay = (dayNumber, random) => buildDay({ dayNumber, chains: CHAINS, things: THINGS, onPerson: ['keys'], yesterday: [], random });

test('by default the app never tells the player to put a thing back: no put-away on any day, with any luck', () => {
  for (const dayNumber of [1, 2, 7]) {
    for (const random of [rand(), luck()]) assert.deepEqual(putAwaysIn(realDay(dayNumber, random)), [], `day ${dayNumber}`);
  }
});

test('with the default rules the chance of silence is not even asked: it is one, whatever the luck', () => {
  const asked = [];
  realDay(2, rand({ chance: (p) => { asked.push(p); return false; } }));
  assert.deepEqual(asked, []);
});

test('with the default rules every thing that is taken is laid down by a let-go, so that nothing is put back for the player', () => {
  const events = realDay(1, rand());
  const taken = events.filter((event) => event.kind === 'find').map((event) => event.thingId);
  const laidDown = events.filter((event) => event.kind === 'letGo').flatMap((event) => event.thingIds);
  assert.ok(taken.length > 0);
  for (const thingId of taken) assert.ok(laidDown.includes(thingId), thingId);
});

// ---- the evening asks again for what the session used (user finding 2026-11-23) ----

const SCISSORS_FIRST = { id: 'scissors-first', steps: [move('m', 'kitchen'), take('s', 'scissors'), take('k', 'keys', hall), putBack('sb', 'scissors'), putBack('kb', 'keys')] };
const eveningOf = (events) => events.filter((event) => event.chain === 'evening');
const needs = (events) => eveningOf(events).filter((event) => event.step === 'need');
const nightSpotOf = (id) => THINGS.find((thing) => thing.id === id)?.nightSpot;
const session = (chains, rules = SOMETIMES_SILENT) => buildDay({ dayNumber: 2, chains: [OPEN, ...chains, evening], things: THINGS, onPerson: [], yesterday: [], random: rand(), rules });

test('the evening asks again for every thing found earlier in the session, after the check, in the order first found', () => {
  const events = eveningOf(session([SCISSORS_FIRST, TWO])).filter((event) => event.kind !== 'letGo');
  assert.deepEqual(events.map((event) => event.step), ['dusk', 'look', 'need', 'need', 'bed']);
  assert.deepEqual(events.slice(2, 4).map((event) => [event.kind, event.thingId]), [['find', 'scissors'], ['find', 'keys']]);
});

test('a thing that was not used during the session is not asked for in the evening', () => {
  const asked = needs(session([TWO])).map((event) => event.thingId);
  assert.deepEqual(asked, ['keys', 'scissors']);
  assert.equal(asked.includes('wallet') || asked.includes('phone'), false);
});

test('a thing that was found twice in the session is asked for once in the evening', () => {
  assert.deepEqual(needs(session([TWO, SCISSORS_FIRST])).map((event) => event.thingId), ['keys', 'scissors']);
});

test('a thing put back during the session is asked for in the evening all the same', () => {
  const events = session([TWO], { ...DEFAULT_RULES, silentChance: 0 });
  assert.ok(events.some((event) => event.kind === 'putAway' && event.thingId === 'keys'), 'the keys are put back in this session');
  assert.deepEqual(needs(events).map((event) => event.thingId), ['keys', 'scissors']);
});

test('a thing asked for in the evening and not put back is laid on its night spot at the end of the session', () => {
  const events = session([TWO]);
  assert.deepEqual(lastOf(events), { kind: 'letGo', chain: 'evening', thingIds: ['keys', 'scissors'] });
  for (const event of needs(events)) assert.deepEqual(event.leftAt, nightSpotOf(event.thingId), event.thingId);
});

test('after the evening finds the player gets one more story screen before things are laid down, so a found thing can still be put away', () => {
  const events = eveningOf(session([TWO]));
  const afterNeeds = events.slice(events.findLastIndex((event) => event.step === 'need') + 1);
  assert.deepEqual(afterNeeds.map((event) => [event.kind, event.step ?? null]), [['tell', 'bed'], ['letGo', null]]);
});

test('a session in which nothing was found asks for nothing in the evening', () => {
  const events = session([PLAIN]);
  assert.deepEqual(eveningOf(events).map((event) => event.kind), ['tell', 'check', 'tell']);
});
