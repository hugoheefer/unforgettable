import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAINS, STEP_KINDS } from '../app/js/chains.js';
import { LAYOUT } from '../app/js/layout.js';
import { THINGS } from '../app/js/things.js';
import { World } from '../app/js/world.js';
import { LANGUAGES } from '../app/js/texts.js';
import { problemsOf } from './chain-contract.mjs';

const world = new World(LAYOUT);
const rooms = new Set(LAYOUT.places.map((place) => place.id));
const catalogueIds = new Set(THINGS.map((thing) => thing.id));
const hasLocation = (location) => world.hasLocation(location);
const counter = { placeId: 'kitchen', spotId: 'counter' };

/** The facts of the eight chains, as the story writes them: id:kind:data@room of every step (`at` is the room a step is tied to). */
const STORY = {
  'come-home': ['door:move:garden', 'keys:take:keys', 'inside:move:hall', 'keys-back:putBack:keys', 'shoes:tell@hall'],
  'go-out': ['start:move:hall', 'keys:take:keys', 'wallet:take:wallet', 'away:tell', 'pay:tell', 'back:tell', 'inside:move:hall', 'bag:tell@hall', 'keys-back:putBack:keys', 'wallet-back:putBack:wallet', 'unpack:goTo:kitchen', 'done:tell@kitchen'],
  morning: ['wake:move:bedroom', 'phone:take:phone', 'read:tell@bedroom', 'phone-back:putBack:phone', 'dress:tell@bedroom', 'breakfast:goTo:kitchen', 'eat:tell@kitchen'],
  coffee: ['go:goTo:kitchen', 'pack:take:coffee-pack@kitchen', 'scissors:take:scissors', 'open:tell@kitchen', 'scissors-back:putBack:scissors', 'tin:take:coffee-tin@kitchen', 'fill:tell@kitchen', 'tin-back:putBack:coffee-tin@kitchen', 'sit:goTo:living', 'drink:tell@living'],
  present: ['go:goTo:dining', 'paper:take:wrapping-paper@dining', 'scissors:take:scissors', 'wrap:tell@dining', 'scissors-back:putBack:scissors', 'phone:take:phone', 'call:tell', 'phone-back:putBack:phone', 'paper-back:putBack:wrapping-paper@dining', 'hall:goTo:hall', 'ready:tell@hall'],
  pizza: ['hungry:goTo:living', 'phone:take:phone', 'ordered:tell@living', 'phone-back:putBack:phone', 'bell:tell', 'go:goTo:hall', 'wallet:take:wallet', 'pay:tell@hall', 'wallet-back:putBack:wallet', 'table:goTo:dining', 'eat:tell@dining'],
  call: ['phone:take:phone', 'walk:move:garden', 'phone-back:putBack:phone', 'in:goTo:living', 'sit:tell@living'],
  evening: ['dusk:tell', 'look:check'],
};

const signature = (step) => `${[step.id, step.kind, step.roomId ?? step.object].filter((part) => part !== undefined).join(':')}${step.at === undefined ? '' : `@${step.at}`}`;
const chainNamed = (id) => CHAINS.find((chain) => chain.id === id);
const contextFor = (sentences) => ({ rooms, catalogueIds, hasLocation, kinds: STEP_KINDS, sentences });

// ---- the list of chains ----

test('the list holds the eight chains of the story, in that order', () => {
  assert.deepEqual(CHAINS.map((chain) => chain.id), Object.keys(STORY));
});

test('every chain id is different', () => {
  assert.equal(new Set(CHAINS.map((chain) => chain.id)).size, CHAINS.length);
});

test('three chains open a day: come-home needs the keys on the person, go-out and morning need nothing', () => {
  const openers = CHAINS.filter((chain) => chain.opener === true);
  assert.deepEqual(openers.map((chain) => [chain.id, chain.needsOnPerson ?? []]), [['come-home', ['keys']], ['go-out', []], ['morning', []]]);
});

test('morning starts a session at home: it opens with a move to the bedroom', () => {
  assert.equal(chainNamed('morning')?.steps[0].kind, 'move');
  assert.equal(chainNamed('morning')?.steps[0].roomId, 'bedroom');
});

test('going out takes the keys and then the wallet: nobody goes shopping without one', () => {
  const taken = chainNamed('go-out')?.steps.filter((step) => step.kind === 'take').map((step) => step.object);
  assert.deepEqual(taken, ['keys', 'wallet']);
});

test('the pizza is ordered with the phone before the wallet is needed at the door', () => {
  const taken = chainNamed('pizza')?.steps.filter((step) => step.kind === 'take').map((step) => step.object);
  assert.deepEqual(taken, ['phone', 'wallet']);
});

