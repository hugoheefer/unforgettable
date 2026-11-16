import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Round } from '../app/js/round.js';
import { PlayFlow } from '../app/js/play-flow.js';
import { LAYOUT } from '../app/js/layout.js';
import { THINGS as ITEMS, defaultPlan } from '../app/js/things.js';
import { checkFlowContract } from './flow-contract.mjs';
import { TEXTS } from './texts-helper.mjs';
import { RefusedMove } from '../app/js/errors.js';
const DEFAULT_PLAN = defaultPlan();

const firstChoice = { pick: (list) => list[0], shuffle: (list) => [...list] };
const newFlow = (streaks = {}, options = {}) =>
  new PlayFlow(new Round({ layout: LAYOUT, items: ITEMS, plan: DEFAULT_PLAN, random: firstChoice, progress: { streaks }, texts: TEXTS, ...options }), { texts: TEXTS });
const ids = (step) => step.choices.map((choice) => choice.id);
const pick = (flow, id) => { flow.choose(id); flow.next(); };

/** Puts every item in the coat's left pocket, so the search starts. */
function dropEverything(flow) {
  for (let i = 0; i < ITEMS.length; i += 1) {
    pick(flow, 'pockets');
    pick(flow, 'pocket:coat/coat-left');
  }
}

test('the first screen asks where to put the first item, with four ways to answer', () => {
  const step = newFlow().step();
  assert.match(step.command, /hallway/);
  assert.match(step.command, /keys/);
  assert.deepEqual(ids(step), ['spots', 'pockets', 'doors', 'hang:coat']);
});

test('the pressure and the moves left are part of what the app says, not a separate panel', () => {
  const lead = newFlow().step().lead.join(' ');
  assert.match(lead, /3 moves left/);
});

test('without a choice, Next does nothing', () => {
  const flow = newFlow();
  const before = flow.step();
  flow.next();
  assert.deepEqual(flow.step(), before);
});

test('a choice that is not offered on this screen is refused', () => {
  assert.throws(() => newFlow().choose('spot:hook'), /not offered/i);
});

test('choosing "a spot" and Next shows the spots of this room', () => {
  const flow = newFlow();
  pick(flow, 'spots');
  const step = flow.step();
  assert.match(step.command, /Which spot/);
  assert.ok(ids(step).includes('spot:hook'));
  assert.ok(ids(step).includes('back'));
});

test('choosing a spot and Next puts the item there and asks about the next item', () => {
  const flow = newFlow();
  pick(flow, 'spots');
  pick(flow, 'spot:hook');
  const step = flow.step();
  assert.match(step.command, /wallet/);
  assert.match(step.lead.join(' '), /home spot/i);
});

test('putting an item somewhere else is told, together with what the plan was', () => {
  const flow = newFlow();
  pick(flow, 'spots');
  pick(flow, 'spot:shoes');
  const lead = flow.step().lead.join(' ');
  assert.match(lead, /Shoe rack/);
  assert.match(lead, /Key hook/);
});

test('"back" returns to the first question without costing a move', () => {
  const flow = newFlow();
  pick(flow, 'spots');
  pick(flow, 'back');
  assert.deepEqual(ids(flow.step()), ['spots', 'pockets', 'doors', 'hang:coat']);
  assert.match(flow.step().lead.join(' '), /3 moves left/);
});

test('the pockets of what you wear are offered, and choosing one puts the item in it', () => {
  const flow = newFlow();
  pick(flow, 'pockets');
  assert.ok(ids(flow.step()).includes('pocket:coat/coat-right'));
  assert.ok(ids(flow.step()).includes('pocket:trousers/trousers-back'));
  pick(flow, 'pocket:coat/coat-right');
  assert.match(flow.step().command, /wallet/);
});

test('walking to another room costs a move and the next question is about that room', () => {
  const flow = newFlow();
  pick(flow, 'doors');
  pick(flow, 'door:kitchen');
  assert.match(flow.step().command, /kitchen/);
  assert.match(flow.step().lead.join(' '), /2 moves left/);
});

test('taking the coat off: choose where to hang it, then the coat can be put on again', () => {
  const flow = newFlow();
  pick(flow, 'hang:coat');
  assert.match(flow.step().command, /hang/i);
  pick(flow, 'spot:coat-hooks');
  assert.ok(ids(flow.step()).includes('puton:coat'));
  assert.equal(ids(flow.step()).includes('hang:coat'), false);
});

test('the pockets of a coat that hangs in this room say so', () => {
  const flow = newFlow();
  pick(flow, 'hang:coat');
  pick(flow, 'spot:coat-hooks');
  pick(flow, 'pockets');
  const labels = flow.step().choices.map((choice) => choice.label).join(' ');
  assert.match(labels, /Coat, hangs here/);
});

test('with a short streak the home spot is starred and named; with a long streak neither', () => {
  const short = newFlow();
  pick(short, 'spots');
  assert.equal(short.step().choices.find((c) => c.id === 'spot:hook').mark, '★');
  assert.match(short.step().lead.join(' '), /Key hook/);
  const long = newFlow({ keys: 5 });
  pick(long, 'spots');
  assert.equal(long.step().choices.find((c) => c.id === 'spot:hook').mark, undefined);
  assert.doesNotMatch(long.step().lead.join(' '), /Your plan/);
});

