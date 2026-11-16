import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Day } from '../app/js/day.js';
import { PlayFlow } from '../app/js/play-flow.js';
import { RefusedMove } from '../app/js/errors.js';
import { checkFlowContract } from './flow-contract.mjs';
import { TEXTS } from './texts-helper.mjs';
import { LAYOUT } from '../app/js/layout.js';
import { THINGS, defaultPlan } from '../app/js/things.js';
import { World } from '../app/js/world.js';
import { dayState, find, findDay, makeDay, moveTo, pause, pocket, putAway, putAwayDay, spot, worldWith } from './day-helper.mjs';

const flowFor = (day, options = {}) => new PlayFlow(day, { texts: TEXTS, ...options });
const putFlow = (thingId = 'keys', options = {}) => flowFor(putAwayDay(thingId, options));
const ids = (step) => step.choices.map((choice) => choice.id);
const pick = (flow, id) => { flow.choose(id); flow.next(); };
const choice = (flow, id) => flow.step().choices.find((entry) => entry.id === id);

const PLAN_KEYS = 'Your plan: on the key hook in the hallway.';

// ---- the first question of a put-away ----

test('putting away: the lead names the plan, the command the room and the thing, four ways to answer', () => {
  assert.deepEqual(putFlow().step(), {
    lead: [PLAN_KEYS],
    command: 'You are in the hallway. Put your 🔑 keys away.',
    choices: [
      { id: 'spots', label: 'Here, in the hallway' },
      { id: 'pockets', label: 'In a pocket' },
      { id: 'doors', label: 'Walk to another room' },
      { id: 'hang:coat', label: 'Take off my coat' },
    ],
    selected: null,
    canLeave: true,
  });
});

test('the plan names a pocket by itself when the home spot is a pocket', () => {
  assert.deepEqual(putFlow('wallet').step().lead, ['Your plan: in the inside pocket of your coat.']);
});

test('with a middle streak the plan is not named; with a long streak neither', () => {
  assert.deepEqual(putFlow('keys', { streaks: { keys: 2 } }).step().lead, []);
  assert.deepEqual(putFlow('keys', { streaks: { keys: 5 } }).step().lead, []);
});

test('in a hurry the reason comes before the plan', () => {
  assert.deepEqual(putFlow('keys', { hurry: 'doorbell' }).step().lead, ['The doorbell rings. No time to walk far.', PLAN_KEYS]);
});

// ---- spots, pockets and the coat ----

test('choosing "here" shows the spots of this room, the home spot starred, and a way back', () => {
  const flow = putFlow();
  pick(flow, 'spots');
  assert.equal(flow.step().command, 'Which spot in the hallway?');
  assert.deepEqual(choice(flow, 'spot:hook'), { id: 'spot:hook', label: '🪝 Key hook', mark: '★' });
  assert.deepEqual(choice(flow, 'spot:shoes'), { id: 'spot:shoes', label: '👟 Shoe rack' });
  assert.deepEqual(choice(flow, 'back'), { id: 'back', label: '↩ Choose something else' });
});

test('with a long streak the home spot is not starred', () => {
  const flow = putFlow('keys', { streaks: { keys: 5 } });
  pick(flow, 'spots');
  assert.equal(choice(flow, 'spot:hook').mark, undefined);
});

test('"back" returns to the first question', () => {
  const flow = putFlow();
  pick(flow, 'spots');
  pick(flow, 'back');
  assert.deepEqual(ids(flow.step()), ['spots', 'pockets', 'doors', 'hang:coat']);
});

test('the pockets of what you wear are offered, and choosing one puts the thing in it', () => {
  const flow = putFlow();
  pick(flow, 'pockets');
  assert.equal(flow.step().command, 'Which pocket?');
  assert.ok(ids(flow.step()).includes('pocket:coat/coat-right'));
  assert.ok(ids(flow.step()).includes('pocket:trousers/trousers-back'));
});

test('putting a thing on its home spot is told, and the next thing is asked about', () => {
  const day = makeDay([putAway('keys'), putAway('wallet')], { state: { inHand: ['keys'] } });
  const flow = flowFor(day);
  pick(flow, 'spots');
  pick(flow, 'spot:hook');
  assert.equal(flow.step().lead[0], '✔ You put your 🔑 keys on the home spot.');
  assert.equal(flow.step().command, 'You are in the hallway. Put your 👛 wallet away.');
});

