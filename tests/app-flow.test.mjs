import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppFlow } from '../app/js/app-flow.js';
import { Round } from '../app/js/round.js';
import { LAYOUT, ITEMS, DEFAULT_PLAN } from '../app/js/layout.js';

const firstChoice = { pick: (list) => list[0], shuffle: (list) => [...list] };

function newApp(overrides = {}) {
  const calls = { plans: [], progress: [], roundPlans: [] };
  const app = new AppFlow({
    layout: LAYOUT,
    items: ITEMS,
    plan: DEFAULT_PLAN,
    progress: { streaks: {} },
    createRound: (plan, progress) => {
      calls.roundPlans.push(plan);
      return new Round({ layout: LAYOUT, items: ITEMS, plan, random: firstChoice, progress });
    },
    onPlanChange: (plan) => calls.plans.push(plan),
    onProgressChange: (progress) => calls.progress.push(progress),
    ...overrides,
  });
  return { app, calls };
}
const ids = (app) => app.step().choices.map((choice) => choice.id);
const pick = (app, id) => { app.choose(id); app.next(); };

function playWholeRound(app) {
  pick(app, 'play');
  for (let i = 0; i < ITEMS.length; i += 1) { pick(app, 'pockets'); pick(app, 'pocket:coat/coat-left'); }
  app.next(); // the distraction
  for (let i = 0; i < ITEMS.length; i += 1) { pick(app, 'pockets'); pick(app, 'pocket:coat/coat-left'); }
}

test('the app opens with a welcome that offers to play or to choose home spots', () => {
  const { app } = newApp();
  assert.match(app.step().command, /Unforgettable/);
  assert.deepEqual(ids(app), ['play', 'setup']);
});

test('choosing to play starts a round with the questions of the round', () => {
  const { app } = newApp();
  pick(app, 'play');
  assert.match(app.step().command, /Where do you put your 🔑 keys/);
});

test('choosing home spots leads through the questions and then back to the welcome, with the plan saved', () => {
  const { app, calls } = newApp();
  pick(app, 'setup');
  for (let i = 0; i < ITEMS.length; i += 1) { pick(app, 'area:kitchen'); pick(app, 'place:sink'); }
  assert.deepEqual(ids(app), ['play', 'setup']);
  assert.equal(calls.plans.length, 1);
  assert.deepEqual(calls.plans[0].keys, { placeId: 'kitchen', spotId: 'sink' });
});

test('a round started after choosing home spots uses the new plan', () => {
  const { app, calls } = newApp();
  pick(app, 'setup');
  for (let i = 0; i < ITEMS.length; i += 1) { pick(app, 'area:kitchen'); pick(app, 'place:sink'); }
  pick(app, 'play');
  assert.deepEqual(calls.roundPlans[0].phone, { placeId: 'kitchen', spotId: 'sink' });
});

test('when everything is found the app shows the score, the results and what to do next', () => {
  const { app } = newApp();
  playWholeRound(app);
  const step = app.step();
  assert.match(step.command, /Score/);
  assert.equal(step.lead.length, ITEMS.length);
  assert.deepEqual(ids(app), ['again', 'setup']);
});

test('the streaks are saved when the round is over, and not before', () => {
  const { app, calls } = newApp();
  pick(app, 'play');
  assert.equal(calls.progress.length, 0);
  app.choose('pockets'); app.next();
  app.choose('pocket:coat/coat-left'); app.next();
  for (let i = 1; i < ITEMS.length; i += 1) { pick(app, 'pockets'); pick(app, 'pocket:coat/coat-left'); }
  app.next();
  for (let i = 0; i < ITEMS.length; i += 1) { pick(app, 'pockets'); pick(app, 'pocket:coat/coat-left'); }
  assert.equal(calls.progress.length, 1);
});

test('"play again" starts a new round', () => {
  const { app, calls } = newApp();
  playWholeRound(app);
  pick(app, 'again');
  assert.equal(calls.roundPlans.length, 2);
  assert.match(app.step().command, /Where do you put your 🔑 keys/);
});
