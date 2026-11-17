import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LookBackFlow } from '../app/js/look-back-flow.js';
import { TEXTS } from './texts-helper.mjs';

const ENTRIES = [
  { lead: ['L1'], command: 'C1', picked: 'P1' },
  { lead: [], command: 'C2', picked: null },
  { lead: ['L3'], command: 'C3', picked: 'P3' },
];

function newFlow(entries = ENTRIES, options = {}) {
  const calls = { returned: 0 };
  const flow = new LookBackFlow({ entries, texts: TEXTS, onReturn: () => { calls.returned += 1; }, ...options });
  return { flow, calls };
}
const ids = (flow) => flow.step().choices.map((choice) => choice.id);
const pick = (flow, id) => { flow.choose(id); flow.next(); };

test('looking back starts at the screen the player left last, with what was chosen on it', () => {
  const { flow } = newFlow();
  assert.equal(flow.step().command, 'C3 You chose: P3.');
  assert.deepEqual(flow.step().lead.slice(1), ['L3']);
});

test('the first line says that nothing done here changes the game', () => {
  const { flow } = newFlow();
  assert.equal(flow.step().lead[0], TEXTS.lookBackNote);
});

test('a screen on which nothing was chosen is shown without a line about a choice', () => {
  const { flow } = newFlow();
  pick(flow, 'earlier');
  assert.equal(flow.step().command, 'C2');
});

test('on the newest screen the player can go earlier or back to the game, and earlier is already selected', () => {
  const { flow } = newFlow();
  assert.deepEqual(ids(flow), ['earlier', 'return']);
  assert.equal(flow.step().selected, 'earlier');
});

test('Next goes one screen earlier each time, with one tap', () => {
  const { flow } = newFlow();
  flow.next();
  assert.equal(flow.step().command, 'C2');
  flow.next();
  assert.equal(flow.step().command, 'C1 You chose: P1.');
});

test('in between, earlier, later and back to the game are offered', () => {
  const { flow } = newFlow();
  flow.next();
  assert.deepEqual(ids(flow), ['earlier', 'later', 'return']);
});

test('on the oldest screen there is no earlier, and going back to the game is selected', () => {
  const { flow } = newFlow();
  flow.next();
  flow.next();
  assert.deepEqual(ids(flow), ['later', 'return']);
  assert.equal(flow.step().selected, 'return');
});

test('later goes forward again', () => {
  const { flow } = newFlow();
  flow.next();
  pick(flow, 'later');
  assert.equal(flow.step().command, 'C3 You chose: P3.');
});

test('with one screen only going back to the game is offered', () => {
  const { flow } = newFlow([ENTRIES[0]]);
  assert.deepEqual(ids(flow), ['return']);
  assert.equal(flow.step().selected, 'return');
});

test('going back to the game tells the owner once and the flow is finished', () => {
  const { flow, calls } = newFlow();
  assert.equal(flow.isFinished(), false);
  pick(flow, 'return');
  assert.equal(calls.returned, 1);
  assert.equal(flow.isFinished(), true);
});

test('the choices of the old screen are not offered: only moving through the screens is', () => {
  const { flow } = newFlow();
  assert.throws(() => flow.choose('spots'), /not offered/i);
  assert.throws(() => flow.choose('later'), /not offered/i);
});

test('the words come from the injected texts', () => {
  const { flow } = newFlow(ENTRIES, { texts: { ...TEXTS, lookBackNote: 'LOOKING BACK', lookBackReturn: 'TERUG' } });
  assert.equal(flow.step().lead[0], 'LOOKING BACK');
  assert.equal(flow.step().choices.find((choice) => choice.id === 'return').label, 'TERUG');
});

test('a flow without any screen to look at is a mistake', () => {
  assert.throws(() => new LookBackFlow({ entries: [], texts: TEXTS, onReturn: () => {} }));
});

test('looking back never changes the entries it was given', () => {
  const entries = structuredClone(ENTRIES);
  const { flow } = newFlow(entries);
  flow.next();
  flow.next();
  assert.deepEqual(entries, ENTRIES);
});