test('putting a thing elsewhere is told with where it went and where its home spot is', () => {
  const day = makeDay([putAway('keys'), putAway('wallet')], { state: { inHand: ['keys'] } });
  const flow = flowFor(day);
  pick(flow, 'spots');
  pick(flow, 'spot:shoes');
  assert.equal(flow.step().lead[0], 'You put your 🔑 keys on the shoe rack. Home spot: on the key hook in the hallway.');
});

test('a thing put in a pocket is told with the pocket, and a pocket home is named by itself', () => {
  const day = makeDay([putAway('wallet'), putAway('keys')], { state: { inHand: ['wallet'] } });
  const flow = flowFor(day);
  pick(flow, 'pockets');
  pick(flow, 'pocket:coat/coat-left');
  assert.equal(flow.step().lead[0], 'You put your 👛 wallet in the left pocket of your coat. Home spot: in the inside pocket of your coat.');
});

test('taking the coat off: choose where to hang it, then the coat can be put on again', () => {
  const flow = putFlow();
  pick(flow, 'hang:coat');
  assert.equal(flow.step().command, 'Where do you hang your coat?');
  pick(flow, 'spot:coat-hooks');
  assert.deepEqual(flow.step().lead[0], 'You hung your coat on the coat hooks.');
  assert.equal(choice(flow, 'puton:coat').label, 'Put my coat on');
  assert.equal(ids(flow.step()).includes('hang:coat'), false);
  pick(flow, 'puton:coat');
  assert.equal(flow.step().lead[0], 'You put your coat on.');
});

test('the pockets of a coat that hangs in this room say so', () => {
  const flow = putFlow();
  pick(flow, 'hang:coat');
  pick(flow, 'spot:coat-hooks');
  pick(flow, 'pockets');
  assert.match(flow.step().choices.map((entry) => entry.label).join(' '), /Coat, hangs here/);
});

// ---- walking ----

test('the walk list shows every other room with its distance, nearest first, then in the order of the layout', () => {
  const flow = putFlow('keys', { streaks: { keys: 5 } });
  pick(flow, 'doors');
  assert.equal(flow.step().command, 'Where do you walk to?');
  assert.deepEqual(flow.step().choices.map((entry) => entry.label), [
    'Living room · 1 step', 'Kitchen · 1 step', 'Toilet · 1 step', 'Landing · 1 step', 'Garden · 1 step',
    'Dining room · 2 steps', 'Bedroom · 2 steps', 'Bathroom · 2 steps', 'Study · 2 steps', 'Garage · 2 steps', 'Shed · 2 steps', 'Car · 2 steps',
    '↩ Choose something else',
  ]);
  assert.equal(ids(flow.step())[1], 'door:kitchen');
});

test('while the hint is shown or dimmed the room of the home spot is starred in the walk list', () => {
  for (const streak of [0, 2]) {
    const flow = putFlow('phone', { streaks: { phone: streak } });
    pick(flow, 'doors');
    assert.equal(choice(flow, 'door:kitchen').mark, '★');
    assert.equal(choice(flow, 'door:living').mark, undefined);
  }
});

test('with a long streak no room is starred and the plan is not named', () => {
  const flow = putFlow('phone', { streaks: { phone: 5 } });
  pick(flow, 'doors');
  assert.ok(flow.step().choices.every((entry) => entry.mark === undefined));
  assert.deepEqual(flow.step().lead, []);
});

test('the plan is named in the walk list while the hint is shown', () => {
  const flow = putFlow('phone');
  pick(flow, 'doors');
  assert.deepEqual(flow.step().lead, ['Your plan: on the counter in the kitchen.']);
});

test('in a hurry the reason is shown and far rooms are not in the list', () => {
  const flow = putFlow('keys', { hurry: 'doorbell', streaks: { keys: 5 } });
  pick(flow, 'doors');
  assert.deepEqual(flow.step().lead, ['The doorbell rings. No time to walk far.']);
  assert.deepEqual(ids(flow.step()), ['door:living', 'door:kitchen', 'door:toilet', 'door:landing', 'door:garden', 'back']);
});

test('walking to a room two doors away arrives there in one action', () => {
  const flow = putFlow();
  pick(flow, 'doors');
  pick(flow, 'door:dining');
  assert.equal(flow.step().command, 'You are in the dining room. Put your 🔑 keys away.');
});

// ---- the text of a move ----

const comingHome = () => flowFor(makeDay([pause('day'), moveTo('hall', 'arrive'), putAway('keys')], { state: { roomId: 'bedroom', startedIn: 'bedroom' } }));