test('exactly one chain closes a session: evening', () => {
  assert.deepEqual(CHAINS.filter((chain) => chain.closer === true).map((chain) => chain.id), ['evening']);
});

test('the check is asked once, in the closing chain, and nowhere else', () => {
  const checks = CHAINS.flatMap((chain) => chain.steps.filter((step) => step.kind === 'check').map(() => chain.id));
  assert.deepEqual(checks, ['evening']);
});

test('no chain after the opener starts with a move: pizza starts with a walk-to and call with the search for the phone', () => {
  assert.deepEqual(CHAINS.filter((chain) => chain.opener !== true && chain.steps[0].kind === 'move'), []);
  assert.equal(chainNamed('pizza')?.steps[0].kind, 'goTo');
  assert.equal(chainNamed('call')?.steps[0].kind, 'take');
});

// ---- one screen for one intention (story 3e, U6) ----

test('the steps that only announced the next step are gone: call.ring and go-out.plan', () => {
  assert.equal(chainNamed('call')?.steps.some((step) => step.id === 'ring'), false);
  assert.equal(chainNamed('go-out')?.steps.some((step) => step.id === 'plan'), false);
});

// ---- a step that uses a thing (story 3e, U1) ----

/** chain:step -> the thing the step uses, as the story's table has it. */
const USES = {
  'go-out:away': 'keys', 'go-out:pay': 'wallet', 'coffee:open': 'scissors', 'present:wrap': 'scissors',
  'present:call': 'phone', 'pizza:ordered': 'phone', 'pizza:pay': 'wallet', 'morning:read': 'phone',
};

test('exactly the steps of the story say which thing they use', () => {
  const found = Object.fromEntries(CHAINS.flatMap((chain) => chain.steps.filter((step) => step.uses !== undefined).map((step) => [`${chain.id}:${step.id}`, step.uses])));
  assert.deepEqual(found, USES);
});

test('only a tell uses a thing', () => {
  assert.deepEqual(CHAINS.flatMap((chain) => chain.steps.filter((step) => step.uses !== undefined && step.kind !== 'tell')), []);
});

test('a tell that uses a thing becomes a tell event that carries it; a tell without carries nothing', () => {
  assert.deepEqual(expand({ id: 'a', kind: 'tell', at: 'kitchen', uses: 'scissors' }), [{ kind: 'tell', chain: 'x', step: 'a', roomId: 'kitchen', uses: 'scissors' }]);
  assert.equal('uses' in expand({ id: 'a', kind: 'tell' })[0], false);
});

// ---- the time of day (story 3e, U2) ----

const TIMES = { morning: 'morning', 'go-out': 'day', 'come-home': 'day', coffee: 'day', present: 'day', call: 'day', pizza: 'evening', evening: 'evening' };

test('every chain has the time of day of the story', () => {
  assert.deepEqual(Object.fromEntries(CHAINS.map((chain) => [chain.id, chain.time])), TIMES);
});

test('the closing chain is played in the evening', () => {
  assert.equal(chainNamed(CHAINS.find((chain) => chain.closer === true)?.id)?.time, 'evening');
});

test('at least one opener needs nothing, so a day can always begin', () => {
  assert.ok(CHAINS.some((chain) => chain.opener === true && (chain.needsOnPerson ?? []).length === 0));
});

for (const [id, signatures] of Object.entries(STORY)) {
  test(`the chain ${id} has the steps of the story`, () => {
    assert.deepEqual(chainNamed(id)?.steps.map(signature), signatures);
  });

  test(`the chain ${id} keeps the contract in every language`, () => {
    assert.ok(chainNamed(id), `${id} is in the list`);
    for (const language of LANGUAGES) {
      assert.deepEqual(problemsOf(chainNamed(id), contextFor(language.texts.chains)), [], language.code);
    }
  });
}

test('every chain in the list keeps the contract in every language, also one that is added later', () => {
  assert.ok(CHAINS.length > 0);
  for (const chain of CHAINS) {
    for (const language of LANGUAGES) assert.deepEqual(problemsOf(chain, contextFor(language.texts.chains)), [], `${chain.id} ${language.code}`);
  }
});

test('where the scissors stay in the coffee chain is the worktop', () => {
  assert.deepEqual(chainNamed('coffee')?.steps.find((step) => step.id === 'scissors').leftAt, counter);
});

