import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SetupFlow } from '../app/js/setup-flow.js';
import { LAYOUT } from '../app/js/layout.js';
import { THINGS as ITEMS, defaultPlan } from '../app/js/things.js';
import { checkFlowContract } from './flow-contract.mjs';
import { TEXTS } from './texts-helper.mjs';
const DEFAULT_PLAN = defaultPlan();

const newFlow = () => new SetupFlow({ layout: LAYOUT, items: ITEMS, plan: DEFAULT_PLAN, texts: TEXTS });
const ids = (step) => step.choices.map((choice) => choice.id);
const pick = (flow, id) => { flow.choose(id); flow.next(); };

test('the first question is about the first item and offers every room and every piece of clothing', () => {
  const step = newFlow().step();
  assert.match(step.command, /keys/);
  assert.ok(ids(step).includes('area:kitchen'));
  assert.ok(ids(step).includes('area:coat'));
  assert.ok(ids(step).includes('area:trousers'));
});

test('the area where the item is kept now is starred', () => {
  const step = newFlow().step();
  assert.equal(step.choices.find((choice) => choice.id === 'area:hall').mark, '★');
  assert.equal(step.choices.find((choice) => choice.id === 'area:kitchen').mark, undefined);
});

test('after the area the places in it are offered, and the current one is starred', () => {
  const flow = newFlow();
  pick(flow, 'area:hall');
  const step = flow.step();
  assert.match(step.command, /hallway/);
  assert.ok(ids(step).includes('place:hook'));
  assert.equal(step.choices.find((choice) => choice.id === 'place:hook').mark, '★');
});

test('the pockets of a garment are offered like places', () => {
  const flow = newFlow();
  pick(flow, 'area:coat');
  assert.ok(ids(flow.step()).includes('place:coat-right'));
});

test('choosing a place sets it as the home of the item and moves on to the next item', () => {
  const flow = newFlow();
  pick(flow, 'area:kitchen');
  pick(flow, 'place:fruit-bowl');
  assert.deepEqual(flow.plan().keys, { placeId: 'kitchen', spotId: 'fruit-bowl' });
  assert.match(flow.step().command, /wallet/);
});

test('a pocket as home is stored as a pocket', () => {
  const flow = newFlow();
  pick(flow, 'area:coat');
  pick(flow, 'place:coat-left');
  assert.deepEqual(flow.plan().keys, { garmentId: 'coat', pocketId: 'coat-left' });
});

test('"back" returns to the areas of the same item without changing the plan', () => {
  const flow = newFlow();
  pick(flow, 'area:kitchen');
  pick(flow, 'back');
  assert.match(flow.step().command, /keys/);
  assert.deepEqual(flow.plan(), DEFAULT_PLAN);
});

test('after the last item the flow is finished', () => {
  const flow = newFlow();
  for (let i = 0; i < ITEMS.length; i += 1) {
    pick(flow, 'area:hall');
    pick(flow, 'place:hook');
  }
  assert.equal(flow.isFinished(), true);
});

test('the plan that was given is never changed', () => {
  const before = JSON.stringify(DEFAULT_PLAN);
  const flow = newFlow();
  pick(flow, 'area:kitchen');
  pick(flow, 'place:sink');
  assert.equal(JSON.stringify(DEFAULT_PLAN), before);
});

checkFlowContract('SetupFlow', () => newFlow());

test('the flow tells its owner exactly once that every item has a home spot, and not before', () => {
  let finished = 0;
  const flow = new SetupFlow({ layout: LAYOUT, items: ITEMS, plan: DEFAULT_PLAN, texts: TEXTS, onFinished: () => { finished += 1; } });
  for (let i = 0; i < ITEMS.length - 1; i += 1) { pick(flow, 'area:kitchen'); pick(flow, 'place:sink'); }
  assert.equal(finished, 0);
  pick(flow, 'area:kitchen');
  pick(flow, 'place:sink');
  assert.equal(finished, 1);
});

test('the questions come from the injected texts, not from the code', () => {
  const flow = new SetupFlow({ layout: LAYOUT, items: ITEMS, plan: DEFAULT_PLAN, texts: { ...TEXTS, whereToKeep: () => 'WAAR?' } });
  assert.equal(flow.step().command, 'WAAR?');
});