test('a pause is a screen with no choices and an enabled Next', () => {
  assert.deepEqual(comingHome().step(), { lead: [], command: 'Day 2.', choices: [], selected: null, canLeave: true });
});

test('the text of a move is the first lead line of the next screen when nothing came before it', () => {
  const flow = comingHome();
  flow.next();
  assert.deepEqual(flow.step().lead, ['You come home.', PLAN_KEYS]);
});

test('the text of a move is gone on the screen after, also when you come back to the first question', () => {
  const flow = comingHome();
  flow.next();
  pick(flow, 'spots');
  assert.deepEqual(flow.step().lead, [PLAN_KEYS]);
  pick(flow, 'back');
  assert.deepEqual(flow.step().lead, [PLAN_KEYS]);
});

test('a day that was saved right after a move shows the text of that move again', () => {
  const day = makeDay([pause('day'), moveTo('hall', 'arrive'), putAway('keys')], { state: { roomId: 'bedroom' } });
  day.continue();
  assert.equal(flowFor(day).step().lead[0], 'You come home.');
});

test('the morning text names the room you leave from', () => {
  const day = makeDay([pause('day'), moveTo('kitchen', 'morning'), find('keys')]);
  const flow = flowFor(day);
  flow.next();
  assert.equal(flow.step().lead[0], 'Morning. You are in the kitchen and about to leave.');
});

test('a pause can say you are out for the day', () => {
  const flow = flowFor(makeDay([pause('outForTheDay'), moveTo('hall', 'arrive'), putAway('keys')]));
  assert.equal(flow.step().command, 'You are out for the day.');
});

// ---- finding ----

test('finding a thing for a use: the use is the lead, then the command and three ways to answer', () => {
  const day = makeDay([find('phone', 'call'), putAway('phone')], { state: { roomId: 'living', startedIn: 'living' } });
  assert.deepEqual(flowFor(day).step(), {
    lead: ['Your phone rings.'],
    command: 'Find your 📱 phone. You are in the living room.',
    choices: [
      { id: 'spots', label: 'Look here, in the living room' },
      { id: 'pockets', label: 'Look in a pocket' },
      { id: 'doors', label: 'Walk to another room' },
    ],
    selected: null,
    canLeave: true,
  });
});

test('finding a thing when you leave has no lead of its own', () => {
  assert.deepEqual(flowFor(findDay('keys')).step().lead, []);
});

test('the coat cannot be taken off while looking for something', () => {
  assert.equal(ids(flowFor(findDay('keys')).step()).includes('hang:coat'), false);
});

test('looking at a wrong spot says not here, and what you see there', () => {
  const world = worldWith({ keys: spot('hall', 'hook'), wallet: spot('hall', 'console') });
  const flow = flowFor(findDay('keys', { world }));
  pick(flow, 'spots');
  assert.equal(flow.step().command, 'Which spot do you look at in the hallway?');
  pick(flow, 'spot:console');
  assert.deepEqual(flow.step().lead, ['Not here. You see 👛.']);
  pick(flow, 'spots');
  assert.equal(choice(flow, 'spot:console').label, '🪑 Console table 👛');
  pick(flow, 'spot:shoes');
  assert.deepEqual(flow.step().lead, ['Not here.']);
});

test('finding a thing tells where it was and what it cost in steps', () => {
  const world = worldWith({ phone: spot('kitchen', 'counter') });
  const day = makeDay([find('phone', 'call'), moveTo('garden', 'after', { thingId: 'phone', useId: 'call' }), putAway('phone')], { world, state: { roomId: 'kitchen', startedIn: 'kitchen' } });
  const flow = flowFor(day);
  pick(flow, 'spots');
  pick(flow, 'spot:fruit-bowl');
  pick(flow, 'spots');
  pick(flow, 'spot:counter');
  assert.equal(flow.step().lead[0], 'Found your 📱 phone on the counter. 2 steps.');
});

test('after a use: what the find cost, then the text of the move, then the plan', () => {
  const world = worldWith({ phone: spot('kitchen', 'counter') });
  const day = makeDay([find('phone', 'call'), moveTo('garden', 'after', { thingId: 'phone', useId: 'call' }), putAway('phone')], { world, state: { roomId: 'kitchen', startedIn: 'kitchen' } });
  const flow = flowFor(day);
  pick(flow, 'spots');
  pick(flow, 'spot:counter');
  assert.deepEqual(flow.step().lead, [
    'Found your 📱 phone on the counter. 1 step.',
    'You walked around while talking. The call is over.',
    'Your plan: on the counter in the kitchen.',
  ]);
  assert.equal(flow.step().command, 'You are in the garden. Put your 📱 phone away.');
});