test('a prop that could become a thing already says where it stays, so the chain does not change then', () => {
  assert.deepEqual(chainNamed('coffee')?.steps.find((step) => step.id === 'tin').leftAt, counter);
  assert.deepEqual(chainNamed('present')?.steps.find((step) => step.id === 'paper').leftAt, { placeId: 'dining', spotId: 'sideboard' });
});

// ---- the table of step kinds ----

test('the table of step kinds has exactly the six kinds of the story', () => {
  assert.deepEqual(Object.keys(STEP_KINDS).sort(), ['check', 'goTo', 'move', 'putBack', 'take', 'tell']);
});

test('every step kind can say whether its fields are right, whether it needs a sentence, and how it becomes events', () => {
  for (const [kind, row] of Object.entries(STEP_KINDS)) {
    assert.equal(typeof row.isValid, 'function', kind);
    assert.equal(typeof row.needsSentence, 'function', kind);
    assert.equal(typeof row.expand, 'function', kind);
  }
});

test('only a walk-to is a moment where the player walks out of a room: a move takes them along with what they hold', () => {
  assert.deepEqual(Object.entries(STEP_KINDS).filter(([, row]) => row.walksAway === true).map(([kind]) => kind), ['goTo']);
});

const context = { rooms, catalogueIds, hasLocation };

test('a tell and a check need nothing but their id', () => {
  assert.equal(STEP_KINDS.tell.isValid({ id: 'a', kind: 'tell' }, context), true);
  assert.equal(STEP_KINDS.check.isValid({ id: 'a', kind: 'check' }, context), true);
});

test('a move and a walk-to need a room that exists', () => {
  for (const kind of ['move', 'goTo']) {
    assert.equal(STEP_KINDS[kind].isValid({ id: 'a', kind, roomId: 'kitchen' }, context), true, kind);
    assert.equal(STEP_KINDS[kind].isValid({ id: 'a', kind, roomId: 'moon' }, context), false, kind);
    assert.equal(STEP_KINDS[kind].isValid({ id: 'a', kind }, context), false, kind);
  }
});

test('a take of a thing of the catalogue needs a left-at spot that exists', () => {
  const take = { id: 'a', kind: 'take', object: 'scissors' };
  assert.equal(STEP_KINDS.take.isValid({ ...take, leftAt: counter }, context), true);
  assert.equal(STEP_KINDS.take.isValid(take, context), false);
  assert.equal(STEP_KINDS.take.isValid({ ...take, leftAt: { placeId: 'moon', spotId: 'rock' } }, context), false);
});

test('a take of a prop needs no left-at spot, but if it has one it must exist', () => {
  const take = { id: 'a', kind: 'take', object: 'coffee-pack' };
  assert.equal(STEP_KINDS.take.isValid(take, context), true);
  assert.equal(STEP_KINDS.take.isValid({ ...take, leftAt: counter }, context), true);
  assert.equal(STEP_KINDS.take.isValid({ ...take, leftAt: { placeId: 'moon', spotId: 'rock' } }, context), false);
});

test('a take and a put-back need an object', () => {
  assert.equal(STEP_KINDS.take.isValid({ id: 'a', kind: 'take', leftAt: counter }, context), false);
  assert.equal(STEP_KINDS.putBack.isValid({ id: 'a', kind: 'putBack', object: 'scissors' }, context), true);
  assert.equal(STEP_KINDS.putBack.isValid({ id: 'a', kind: 'putBack' }, context), false);
});

test('every kind needs a sentence, except the put-back of a thing of the catalogue', () => {
  const needs = (step) => STEP_KINDS[step.kind].needsSentence(step, context);
  for (const kind of ['tell', 'check']) assert.equal(needs({ id: 'a', kind }), true, kind);
  for (const kind of ['move', 'goTo']) assert.equal(needs({ id: 'a', kind, roomId: 'hall' }), true, kind);
  assert.equal(needs({ id: 'a', kind: 'take', object: 'scissors', leftAt: counter }), true);
  assert.equal(needs({ id: 'a', kind: 'take', object: 'coffee-pack' }), true);
  assert.equal(needs({ id: 'a', kind: 'putBack', object: 'coffee-tin' }), true);
  assert.equal(needs({ id: 'a', kind: 'putBack', object: 'scissors' }), false);
});

// ---- how a step becomes events ----

const ctx = (chosen = []) => ({ chainId: 'x', chosen: new Set(chosen) });
const expand = (step, chosen) => STEP_KINDS[step.kind].expand(step, ctx(chosen));

test('a tell with a room becomes a tell event tied to that room', () => {
  assert.deepEqual(expand({ id: 'a', kind: 'tell', at: 'kitchen' }), [{ kind: 'tell', chain: 'x', step: 'a', roomId: 'kitchen' }]);
});

