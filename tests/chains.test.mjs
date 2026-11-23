import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAINS, STEP_KINDS, hasStep } from '../app/js/chains.js';
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
  morning: ['wake:move:bedroom', 'first:choose[phone=phone:take:phone,read:tell@bedroom,phone-back:putBack:phone|up=up:tell@bedroom]', 'dress:tell@bedroom', 'breakfast:goTo:kitchen', 'eat:tell@kitchen'],
  coffee: ['go:goTo:kitchen', 'pack:take:coffee-pack@kitchen', 'open-how:choose@kitchen[cut=scissors:take:scissors,open:tell@kitchen,scissors-back:putBack:scissors|tear=tear:tell@kitchen]', 'tin:take:coffee-tin@kitchen', 'fill:tell@kitchen', 'tin-back:putBack:coffee-tin@kitchen', 'sit:goTo:living', 'drink:tell@living'],
  present: ['go:goTo:dining', 'paper:take:wrapping-paper@dining', 'wrap-how:choose@dining[cut=scissors:take:scissors,wrap:tell@dining,scissors-back:putBack:scissors|fold=tear:tell@dining]', 'party:choose[call=phone:take:phone,call:tell,phone-back:putBack:phone|card=invitation:tell@dining]', 'paper-back:putBack:wrapping-paper@dining', 'hall:goTo:hall', 'ready:tell@hall'],
  pizza: ['hungry:goTo:living', 'phone:take:phone', 'ordered:tell@living', 'phone-back:putBack:phone', 'bell:tell', 'go:goTo:hall', 'pay-how:choose@hall[cash=wallet:take:wallet,pay:tell@hall,wallet-back:putBack:wallet|phone=phone-pay:take:phone,pay-phone:tell@hall,phone-pay-back:putBack:phone]', 'table:goTo:dining', 'eat:tell@dining'],
  call: ['phone:take:phone', 'walk:move:garden', 'phone-back:putBack:phone', 'in:goTo:living', 'sit:tell@living'],
  evening: ['dusk:tell', 'look:check', 'need:needAgain', 'bed:tell'],
};

const signature = (step) => {
  const base = `${[step.id, step.kind, step.roomId ?? step.object].filter((part) => part !== undefined).join(':')}${step.at === undefined ? '' : `@${step.at}`}`;
  return step.kind === 'choose' ? `${base}[${step.options.map((option) => `${option.id}=${option.steps.map(signature).join(',')}`).join('|')}]` : base;
};
/** Every step of a chain, the steps inside the options of a choose included. */
const allSteps = (chain) => chain.steps.flatMap((step) => [step, ...(step.options ?? []).flatMap((option) => option.steps)]);
const chainNamed = (id) => CHAINS.find((chain) => chain.id === id);
const contextFor = (sentences, labels = {}) => ({ rooms, catalogueIds, hasLocation, kinds: STEP_KINDS, sentences, labels });

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

test('the pizza is ordered with the phone before the player chooses how to pay at the door', () => {
  const steps = chainNamed('pizza')?.steps ?? [];
  assert.equal(steps.find((step) => step.kind === 'take')?.object, 'phone');
  assert.ok(steps.findIndex((step) => step.kind === 'take') < steps.findIndex((step) => step.kind === 'choose'));
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
  'present:call': 'phone', 'pizza:ordered': 'phone', 'pizza:pay': 'wallet', 'pizza:pay-phone': 'phone', 'morning:read': 'phone',
};

test('exactly the steps of the story say which thing they use', () => {
  const found = Object.fromEntries(CHAINS.flatMap((chain) => allSteps(chain).filter((step) => step.uses !== undefined).map((step) => [`${chain.id}:${step.id}`, step.uses])));
  assert.deepEqual(found, USES);
});

test('only a tell uses a thing', () => {
  assert.deepEqual(CHAINS.flatMap((chain) => allSteps(chain).filter((step) => step.uses !== undefined && step.kind !== 'tell')), []);
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
      assert.deepEqual(problemsOf(chainNamed(id), contextFor(language.texts.chains, language.texts.options)), [], language.code);
    }
  });
}