test('the text of the move after a use is gone on the screen after', () => {
  const world = worldWith({ phone: spot('kitchen', 'counter') });
  const day = makeDay([find('phone', 'call'), moveTo('garden', 'after', { thingId: 'phone', useId: 'call' }), putAway('phone')], { world, state: { roomId: 'kitchen', startedIn: 'kitchen' } });
  const flow = flowFor(day);
  pick(flow, 'spots');
  pick(flow, 'spot:counter');
  pick(flow, 'doors');
  assert.deepEqual(flow.step().lead, ['Your plan: on the counter in the kitchen.']);
});

test('a home pocket of a coat that hangs in another room gets that room starred in the walk list', () => {
  const flow = putFlow('wallet', { world: worldWith({}, { coat: spot('kitchen', 'counter') }) });
  pick(flow, 'doors');
  assert.equal(choice(flow, 'door:kitchen').mark, '★');
  assert.equal(choice(flow, 'door:living').mark, undefined);
});

test('a home pocket of the coat you wear stars no room in the walk list', () => {
  const flow = putFlow('wallet');
  pick(flow, 'doors');
  assert.ok(flow.step().choices.every((entry) => entry.mark === undefined));
});

test('a thing found in a pocket is told with the pocket', () => {
  const world = worldWith({ wallet: pocket('coat', 'coat-inside') });
  const flow = flowFor(makeDay([find('wallet'), putAway('wallet')], { world }));
  pick(flow, 'pockets');
  pick(flow, 'pocket:coat/coat-inside');
  assert.equal(flow.step().lead[0], 'Found your 👛 wallet in the inside pocket of your coat. 1 step.');
});

// ---- finishing, refusals, contract ----

test('the flow is finished when the last event is done, and says so exactly once', () => {
  let finished = 0;
  const flow = flowFor(putAwayDay('keys'), { onFinished: () => { finished += 1; } });
  assert.equal(flow.isFinished(), false);
  assert.equal(finished, 0);
  pick(flow, 'spots');
  pick(flow, 'spot:hook');
  assert.equal(flow.isFinished(), true);
  assert.equal(finished, 1);
});

test('Next on a pause moves the day on', () => {
  const flow = flowFor(makeDay([pause('day'), putAway('keys')], { state: { inHand: ['keys'] } }));
  flow.next();
  assert.match(flow.step().command, /Put your 🔑 keys away/);
});

test('every screen of a day carries the flag that lets the player leave', () => {
  const flow = comingHome();
  assert.equal(flow.step().canLeave, true);
  flow.next();
  assert.equal(flow.step().canLeave, true);
  for (const id of ['spots', 'doors', 'pockets']) {
    pick(flow, id);
    assert.equal(flow.step().canLeave, true, id);
    pick(flow, 'back');
  }
});

test('the sentences on the screen come from the injected texts, not from the code', () => {
  const world = worldWith({ keys: spot('hall', 'hook') });
  const flow = new PlayFlow(findDay('keys', { world }), { texts: { ...TEXTS, notHere: 'NIET HIER' } });
  pick(flow, 'spots');
  pick(flow, 'spot:shoes');
  assert.ok(flow.step().lead.includes('NIET HIER'));
});

class RefusingDay extends Day {
  walkTo() { throw new RefusedMove('already-here'); }
}
class BrokenDay extends Day {
  walkTo() { throw new Error('a bug'); }
}

test('a refused move is told with the sentence of the injected texts for its code', () => {
  const day = makeDay([putAway('keys')], { DayClass: RefusingDay, state: { inHand: ['keys'] } });
  const flow = new PlayFlow(day, { texts: { ...TEXTS, refusals: { ...TEXTS.refusals, 'already-here': 'AL DAAR' } } });
  pick(flow, 'doors');
  pick(flow, 'door:kitchen');
  assert.ok(flow.step().lead.includes('AL DAAR'));
});

test('a refusal does not hide the first question: the player is back on it', () => {
  const day = makeDay([putAway('keys')], { DayClass: RefusingDay, state: { inHand: ['keys'] } });
  const flow = flowFor(day);
  pick(flow, 'doors');
  pick(flow, 'door:kitchen');
  assert.deepEqual(ids(flow.step()), ['spots', 'pockets', 'doors', 'hang:coat']);
});

