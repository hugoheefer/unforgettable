import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SetupFlow } from '../app/js/setup-flow.js';
import { LAYOUT } from '../app/js/layout.js';
import { THINGS as ITEMS, defaultPlan } from '../app/js/things.js';
import { checkFlowContract } from './flow-contract.mjs';
import { TEXTS } from './texts-helper.mjs';
const DEFAULT_PLAN = defaultPlan();

const newFlow = (options = {}) => new SetupFlow({ layout: LAYOUT, items: ITEMS, plan: DEFAULT_PLAN, texts: TEXTS, ...options });
const ids = (step) => step.choices.map((choice) => choice.id);
const pick = (flow, id) => { flow.choose(id); flow.next(); };
const choice = (flow, id) => flow.step().choices.find((entry) => entry.id === id);

// ---- the list of things ----

test('the first screen lists every thing with its home spot, and a way out, so any thing can be changed first', () => {
  const step = newFlow().step();
  assert.match(step.command, /home spot do you want to change/);
  assert.deepEqual(ids(step), ['thing:keys', 'thing:wallet', 'thing:phone', 'thing:scissors', 'done']);
  assert.equal(choice(newFlow(), 'thing:keys').label, '🔑 keys: in the right pocket of your coat');
  assert.equal(choice(newFlow(), 'thing:phone').label, '📱 phone: on the worktop in the kitchen');
});

test('a thing can be changed without touching the others', () => {
  const flow = newFlow();
  pick(flow, 'thing:scissors');
  pick(flow, 'area:kitchen');
  pick(flow, 'place:sink');
  assert.deepEqual(flow.plan(), { ...DEFAULT_PLAN, scissors: { placeId: 'kitchen', spotId: 'sink' } });
});

test('after a home spot is chosen the list is back, with the new home spot and a line that says what was set', () => {
  const flow = newFlow();
  pick(flow, 'thing:scissors');
  pick(flow, 'area:kitchen');
  pick(flow, 'place:sink');
  assert.match(flow.step().command, /home spot do you want to change/);
  assert.equal(choice(flow, 'thing:scissors').label, '✂️ scissors: in the sink in the kitchen');
  assert.deepEqual(flow.step().lead, ['✔ Home spot of your ✂️ scissors: in the sink in the kitchen.']);
});

test('several things can be changed one after the other, in any order', () => {
  const flow = newFlow();
  pick(flow, 'thing:phone'); pick(flow, 'area:hall'); pick(flow, 'place:hook');
  pick(flow, 'thing:keys'); pick(flow, 'area:coat'); pick(flow, 'place:coat-left');
  assert.deepEqual(flow.plan().phone, { placeId: 'hall', spotId: 'hook' });
  assert.deepEqual(flow.plan().keys, { garmentId: 'coat', pocketId: 'coat-left' });
  assert.deepEqual(flow.plan().wallet, DEFAULT_PLAN.wallet);
});

test('the line about the last change is gone as soon as the next thing is chosen', () => {
  const flow = newFlow();
  pick(flow, 'thing:phone'); pick(flow, 'area:hall'); pick(flow, 'place:hook');
  pick(flow, 'thing:keys');
  assert.deepEqual(flow.step().lead, []);
});

// ---- the areas and the places ----

test('after a thing is chosen every room and every piece of clothing is offered, and a way back', () => {
  const flow = newFlow();
  pick(flow, 'thing:keys');
  const step = flow.step();
  assert.match(step.command, /keys/);
  for (const area of ['area:kitchen', 'area:coat', 'area:trousers']) assert.ok(ids(step).includes(area), area);
  assert.equal(ids(step).at(-1), 'back');
});

test('the area where the thing is kept now is starred', () => {
  const flow = newFlow();
  pick(flow, 'thing:keys');
  assert.equal(choice(flow, 'area:coat').mark, '★');
  assert.equal(choice(flow, 'area:kitchen').mark, undefined);
});

test('after the area the places in it are offered, and the current one is starred', () => {
  const flow = newFlow();
  pick(flow, 'thing:keys');
  pick(flow, 'area:coat');
  assert.match(flow.step().command, /coat/);
  assert.ok(ids(flow.step()).includes('place:coat-right'));
  assert.equal(choice(flow, 'place:coat-right').mark, '★');
});

test('a pocket as home is stored as a pocket', () => {
  const flow = newFlow();
  pick(flow, 'thing:keys');
  pick(flow, 'area:coat');
  pick(flow, 'place:coat-left');
  assert.deepEqual(flow.plan().keys, { garmentId: 'coat', pocketId: 'coat-left' });
});

test('"back" goes one level up and changes nothing: from the places to the areas, from the areas to the list', () => {
  const flow = newFlow();
  pick(flow, 'thing:keys');
  pick(flow, 'area:kitchen');
  pick(flow, 'back');
  assert.match(flow.step().command, /keys/);
  pick(flow, 'back');
  assert.match(flow.step().command, /home spot do you want to change/);
  assert.deepEqual(flow.plan(), DEFAULT_PLAN);
});

// ---- being done ----

test('the flow is not finished until the player says they are done, however many things were changed', () => {
  const flow = newFlow();
  for (const thing of ['keys', 'wallet', 'phone', 'scissors']) {
    pick(flow, `thing:${thing}`); pick(flow, 'area:hall'); pick(flow, 'place:hook');
  }
  assert.equal(flow.isFinished(), false);
  pick(flow, 'done');
  assert.equal(flow.isFinished(), true);
});

test('the player can be done at once, without changing anything', () => {
  const flow = newFlow();
  pick(flow, 'done');
  assert.equal(flow.isFinished(), true);
  assert.deepEqual(flow.plan(), DEFAULT_PLAN);
});

test('the flow tells its owner exactly once that the player is done, and not before', () => {
  let finished = 0;
  const flow = newFlow({ onFinished: () => { finished += 1; } });
  pick(flow, 'thing:keys'); pick(flow, 'area:hall'); pick(flow, 'place:hook');
  assert.equal(finished, 0);
  pick(flow, 'done');
  assert.equal(finished, 1);
});

test('the plan that was given is never changed', () => {
  const before = JSON.stringify(DEFAULT_PLAN);
  const flow = newFlow();
  pick(flow, 'thing:keys'); pick(flow, 'area:kitchen'); pick(flow, 'place:sink');
  assert.equal(JSON.stringify(DEFAULT_PLAN), before);
});

checkFlowContract('SetupFlow', () => newFlow());

test('the questions and the words come from the injected texts, not from the code', () => {
  const texts = { ...TEXTS, whichThing: 'WELKE?', whereToKeep: () => 'WAAR?', setupDone: 'KLAAR' };
  const flow = newFlow({ texts });
  assert.equal(flow.step().command, 'WELKE?');
  assert.equal(choice(flow, 'done').label, 'KLAAR');
  pick(flow, 'thing:keys');
  assert.equal(flow.step().command, 'WAAR?');
});