test('every chain in the list keeps the contract in every language, also one that is added later', () => {
  assert.ok(CHAINS.length > 0);
  for (const chain of CHAINS) {
    for (const language of LANGUAGES) assert.deepEqual(problemsOf(chain, contextFor(language.texts.chains, language.texts.options)), [], `${chain.id} ${language.code}`);
  }
});

test('where the scissors stay in the coffee chain is the worktop', () => {
  assert.deepEqual(allSteps(chainNamed('coffee')).find((step) => step.id === 'scissors').leftAt, counter);
});

test('a prop that could become a thing already says where it stays, so the chain does not change then', () => {
  assert.deepEqual(chainNamed('coffee')?.steps.find((step) => step.id === 'tin').leftAt, counter);
  assert.deepEqual(chainNamed('present')?.steps.find((step) => step.id === 'paper').leftAt, { placeId: 'dining', spotId: 'sideboard' });
});

// ---- the table of step kinds ----

test('the table of step kinds has exactly the eight kinds of the story', () => {
  assert.deepEqual(Object.keys(STEP_KINDS).sort(), ['check', 'choose', 'goTo', 'move', 'needAgain', 'putBack', 'take', 'tell']);
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
const problems = (chain, sentences = TEXTS_OF, labels = {}) => problemsOf(chain, contextFor(sentences, labels));
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

test('a closing chain may ask again for what the session used, and no other chain may', () => {
  const needing = (closer) => ({ id: 'good', closer, time: 'evening', steps: [{ id: 'a', kind: 'tell' }, { id: 'n', kind: 'needAgain' }] });
  assert.deepEqual(problems(needing(true), { good: { a: 'Dusk.' } }), []);
  assert.deepEqual(problems(needing(false), { good: { a: 'Dusk.' } }), ['n: needAgain belongs to the closing chain only']);
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

// ---- a choice: the player picks one of two or three real actions (story 3f) ----

const tearStep = { id: 'ripped', kind: 'tell' };
const cutOption = { id: 'cut', steps: [{ id: 'sc', kind: 'take', object: 'scissors', leftAt: counter }, { id: 'cutit', kind: 'tell', uses: 'scissors' }, { id: 'sc-back', kind: 'putBack', object: 'scissors' }] };
const tearOption = { id: 'tear', steps: [tearStep] };
const howStep = (overrides = {}) => ({ id: 'how', kind: 'choose', at: 'kitchen', options: [cutOption, tearOption], ...overrides });
const choosing = (overrides = {}) => ({ id: 'good', time: 'day', steps: [{ id: 'a', kind: 'goTo', roomId: 'kitchen' }, howStep(overrides), { id: 'c', kind: 'tell' }] });
const CHOOSING_TEXTS = { good: { a: 'Go.', how: 'How?', sc: 'You want a clean cut.', cutit: 'Cut.', ripped: 'Rip.', c: 'Done?' } };
const LABELS = { good: { how: { cut: 'Cut it', tear: 'Tear it' } } };
const withoutKey = (table, key) => Object.fromEntries(Object.entries(table).filter(([name]) => name !== key));

test('a choose becomes a choose event with its option ids, followed by the events of every option tagged with that option', () => {
  assert.deepEqual(expand(howStep(), ['scissors']), [
    { kind: 'choose', chain: 'x', step: 'how', options: ['cut', 'tear'], roomId: 'kitchen' },
    { kind: 'find', chain: 'x', step: 'sc', thingId: 'scissors', leftAt: counter, option: 'how/cut' },
    { kind: 'tell', chain: 'x', step: 'cutit', roomId: null, uses: 'scissors', option: 'how/cut' },
    { kind: 'putAway', chain: 'x', step: 'sc-back', thingId: 'scissors', option: 'how/cut' },
    { kind: 'tell', chain: 'x', step: 'ripped', roomId: null, option: 'how/tear' },
  ]);
});

test('a choose that is not tied to a room asks its question wherever the player is', () => {
  assert.equal(expand(howStep({ at: undefined }), ['scissors'])[0].roomId, null);
});

test('the option steps of things that are not chosen are only told', () => {
  assert.deepEqual(expand(howStep(), []).map((event) => event.kind), ['choose', 'tell', 'tell', 'tell', 'tell']);
});

test('a choose needs a sentence for its question', () => {
  assert.equal(STEP_KINDS.choose?.needsSentence(howStep(), context), true);
});

test('a choose with two or three options of ordinary steps is valid', () => {
  assert.equal(STEP_KINDS.choose?.isValid(howStep(), context), true);
  assert.equal(STEP_KINDS.choose?.isValid(howStep({ options: [cutOption, tearOption, { id: 'skip', steps: [{ id: 'sk', kind: 'tell' }] }] }), context), true);
});

test('a choose with no options array, an option without steps, or a room that does not exist is not valid', () => {
  assert.equal(STEP_KINDS.choose?.isValid(howStep({ options: undefined }), context), false);
  assert.equal(STEP_KINDS.choose?.isValid(howStep({ options: [cutOption, { id: 'tear', steps: [] }] }), context), false);
  assert.equal(STEP_KINDS.choose?.isValid(howStep({ at: 'moon' }), context), false);
});

test('an option may hold a take, a tell, a put-back and a walk-to, and nothing else', () => {
  const only = (step) => howStep({ options: [cutOption, { id: 'tear', steps: [step] }] });
  assert.equal(STEP_KINDS.choose?.isValid(only({ id: 'g', kind: 'goTo', roomId: 'living' }), context), true);
  for (const step of [{ id: 'm', kind: 'move', roomId: 'living' }, { id: 'k', kind: 'check' }, { id: 'n', kind: 'needAgain' }, { id: 'o', kind: 'choose', options: [cutOption, tearOption] }]) {
    assert.equal(STEP_KINDS.choose?.isValid(only(step), context), false, step.kind);
  }
});

test('a step inside an option is held to the rules of its own kind', () => {
  const only = (step) => howStep({ options: [cutOption, { id: 'tear', steps: [step] }] });
  assert.equal(STEP_KINDS.choose?.isValid(only({ id: 'g', kind: 'goTo', roomId: 'moon' }), context), false);
  assert.equal(STEP_KINDS.choose?.isValid(only({ id: 't', kind: 'take', object: 'scissors' }), context), false);
});

test('a step id is found by hasStep also when the step lies inside an option', () => {
  const chains = [choosing()];
  for (const id of ['a', 'how', 'sc', 'cutit', 'sc-back', 'ripped', 'c']) assert.equal(hasStep('good', id, chains), true, id);
  assert.equal(hasStep('good', 'nope', chains), false);
  assert.equal(hasStep('other', 'sc', chains), false);
});

test('a good chain with a choice keeps the contract', () => {
  assert.deepEqual(problems(choosing(), CHOOSING_TEXTS, LABELS), []);
});

test('a choose with one option, or with four, is a problem', () => {
  const four = [cutOption, tearOption, { id: 'x', steps: [{ id: 'x1', kind: 'tell' }] }, { id: 'y', steps: [{ id: 'y1', kind: 'tell' }] }];
  const texts = { good: { ...CHOOSING_TEXTS.good, x1: 'x', y1: 'y' } };
  const labels = { good: { how: { cut: 'Cut it', tear: 'Tear it', x: 'X', y: 'Y' } } };
  assert.ok(problems(choosing({ options: [tearOption] }), { good: { a: 'Go.', how: 'How?', ripped: 'Rip.', c: 'Done?' } }, LABELS).includes('how: a choose has two or three options'));
  assert.ok(problems(choosing({ options: four }), texts, labels).includes('how: a choose has two or three options'));
});

test('two options with the same id are a problem', () => {
  const twins = choosing({ options: [cutOption, { ...tearOption, id: 'cut' }] });
  assert.ok(problems(twins, CHOOSING_TEXTS, LABELS).includes('how: two options have the same id'));
});

test('an option without a label is a problem', () => {
  assert.deepEqual(problems(choosing(), CHOOSING_TEXTS, { good: { how: { cut: 'Cut it' } } }), ['how/tear: no label']);
  assert.deepEqual(problems(choosing(), CHOOSING_TEXTS, {}), ['how/cut: no label', 'how/tear: no label']);
});

test('a step inside an option that has no sentence is a problem, and so is a choose without its question', () => {
  assert.deepEqual(problems(choosing(), { good: withoutKey(CHOOSING_TEXTS.good, 'cutit') }, LABELS), ['cutit: no sentence']);
  assert.deepEqual(problems(choosing(), { good: withoutKey(CHOOSING_TEXTS.good, 'how') }, LABELS), ['how: no sentence']);
});

test('the sentence of a step inside an option is not a sentence without a step', () => {
  assert.equal(problems(choosing(), CHOOSING_TEXTS, LABELS).some((problem) => problem.includes('without a step')), false);
});

test('a step id inside an option that another step of the chain has too is a problem', () => {
  const twin = choosing({ options: [cutOption, { id: 'tear', steps: [{ id: 'c', kind: 'tell' }] }] });
  assert.ok(problems(twin, { good: withoutKey(CHOOSING_TEXTS.good, 'ripped') }, LABELS).includes('two steps have the same id'));
});

test('a step that uses a thing which only one option takes is a problem on the path of the other option', () => {
  const chain = choosing();
  chain.steps[2] = { id: 'c', kind: 'tell', uses: 'scissors' };
  assert.deepEqual(problems(chain, CHOOSING_TEXTS, LABELS), ['c: uses scissors, which the chain does not take earlier']);
});

test('a put-back of a thing that only one option takes is a problem on the path of the other option', () => {
  const chain = choosing();
  chain.steps[2] = { id: 'c', kind: 'putBack', object: 'scissors' };
  assert.deepEqual(problems(chain, { good: withoutKey(CHOOSING_TEXTS.good, 'c') }, LABELS), ['c: scissors is put back before it is taken']);
});

test('a thing that every option takes may be used after the choice', () => {
  const both = choosing({ options: [cutOption, { id: 'tear', steps: [{ id: 'sc2', kind: 'take', object: 'scissors', leftAt: counter }] }] });
  both.steps[2] = { id: 'c', kind: 'tell', uses: 'scissors' };
  assert.deepEqual(problems(both, { good: { ...withoutKey(CHOOSING_TEXTS.good, 'ripped'), sc2: 'again' } }, LABELS), []);
});

test('a choose inside an option is a problem', () => {
  const nested = choosing({ options: [cutOption, { id: 'tear', steps: [{ id: 'inner', kind: 'choose', options: [cutOption, tearOption] }] }] });
  assert.ok(problems(nested, CHOOSING_TEXTS, LABELS).includes('how: the fields of a choose are wrong'));
});

test('a choose is checked on every path: a chain with two choices has four paths and a fault on one of them is found', () => {
  const second = { id: 'again', kind: 'choose', options: [{ id: 'one', steps: [{ id: 'u', kind: 'tell', uses: 'scissors' }] }, { id: 'two', steps: [{ id: 'w', kind: 'tell' }] }] };
  const chain = choosing();
  chain.steps.splice(2, 0, second);
  const texts = { good: { ...CHOOSING_TEXTS.good, again: 'Again?', u: 'u', w: 'w' } };
  const labels = { good: { ...LABELS.good, again: { one: 'One', two: 'Two' } } };
  assert.deepEqual(problems(chain, texts, labels), ['u: uses scissors, which the chain does not take earlier']);
});