test('a tell without a room becomes a tell event that happens wherever the player is', () => {
  assert.deepEqual(expand({ id: 'a', kind: 'tell' }), [{ kind: 'tell', chain: 'x', step: 'a', roomId: null }]);
});

test('a move becomes a move event to its room', () => {
  assert.deepEqual(expand({ id: 'a', kind: 'move', roomId: 'garden' }), [{ kind: 'moveTo', chain: 'x', step: 'a', roomId: 'garden' }]);
});

test('a walk-to becomes a walk-to event to its room', () => {
  assert.deepEqual(expand({ id: 'a', kind: 'goTo', roomId: 'living' }), [{ kind: 'goTo', chain: 'x', step: 'a', roomId: 'living' }]);
});

test('a check becomes a check event without a room: it is a thought', () => {
  assert.deepEqual(expand({ id: 'a', kind: 'check' }), [{ kind: 'check', chain: 'x', step: 'a', roomId: null }]);
});

test('the take of a chosen thing becomes a find that knows where the thing stays', () => {
  assert.deepEqual(expand({ id: 'a', kind: 'take', object: 'scissors', leftAt: counter }, ['scissors']), [{ kind: 'find', chain: 'x', step: 'a', thingId: 'scissors', leftAt: counter }]);
});

test('the take of a prop becomes a tell tied to its room', () => {
  assert.deepEqual(expand({ id: 'a', kind: 'take', object: 'coffee-pack', at: 'kitchen' }, ['scissors']), [{ kind: 'tell', chain: 'x', step: 'a', roomId: 'kitchen' }]);
});

test('the take of a thing that is in the catalogue but not chosen is a tell as well', () => {
  assert.deepEqual(expand({ id: 'a', kind: 'take', object: 'scissors', leftAt: counter }, ['keys']), [{ kind: 'tell', chain: 'x', step: 'a', roomId: null }]);
});

test('the put-back of a chosen thing becomes a put-away', () => {
  assert.deepEqual(expand({ id: 'a', kind: 'putBack', object: 'scissors' }, ['scissors']), [{ kind: 'putAway', chain: 'x', step: 'a', thingId: 'scissors' }]);
});

test('the put-back of a prop becomes a tell tied to its room', () => {
  assert.deepEqual(expand({ id: 'a', kind: 'putBack', object: 'coffee-tin', at: 'kitchen' }, ['scissors']), [{ kind: 'tell', chain: 'x', step: 'a', roomId: 'kitchen' }]);
});

test('a tell, a take and a put-back may name a room with `at`, and it must exist', () => {
  for (const step of [{ id: 'a', kind: 'tell' }, { id: 'a', kind: 'take', object: 'coffee-pack' }, { id: 'a', kind: 'putBack', object: 'coffee-pack' }]) {
    assert.equal(STEP_KINDS[step.kind].isValid({ ...step, at: 'kitchen' }, context), true, step.kind);
    assert.equal(STEP_KINDS[step.kind].isValid({ ...step, at: 'moon' }, context), false, step.kind);
  }
});

// ---- the contract notices what is wrong ----

const TEXTS_OF = { good: { a: 'Go.', b: 'Cut.', c: 'Done?' } };
const GOOD = { id: 'good', time: 'day', steps: [{ id: 'a', kind: 'goTo', roomId: 'kitchen' }, { id: 'b', kind: 'take', object: 'scissors', leftAt: counter }, { id: 'c', kind: 'tell' }] };
const problems = (chain, sentences = TEXTS_OF) => problemsOf(chain, contextFor(sentences));
const withSteps = (steps) => ({ ...GOOD, steps });

test('a good chain has no problems', () => {
  assert.deepEqual(problems(GOOD), []);
});

test('a step of an unknown kind is a problem', () => {
  assert.deepEqual(problems(withSteps([...GOOD.steps, { id: 'd', kind: 'dance' }])), ['d: unknown kind dance']);
});

test('a step with wrong fields is a problem', () => {
  assert.deepEqual(problems(withSteps([{ id: 'a', kind: 'goTo', roomId: 'moon' }, GOOD.steps[2]]), { good: { a: 'x', c: 'z' } }), ['a: the fields of a goTo are wrong']);
});

test('a step that needs a sentence and has none is a problem', () => {
  assert.deepEqual(problems(GOOD, { good: { a: 'Go.', c: 'Done?' } }), ['b: no sentence']);
});