test('a mistake in the code is not hidden behind a friendly sentence', () => {
  const day = makeDay([putAway('keys')], { DayClass: BrokenDay, state: { inHand: ['keys'] } });
  const flow = flowFor(day);
  pick(flow, 'doors');
  assert.throws(() => pick(flow, 'door:kitchen'), /a bug/);
});

test('putting on a garment says that garment\'s name', () => {
  const jacket = { id: 'jacket', icon: '🧥', startsWorn: true, removable: true, pockets: [{ id: 'jacket-left', icon: '🫳' }] };
  const layout = { ...LAYOUT, garments: [...LAYOUT.garments, jacket] };
  const texts = {
    ...TEXTS,
    garments: { ...TEXTS.garments, jacket: { name: 'Jacket', your: 'your jacket', my: 'my jacket' } },
    pockets: { ...TEXTS.pockets, 'jacket-left': { name: 'Left pocket', at: 'in the left pocket of your jacket' } },
  };
  const day = new Day({
    layout, things: THINGS, world: new World(layout), plan: defaultPlan(), progress: { streaks: {} },
    state: dayState([putAway('keys')], { inHand: ['keys'] }),
  });
  const flow = new PlayFlow(day, { texts });
  pick(flow, 'hang:jacket');
  pick(flow, 'spot:coat-hooks');
  pick(flow, 'puton:jacket');
  assert.deepEqual(flow.step().lead.slice(0, 1), ['You put your jacket on.']);
});

checkFlowContract('PlayFlow', () => putFlow());

// ---- reporting what a find and a put-away cost ----

const hookWorld = () => worldWith({ keys: spot('hall', 'hook') });
const recorder = () => {
  const reported = { found: [], put: [] };
  return { reported, options: { onFound: (record) => reported.found.push(record), onPut: (record) => reported.put.push(record) } };
};

test('a find that ends is reported once, with what it cost and what it could have cost', () => {
  const { reported, options } = recorder();
  const flow = flowFor(findDay('keys', { world: hookWorld() }), options);
  pick(flow, 'spots');
  pick(flow, 'spot:hook');
  assert.deepEqual(reported.found, [{ thingId: 'keys', steps: 1, shortest: 1, wasHome: true }]);
  assert.deepEqual(reported.put, []);
});

test('looking in a place where the thing is not reports nothing', () => {
  const { reported, options } = recorder();
  const flow = flowFor(findDay('keys', { world: hookWorld() }), options);
  pick(flow, 'spots');
  pick(flow, 'spot:shoes');
  assert.deepEqual(reported, { found: [], put: [] });
});

test('a find after wrong looks is reported with all the steps it took', () => {
  const { reported, options } = recorder();
  const flow = flowFor(findDay('keys', { world: hookWorld() }), options);
  for (const id of ['spot:shoes', 'spot:console', 'spot:hook']) { pick(flow, 'spots'); pick(flow, id); }
  assert.deepEqual(reported.found, [{ thingId: 'keys', steps: 3, shortest: 1, wasHome: true }]);
});

test('a put-away that ends is reported once, with its steps, whether it was at home and the hurry', () => {
  const { reported, options } = recorder();
  const flow = flowFor(putAwayDay('keys'), options);
  pick(flow, 'spots');
  pick(flow, 'spot:hook');
  assert.deepEqual(reported.put, [{ thingId: 'keys', steps: 0, atHome: true, hurry: false }]);
  assert.deepEqual(reported.found, []);
});

test('a put-away on another spot after a walk is reported as not at home, with the steps of the walk', () => {
  const { reported, options } = recorder();
  const flow = flowFor(putAwayDay('keys'), options);
  pick(flow, 'doors');
  pick(flow, 'door:living');
  pick(flow, 'spots');
  pick(flow, 'spot:sofa');
  assert.deepEqual(reported.put, [{ thingId: 'keys', steps: 1, atHome: false, hurry: false }]);
});

test('a put-away in a hurry is reported as such', () => {
  const { reported, options } = recorder();
  const flow = flowFor(putAwayDay('keys', { hurry: 'doorbell' }), options);
  pick(flow, 'spots');
  pick(flow, 'spot:hook');
  assert.equal(reported.put[0].hurry, true);
});

test('walking, hanging a coat and opening a list report nothing', () => {
  const { reported, options } = recorder();
  const flow = flowFor(putAwayDay('keys'), options);
  pick(flow, 'doors');
  pick(flow, 'door:living');
  pick(flow, 'hang:coat');
  pick(flow, 'spot:sofa');
  assert.deepEqual(reported, { found: [], put: [] });
});