test('an interruption is told on the next screen', () => {
  const flow = newFlow({}, { budget: 1 });
  pick(flow, 'doors');
  pick(flow, 'door:kitchen');
  assert.match(flow.step().lead.join(' '), /interrupted/i);
});

test('after the last item a screen with only the distraction and Next follows, then the search', () => {
  const flow = newFlow();
  dropEverything(flow);
  const interlude = flow.step();
  assert.deepEqual(interlude.choices, []);
  assert.match(interlude.command, /neighbour|dinner|phone call/);
  flow.next();
  assert.match(flow.step().command, /find your keys/i);
  assert.deepEqual(ids(flow.step()), ['spots', 'pockets', 'doors']);
});

test('looking in the right pocket tells that the item was found; the wrong place says it is not here', () => {
  const flow = newFlow();
  dropEverything(flow);
  flow.next();
  pick(flow, 'spots');
  pick(flow, 'spot:sofa');
  assert.match(flow.step().lead.join(' '), /Not here/);
  pick(flow, 'pockets');
  pick(flow, 'pocket:coat/coat-left');
  assert.match(flow.step().lead.join(' '), /Found your 🔑 keys/);
  assert.match(flow.step().command, /wallet/);
});

test('the flow is finished when everything has been found', () => {
  const flow = newFlow();
  dropEverything(flow);
  flow.next();
  for (let i = 0; i < ITEMS.length; i += 1) {
    pick(flow, 'pockets');
    pick(flow, 'pocket:coat/coat-left');
  }
  assert.equal(flow.isFinished(), true);
});

test('a refused move shows its reason instead of crashing', () => {
  const flow = newFlow();
  dropEverything(flow);
  flow.next();
  pick(flow, 'pockets');
  assert.doesNotThrow(() => pick(flow, 'back'));
});

checkFlowContract('PlayFlow', () => newFlow());

test('the flow tells its owner exactly once that the round is over, and not before', () => {
  let finished = 0;
  const flow = new PlayFlow(new Round({ layout: LAYOUT, items: ITEMS, plan: DEFAULT_PLAN, random: firstChoice, progress: { streaks: {} }, texts: TEXTS }), { texts: TEXTS, onFinished: () => { finished += 1; } });
  dropEverything(flow);
  flow.next(); // the distraction
  for (let i = 0; i < ITEMS.length - 1; i += 1) { pick(flow, 'pockets'); pick(flow, 'pocket:coat/coat-left'); }
  assert.equal(finished, 0);
  pick(flow, 'pockets');
  pick(flow, 'pocket:coat/coat-left');
  assert.equal(finished, 1);
});

test('putting on a garment says that garment\'s name', () => {
  const jacket = { id: 'jacket', icon: '🧥', startsWorn: true, removable: true, pockets: [{ id: 'jacket-left', icon: '🫳' }] };
  const layout = { ...LAYOUT, garments: [...LAYOUT.garments, jacket] };
  const texts = {
    ...TEXTS,
    garments: { ...TEXTS.garments, jacket: { name: 'Jacket', your: 'your jacket' } },
    pockets: { ...TEXTS.pockets, 'jacket-left': { name: 'Left pocket', at: 'in the left pocket of your jacket' } },
  };
  const flow = new PlayFlow(new Round({ layout, items: ITEMS, plan: DEFAULT_PLAN, random: firstChoice, progress: { streaks: {} }, texts }), { texts });
  pick(flow, 'hang:jacket');
  pick(flow, 'spot:coat-hooks');
  pick(flow, 'puton:jacket');
  assert.deepEqual(flow.step().lead.slice(0, 1), ['You put your jacket on.']);
});

const flowWith = (texts, RoundClass = Round) =>
  new PlayFlow(new RoundClass({ layout: LAYOUT, items: ITEMS, plan: DEFAULT_PLAN, random: firstChoice, progress: { streaks: {} }, texts }), { texts });

test('the sentences on the screen come from the injected texts, not from the code', () => {
  const flow = flowWith({ ...TEXTS, notHere: 'NIET HIER' });
  dropEverything(flow);
  flow.next();
  pick(flow, 'spots');
  pick(flow, 'spot:sofa');
  assert.ok(flow.step().lead.includes('NIET HIER'));
});

test('a refused move is told with the sentence of the injected texts for its code', () => {
  class DoorlessRound extends Round {
    walkTo() { throw new RefusedMove('no-door'); }
  }
  const flow = flowWith({ ...TEXTS, refusals: { ...TEXTS.refusals, 'no-door': 'GEEN DEUR' } }, DoorlessRound);
  pick(flow, 'doors');
  pick(flow, 'door:kitchen');
  assert.ok(flow.step().lead.includes('GEEN DEUR'));
});

test('a mistake in the code is not hidden behind a friendly sentence', () => {
  class BrokenRound extends Round {
    walkTo() { throw new Error('a bug'); }
  }
  const flow = flowWith(TEXTS, BrokenRound);
  pick(flow, 'doors');
  assert.throws(() => pick(flow, 'door:kitchen'), /a bug/);
});