test('a sentence without a step is a problem', () => {
  assert.deepEqual(problems(GOOD, { good: { ...TEXTS_OF.good, z: 'Lost.' } }), ['z: a sentence without a step']);
});

test('a put-back before the take of the same object is a problem', () => {
  const chain = withSteps([GOOD.steps[0], { id: 'b', kind: 'putBack', object: 'coffee-tin' }, GOOD.steps[2]]);
  assert.deepEqual(problems(chain, { good: { a: 'x', b: 'y', c: 'z' } }), ['b: coffee-tin is put back before it is taken']);
});

test('two steps with the same id are a problem', () => {
  const chain = withSteps([GOOD.steps[0], { id: 'a', kind: 'tell' }]);
  assert.deepEqual(problems(chain, { good: { a: 'x' } }), ['two steps have the same id']);
});

test('a chain after the opener that starts with a move is a problem', () => {
  const chain = withSteps([{ id: 'a', kind: 'move', roomId: 'kitchen' }, GOOD.steps[2]]);
  assert.deepEqual(problems(chain, { good: { a: 'Go.', c: 'Done?' } }), ['the chain starts with a move, but only an opener may']);
});

test('an opener may start with a move', () => {
  const chain = { ...withSteps([{ id: 'a', kind: 'move', roomId: 'kitchen' }, GOOD.steps[2]]), opener: true };
  assert.deepEqual(problems(chain, { good: { a: 'Go.', c: 'Done?' } }), []);
});

test('a step tied to a room that does not exist is a problem', () => {
  const chain = withSteps([GOOD.steps[0], { id: 'c', kind: 'tell', at: 'moon' }]);
  assert.deepEqual(problems(chain, { good: { a: 'Go.', c: 'Done?' } }), ['c: the fields of a tell are wrong']);
});

test('a check outside the closing chain is a problem', () => {
  const chain = withSteps([GOOD.steps[0], { id: 'c', kind: 'check' }]);
  assert.deepEqual(problems(chain, { good: { a: 'Go.', c: 'Done?' } }), ['c: a check belongs to the closing chain only']);
});

test('a closing chain may hold a check', () => {
  const chain = { id: 'good', closer: true, time: 'evening', steps: [{ id: 'a', kind: 'tell' }, { id: 'c', kind: 'check' }] };
  assert.deepEqual(problems(chain, { good: { a: 'Dusk.', c: 'Done?' } }), []);
});

test('a closing chain that takes or puts back something is a problem', () => {
  const chain = { id: 'good', closer: true, time: 'evening', steps: [{ id: 'a', kind: 'tell' }, { id: 'b', kind: 'take', object: 'scissors', leftAt: counter }, { id: 'c', kind: 'putBack', object: 'scissors' }] };
  assert.deepEqual(problems(chain, { good: { a: 'x', b: 'y' } }), ['b: the closing chain takes and puts back nothing', 'c: the closing chain takes and puts back nothing']);
});

test('a chain without a time of day, or with one that does not exist, is a problem', () => {
  assert.deepEqual(problems({ ...GOOD, time: undefined }), ['the chain has no time of day']);
  assert.deepEqual(problems({ ...GOOD, time: 'noon' }), ['the chain has no time of day']);
});

test('a closing chain that is not played in the evening is a problem', () => {
  const chain = { id: 'good', closer: true, time: 'day', steps: [{ id: 'a', kind: 'tell' }, { id: 'c', kind: 'check' }] };
  assert.deepEqual(problems(chain, { good: { a: 'Dusk.', c: 'Done?' } }), ['the closing chain is played in the evening']);
});

test('a step that uses a thing the chain takes earlier is fine; one that uses something else is a problem', () => {
  const using = (uses) => withSteps([GOOD.steps[0], GOOD.steps[1], { id: 'c', kind: 'tell', uses }]);
  assert.deepEqual(problems(using('scissors')), []);
  assert.deepEqual(problems(using('keys')), ['c: uses keys, which the chain does not take earlier']);
});

test('a step that uses a thing before the chain takes it is a problem', () => {
  const chain = withSteps([GOOD.steps[0], { id: 'c', kind: 'tell', uses: 'scissors' }, { id: 'b', kind: 'take', object: 'scissors', leftAt: counter }]);
  assert.deepEqual(problems(chain, { good: { a: 'Go.', b: 'Cut.', c: 'Done?' } }), ['c: uses scissors, which the chain does not take earlier']);
});

test('an opener that needs a thing that does not exist is a problem', () => {
  assert.deepEqual(problems({ ...GOOD, opener: true, needsOnPerson: ['ghost'] }), ['ghost: needed on the person but not in the catalogue']);
});
