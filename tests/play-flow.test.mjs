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
import { check, dayState, find, findDay, goTo, letGo, makeDay, moveTo, pause, pocket, putAway, putAwayDay, spot, tell, worldWith } from './day-helper.mjs';

const flowFor = (day, options = {}) => new PlayFlow(day, { texts: TEXTS, ...options });
const putFlow = (thingId = 'keys', options = {}) => flowFor(putAwayDay(thingId, options));
const ids = (step) => step.choices.map((choice) => choice.id);
const pick = (flow, id) => { flow.choose(id); flow.next(); };
const choice = (flow, id) => flow.step().choices.find((entry) => entry.id === id);

const PRAISE_KEYS = '✨ Well done! You put your 🔑 keys on the home spot.';
const PRAISE_SCISSORS = '✨ Well done! You put your ✂️ scissors on the home spot.';
const ELSE = { id: 'else', label: 'Something else first' };
const WALK = { id: 'doors', label: 'Walk to another room' };

// ---- the put-away screen ----

test('putting back: no lead, the command names the room and the thing, four ways to answer', () => {
  assert.deepEqual(putFlow().step(), {
    lead: [],
    command: 'You are in the hallway. Put your 🔑 keys back.',
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

test('the put-away screen has no "Something else first": the player is already putting something away', () => {
  assert.equal(ids(putFlow().step()).includes('else'), false);
});

test('the put-away screen never names the plan, whatever the streak: the player chooses from memory', () => {
  for (const [thingId, streak] of [['keys', 0], ['keys', 2], ['keys', 5], ['wallet', 0]]) {
    assert.deepEqual(putFlow(thingId, { streaks: { [thingId]: streak } }).step().lead, [], `${thingId} ${streak}`);
  }
});

// ---- spots, pockets and the coat ----

test('choosing "here" shows the spots of this room, none starred, and a way back', () => {
  const flow = putFlow();
  pick(flow, 'spots');
  assert.equal(flow.step().command, 'Which spot in the hallway?');
  assert.deepEqual(choice(flow, 'spot:hook'), { id: 'spot:hook', label: '🪝 Key hook' });
  assert.deepEqual(choice(flow, 'spot:shoes'), { id: 'spot:shoes', label: '👟 Shoe rack' });
  assert.deepEqual(choice(flow, 'back'), { id: 'back', label: '↩ Choose something else' });
});

test('no spot or pocket is starred, also not the home spot of a thing with a short streak', () => {
  for (const [thingId, menu] of [['keys', 'spots'], ['wallet', 'pockets']]) {
    const flow = putFlow(thingId);
    pick(flow, menu);
    assert.ok(flow.step().choices.every((entry) => entry.mark === undefined), thingId);
  }
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

test('putting a thing on its home spot is praised, and the next thing is asked about', () => {
  const day = makeDay([putAway('keys'), putAway('wallet')], { state: { inHand: ['keys', 'wallet'] } });
  const flow = flowFor(day);
  pick(flow, 'spots');
  pick(flow, 'spot:hook');
  assert.equal(flow.step().praise, PRAISE_KEYS);
  assert.deepEqual(flow.step().lead, []);
  assert.equal(flow.step().command, 'You are in the hallway. Put your 👛 wallet back.');
});

test('putting a thing elsewhere is told with where it went and where its home spot is', () => {
  const day = makeDay([putAway('keys'), putAway('wallet')], { state: { inHand: ['keys', 'wallet'] } });
  const flow = flowFor(day);
  pick(flow, 'spots');
  pick(flow, 'spot:shoes');
  assert.equal(flow.step().lead[0], 'You put your 🔑 keys on the shoe rack. Home spot: on the key hook in the hallway.');
  assert.equal(flow.step().praise ?? null, null);
});

test('a thing put in a pocket is told with the pocket, and a pocket home is named by itself', () => {
  const day = makeDay([putAway('wallet'), putAway('keys')], { state: { inHand: ['wallet', 'keys'] } });
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
  const flow = putFlow('keys');
  pick(flow, 'doors');
  assert.equal(flow.step().command, 'Where do you walk to?');
  assert.deepEqual(flow.step().choices.map((entry) => entry.label), [
    'Living room · 1 step', 'Kitchen · 1 step', 'Toilet · 1 step', 'Landing · 1 step', 'Garden · 1 step',
    'Dining room · 2 steps', 'Bedroom · 2 steps', 'Bathroom · 2 steps', 'Study · 2 steps', 'Garage · 2 steps', 'Shed · 2 steps', 'Car · 2 steps',
    '↩ Choose something else',
  ]);
  assert.equal(ids(flow.step())[1], 'door:kitchen');
});

test('the walk list stars no room and names no plan, also for a thing whose home spot is in another room', () => {
  for (const streak of [0, 2, 5]) {
    const flow = putFlow('phone', { streaks: { phone: streak } });
    pick(flow, 'doors');
    assert.ok(flow.step().choices.every((entry) => entry.mark === undefined), streak);
    assert.deepEqual(flow.step().lead, [], streak);
  }
});

test('walking to a room two doors away arrives there in one action', () => {
  const flow = putFlow();
  pick(flow, 'doors');
  pick(flow, 'door:dining');
  assert.equal(flow.step().command, 'You are in the dining room. Put your 🔑 keys back.');
});

// ---- a tell ----

const KITCHEN = { roomId: 'kitchen', startedIn: 'kitchen' };
const tellDay = (options = {}) => makeDay([tell('kitchen', 'coffee', 'pack'), tell('kitchen', 'coffee', 'open')], { ...options, state: { ...KITCHEN, ...options.state } });

test('a tell is its sentence as the command, with Go on and Something else first', () => {
  assert.deepEqual(flowFor(tellDay()).step(), {
    lead: [],
    command: 'Take a new pack of coffee from the top right cupboard.',
    choices: [{ id: 'go', label: 'Go on' }, ELSE],
    selected: 'go',
    canLeave: true,
  });
});

test('Go on and Next moves the story on', () => {
  const flow = flowFor(tellDay());
  pick(flow, 'go');
  assert.equal(flow.step().command, 'You cut the pack open.');
});

test('on a tell Go on is already selected, so one tap on Next moves on', () => {
  const flow = flowFor(tellDay());
  flow.next();
  assert.equal(flow.step().command, 'You cut the pack open.');
});

test('the next tell has Go on selected again, and Something else first can still be picked', () => {
  const flow = flowFor(tellDay());
  flow.next();
  assert.equal(flow.step().selected, 'go');
  pick(flow, 'else');
  assert.equal(flow.step().command, 'What do you want to do first?');
});

test('no other screen has a default: a walk-to, a find, a put-back, a check and the way back must be chosen', () => {
  const screens = [
    flowFor(goToDay()), flowFor(scissorsFind()), putFlow(), flowFor(checkDay()),
    flowFor(tellDay({ state: { roomId: 'study', startedIn: 'study' } })),
  ];
  for (const flow of screens) assert.equal(flow.step().selected, null, flow.step().command);
  const asking = flowFor(checkDay());
  pick(asking, 'no');
  assert.equal(asking.step().selected, null);
});

test('the prop of a tell is not a thing: nothing about taking it appears except the sentence', () => {
  assert.equal(JSON.stringify(flowFor(tellDay()).step()).includes('Where do you look'), false);
});

test('a pause that opens a later session is a screen with no choices and an enabled Next, and no Something else first', () => {
  const flow = flowFor(makeDay([pause('day'), tell('hall')], { state: { number: 2 } }));
  assert.deepEqual(flow.step(), { lead: ['Everything is where you left it.'], command: 'Session 2.', choices: [], selected: null, canLeave: true });
});

test('the pause that opens the very first session says that this is a new game and everything is in its home spot', () => {
  const flow = flowFor(makeDay([pause('day'), tell('hall')], { state: { number: 1 } }));
  assert.deepEqual(flow.step().lead, ['A new game. Everything is in its home spot.']);
  assert.equal(flow.step().command, 'Session 1.');
});

test('Next on the opening pause moves the day on', () => {
  const flow = flowFor(makeDay([pause('day'), tell('kitchen', 'coffee', 'open')], { state: KITCHEN }));
  flow.next();
  assert.equal(flow.step().command, 'You cut the pack open.');
});

// ---- the text of a move ----

const comingHome = () => flowFor(makeDay([pause('day'), moveTo('hall'), putAway('keys')], { state: { roomId: 'bedroom', startedIn: 'bedroom', inHand: ['keys'] } }));

test('the sentence of a move is the first lead line of the next screen when nothing came before it', () => {
  const flow = comingHome();
  flow.next();
  assert.deepEqual(flow.step().lead, ['You come home and stand at your front door.']);
});

test('the sentence of a move is gone on the screen after, also when you come back to the first question', () => {
  const flow = comingHome();
  flow.next();
  pick(flow, 'spots');
  assert.deepEqual(flow.step().lead, []);
  pick(flow, 'back');
  assert.deepEqual(flow.step().lead, []);
});

test('a day that was saved right after a move shows the sentence of that move again', () => {
  const day = makeDay([pause('day'), moveTo('hall'), putAway('keys')], { state: { roomId: 'bedroom', inHand: ['keys'] } });
  day.continue();
  assert.equal(flowFor(day).step().lead[0], 'You come home and stand at your front door.');
});

// ---- a walk-to ----

const goToDay = (options = {}) => makeDay([goTo('kitchen', 'coffee', 'go'), tell('kitchen', 'coffee', 'open')], { ...options, state: { roomId: 'hall', startedIn: 'hall', ...options.state } });

test('a walk-to has its reason as the lead, the general sentence as the command, and two ways to answer', () => {
  assert.deepEqual(flowFor(goToDay()).step(), {
    lead: ['You feel like coffee.'],
    command: 'Go to the kitchen.',
    choices: [WALK, ELSE],
    selected: null,
    canLeave: true,
  });
});

test('walking to the room of a walk-to ends it and shows the next screen', () => {
  const flow = flowFor(goToDay());
  pick(flow, 'doors');
  pick(flow, 'door:kitchen');
  assert.deepEqual(flow.step().lead, []);
  assert.equal(flow.step().command, 'You cut the pack open.');
});

test('arriving in another room than asked repeats the command and the reason', () => {
  const flow = flowFor(goToDay());
  pick(flow, 'doors');
  pick(flow, 'door:dining');
  assert.deepEqual(flow.step().lead, ['You feel like coffee.']);
  assert.equal(flow.step().command, 'Go to the kitchen.');
});

test('a walk-to for the room you already stand in is skipped and its reason leads the next screen', () => {
  const day = makeDay([tell('hall'), goTo('hall', 'coffee', 'go'), tell('hall', 'coffee', 'open')], { state: { roomId: 'hall' } });
  const flow = flowFor(day);
  pick(flow, 'go');
  assert.deepEqual(flow.step().lead, ['You feel like coffee.']);
  assert.equal(flow.step().command, 'You cut the pack open.');
});

// ---- coming back ----

test('when you walked off from a tell, the screen asks you back and offers only walking', () => {
  const flow = flowFor(tellDay({ state: { roomId: 'study', startedIn: 'study' } }));
  assert.deepEqual(flow.step(), { lead: [], command: 'Go back to the kitchen.', choices: [WALK], selected: null, canLeave: true });
});

test('when you walked off from a check, the screen asks you back too', () => {
  const day = makeDay([check('living', 'coffee', 'drink'), tell('living')], { state: { roomId: 'dining', startedIn: 'dining' } });
  assert.deepEqual(flowFor(day).step().command, 'Go back to the living room.');
  assert.deepEqual(ids(flowFor(day).step()), ['doors']);
});

test('walking back shows the screen of the story again', () => {
  const flow = flowFor(tellDay({ state: { roomId: 'study', startedIn: 'study' } }));
  pick(flow, 'doors');
  pick(flow, 'door:landing');
  pick(flow, 'doors');
  pick(flow, 'door:hall');
  pick(flow, 'doors');
  pick(flow, 'door:kitchen');
  assert.equal(flow.step().command, 'Take a new pack of coffee from the top right cupboard.');
});

// ---- finding ----

const scissorsFind = (options = {}) => makeDay([find('scissors'), tell('kitchen', 'coffee', 'open')], {
  world: worldWith({ scissors: spot('kitchen', 'drawer') }), ...options, state: { ...KITCHEN, ...options.state },
});

test('finding a thing: the sentence of the step is the lead, the command asks for the thing, three ways to answer', () => {
  assert.deepEqual(flowFor(scissorsFind()).step(), {
    lead: ['The pack has to be cut open.'],
    command: 'You need your ✂️ scissors. Where do you look? You are in the kitchen.',
    choices: [
      { id: 'spots', label: 'Look here, in the kitchen' },
      { id: 'pockets', label: 'Look in a pocket' },
      { id: 'doors', label: 'Walk to another room' },
    ],
    selected: null,
    canLeave: true,
  });
});

test('a thing you forgot has no sentence of a step: the lead is empty', () => {
  assert.deepEqual(flowFor(findDay('keys')).step().lead, []);
});

test('the find screen has no Something else first and no coat', () => {
  assert.deepEqual(ids(flowFor(findDay('keys')).step()), ['spots', 'pockets', 'doors']);
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

test('finding a thing tells where it was and what it cost in steps, then the next screen', () => {
  const flow = flowFor(scissorsFind());
  pick(flow, 'spots');
  pick(flow, 'spot:sink');
  pick(flow, 'spots');
  pick(flow, 'spot:drawer');
  assert.deepEqual(flow.step().lead, ['Found your ✂️ scissors in the kitchen drawer. 2 steps.']);
  assert.equal(flow.step().command, 'You cut the pack open.');
});

test('a thing found in a pocket is told with the pocket', () => {
  const world = worldWith({ wallet: pocket('coat', 'coat-inside') });
  const flow = flowFor(makeDay([find('wallet'), putAway('wallet')], { world }));
  pick(flow, 'pockets');
  pick(flow, 'pocket:coat/coat-inside');
  assert.equal(flow.step().lead[0], 'Found your 👛 wallet in the inside pocket of your coat. 1 step.');
});

test('a home pocket of a coat that hangs in another room stars no room in the walk list', () => {
  const flow = putFlow('wallet', { world: worldWith({}, { coat: spot('kitchen', 'counter') }) });
  pick(flow, 'doors');
  assert.ok(flow.step().choices.every((entry) => entry.mark === undefined));
});

// ---- the check ----

const CHECK_SENTENCE = 'You sit down and drink your coffee.';
const checkDay = (options = {}) => makeDay([check('living', 'coffee', 'drink'), tell('living', 'coffee', 'open')], { ...options, state: { roomId: 'living', startedIn: 'living', ...options.state } });

test('the check: the sentence of the step is the lead, the question the command, three ways to answer', () => {
  assert.deepEqual(flowFor(checkDay()).step(), {
    lead: [CHECK_SENTENCE],
    command: 'Is everything back in its place?',
    choices: [{ id: 'yes', label: 'Yes, everything' }, { id: 'no', label: 'No, I forgot something' }, ELSE],
    selected: null,
    canLeave: true,
  });
});

test('after Yes the story goes on with no comment: the lead is exactly what it is with everything in its place', () => {
  const inPlace = flowFor(checkDay({ world: worldWith({ scissors: spot('kitchen', 'drawer') }), plan: defaultPlan() }));
  const onWorktop = flowFor(checkDay({ world: worldWith({ scissors: spot('kitchen', 'counter') }), plan: defaultPlan() }));
  pick(inPlace, 'yes');
  pick(onWorktop, 'yes');
  assert.deepEqual(onWorktop.step(), inPlace.step());
  assert.deepEqual(onWorktop.step().lead, []);
  assert.equal(onWorktop.step().command, 'You cut the pack open.');
});

test('No asks what you forgot, with every chosen thing and a way back', () => {
  const flow = flowFor(checkDay());
  pick(flow, 'no');
  assert.deepEqual(flow.step(), {
    lead: [],
    command: 'What did you forget?',
    choices: [
      { id: 'forgot:keys', label: '🔑 keys' }, { id: 'forgot:wallet', label: '👛 wallet' },
      { id: 'forgot:phone', label: '📱 phone' }, { id: 'forgot:scissors', label: '✂️ scissors' },
      { id: 'back', label: '↩ Choose something else' },
    ],
    selected: null,
    canLeave: true,
  });
});

test('the way back from "What did you forget?" shows the check again', () => {
  const flow = flowFor(checkDay());
  pick(flow, 'no');
  pick(flow, 'back');
  assert.equal(flow.step().command, 'Is everything back in its place?');
});

test('naming the forgotten thing leads to its find, with the normal screen and no sentence of a step', () => {
  const flow = flowFor(checkDay({ world: worldWith({ scissors: spot('kitchen', 'counter') }), plan: defaultPlan() }));
  pick(flow, 'no');
  pick(flow, 'forgot:scissors');
  assert.deepEqual(flow.step().lead, []);
  assert.equal(flow.step().command, 'You need your ✂️ scissors. Where do you look? You are in the living room.');
});

test('after the find of the forgotten thing comes its put-away, and then the story goes on', () => {
  const flow = flowFor(checkDay({ world: worldWith({ scissors: spot('living', 'sofa') }), plan: defaultPlan() }));
  pick(flow, 'no');
  pick(flow, 'forgot:scissors');
  pick(flow, 'spots');
  pick(flow, 'spot:sofa');
  assert.equal(flow.step().command, 'You are in the living room. Put your ✂️ scissors back.');
  pick(flow, 'spots');
  pick(flow, 'spot:sofa');
  assert.equal(flow.step().command, 'You cut the pack open.');
});

// ---- Something else first ----

const handsWith = (...thingIds) => ({ state: { inHand: thingIds } });

test('Something else first: the things in hand, the coat, and Go on', () => {
  const flow = flowFor(tellDay(handsWith('scissors')));
  pick(flow, 'else');
  assert.deepEqual(flow.step(), {
    lead: [],
    command: 'What do you want to do first?',
    choices: [{ id: 'putaway:scissors', label: 'Put my ✂️ scissors away' }, { id: 'hang:coat', label: 'Take off my coat' }, { id: 'back', label: 'Go on' }],
    selected: null,
    canLeave: true,
  });
});

test('with nothing in hand the lead says so and no thing is offered', () => {
  const flow = flowFor(tellDay());
  pick(flow, 'else');
  assert.deepEqual(flow.step().lead, ['You hold nothing.']);
  assert.deepEqual(ids(flow.step()), ['hang:coat', 'back']);
  assert.equal(flow.step().selected, 'back');
});

test('with nothing in hand Go on is already selected, so one tap on Next returns to the story', () => {
  const flow = flowFor(tellDay());
  pick(flow, 'else');
  flow.next();
  assert.equal(flow.step().command, 'Take a new pack of coffee from the top right cupboard.');
});

test('every thing in hand is offered, one choice each', () => {
  const flow = flowFor(tellDay(handsWith('scissors', 'phone')));
  pick(flow, 'else');
  assert.deepEqual(ids(flow.step()), ['putaway:scissors', 'putaway:phone', 'hang:coat', 'back']);
});

test('Go on returns to the screen of the story', () => {
  const flow = flowFor(tellDay());
  pick(flow, 'else');
  pick(flow, 'back');
  assert.equal(flow.step().command, 'Take a new pack of coffee from the top right cupboard.');
});

test('Something else first is on a tell, a walk-to and a check, and not on a find, a put-away or the way back', () => {
  assert.equal(ids(flowFor(tellDay()).step()).includes('else'), true);
  assert.equal(ids(flowFor(goToDay()).step()).includes('else'), true);
  assert.equal(ids(flowFor(checkDay()).step()).includes('else'), true);
  assert.equal(ids(flowFor(scissorsFind()).step()).includes('else'), false);
  assert.equal(ids(putFlow().step()).includes('else'), false);
  assert.equal(ids(flowFor(tellDay({ state: { roomId: 'study', startedIn: 'study' } })).step()).includes('else'), false);
});

test('nothing on a normal screen names what is in hand', () => {
  for (const day of [tellDay(handsWith('scissors')), goToDay(handsWith('scissors')), checkDay(handsWith('scissors'))]) {
    const step = flowFor(day).step();
    assert.equal(/scissors|✂/.test(JSON.stringify(step)), false);
  }
});

test('taking the coat off from Something else first asks where to hang it and then shows the story again', () => {
  const flow = flowFor(tellDay());
  pick(flow, 'else');
  pick(flow, 'hang:coat');
  assert.equal(flow.step().command, 'Where do you hang your coat?');
  pick(flow, 'spot:counter');
  assert.deepEqual(flow.step().lead, ['You hung your coat on the worktop.']);
  assert.equal(flow.step().command, 'Take a new pack of coffee from the top right cupboard.');
  pick(flow, 'else');
  assert.deepEqual(ids(flow.step()), ['puton:coat', 'back']);
});

// ---- putting a thing away on your own ----

const ownPut = (options = {}) => {
  const flow = flowFor(tellDay({ ...handsWith('scissors'), plan: defaultPlan(), ...options }));
  pick(flow, 'else');
  pick(flow, 'putaway:scissors');
  return flow;
};

test('putting a thing away on your own looks like a put-away: no plan, the command, four ways', () => {
  assert.deepEqual(ownPut().step(), {
    lead: [],
    command: 'You are in the kitchen. Put your ✂️ scissors back.',
    choices: [
      { id: 'spots', label: 'Here, in the kitchen' },
      { id: 'pockets', label: 'In a pocket' },
      { id: 'doors', label: 'Walk to another room' },
      { id: 'hang:coat', label: 'Take off my coat' },
      { id: 'back', label: '↩ Choose something else' },
    ],
    selected: null,
    canLeave: true,
  });
});

test('Choose something else on a put-away you started returns to the story with the thing still in hand and nothing changed', () => {
  const day = tellDay({ ...handsWith('scissors') });
  const flow = flowFor(day);
  const before = flow.step();
  pick(flow, 'else');
  pick(flow, 'putaway:scissors');
  pick(flow, 'back');
  assert.deepEqual(flow.step(), before);
  assert.deepEqual(day.state().inHand, ['scissors']);
  assert.deepEqual(day.snapshot().inHand, ['scissors']);
});

test('the guided put-back has no Choose something else at its first question', () => {
  assert.equal(ids(putFlow().step()).includes('back'), false);
});

test('putting away on your own names no plan', () => {
  const flow = flowFor(tellDay({ ...handsWith('scissors'), plan: { ...defaultPlan(), scissors: spot('study', 'desk-drawer') } }));
  pick(flow, 'else');
  pick(flow, 'putaway:scissors');
  assert.deepEqual(flow.step().lead, []);
});

test('the thing put away on your own is told, and the story is on its screen again', () => {
  const flow = ownPut();
  pick(flow, 'spots');
  pick(flow, 'spot:counter');
  assert.deepEqual(flow.step().lead, ['You put your ✂️ scissors on the worktop. Home spot: in the kitchen drawer in the kitchen.']);
  assert.equal(flow.step().command, 'Take a new pack of coffee from the top right cupboard.');
});

test('on the home spot it is praised', () => {
  const flow = ownPut();
  pick(flow, 'spots');
  pick(flow, 'spot:drawer');
  assert.equal(flow.step().praise, PRAISE_SCISSORS);
  assert.deepEqual(flow.step().lead, []);
});

test('putting a thing away in another room, then the screen asks you back', () => {
  const flow = ownPut({ plan: { ...defaultPlan(), scissors: spot('study', 'desk-drawer') } });
  pick(flow, 'doors');
  pick(flow, 'door:study');
  pick(flow, 'spots');
  pick(flow, 'spot:desk-drawer');
  assert.equal(flow.step().praise, PRAISE_SCISSORS);
  assert.equal(flow.step().command, 'Go back to the kitchen.');
  assert.deepEqual(ids(flow.step()), ['doors']);
});

test('a thing put away on your own is reported like any put-away, with the steps of the walk', () => {
  const reported = [];
  const flow = flowFor(tellDay({ ...handsWith('scissors'), plan: { ...defaultPlan(), scissors: spot('study', 'desk-drawer') } }), { onPut: (record) => reported.push(record) });
  pick(flow, 'else');
  pick(flow, 'putaway:scissors');
  pick(flow, 'doors');
  pick(flow, 'door:study');
  pick(flow, 'spots');
  pick(flow, 'spot:desk-drawer');
  assert.deepEqual(reported, [{ thingId: 'scissors', steps: 3, atHome: true, left: false }]);
});

test('a guided put-away of a thing the player put away already is skipped', () => {
  const day = makeDay([tell('kitchen', 'coffee', 'open'), putAway('scissors'), tell('kitchen', 'coffee', 'fill')], { state: { ...KITCHEN, inHand: ['scissors'] } });
  const flow = flowFor(day);
  pick(flow, 'else');
  pick(flow, 'putaway:scissors');
  pick(flow, 'spots');
  pick(flow, 'spot:counter');
  pick(flow, 'go');
  assert.equal(flow.step().command, 'You pour the coffee into the tin and make a pot of filter coffee.');
});

// ---- praise ----

test('a thing put in its home pocket is praised too', () => {
  const flow = flowFor(makeDay([putAway('wallet'), putAway('keys')], { state: { inHand: ['wallet', 'keys'] } }));
  pick(flow, 'pockets');
  pick(flow, 'pocket:coat/coat-inside');
  assert.equal(flow.step().praise, '✨ Well done! You put your 👛 wallet on the home spot.');
});

test('the praise is gone from the screen after the next action', () => {
  const day = makeDay([putAway('keys'), putAway('wallet')], { state: { inHand: ['keys', 'wallet'] } });
  const flow = flowFor(day);
  pick(flow, 'spots');
  pick(flow, 'spot:hook');
  pick(flow, 'spots');
  assert.equal(flow.step().praise ?? null, null);
});

test('a refused move is not praised', () => {
  const flow = putFlow();
  pick(flow, 'doors');
  pick(flow, 'door:dining');
  assert.equal(flow.step().praise ?? null, null);
});

test('finding a thing is not praised, not even on its home spot', () => {
  const world = worldWith({ keys: spot('hall', 'hook') });
  const flow = flowFor(makeDay([find('keys'), putAway('keys')], { world }));
  pick(flow, 'spots');
  pick(flow, 'spot:hook');
  assert.equal(flow.step().praise ?? null, null);
});

test('answering "Yes, everything" at the check is not praised: the app does not say whether it was right', () => {
  const flow = flowFor(checkDay());
  pick(flow, 'yes');
  assert.equal(flow.step().praise ?? null, null);
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

test('the screens of the story come from the injected texts too', () => {
  const texts = { ...TEXTS, goToCommand: () => 'GA', checkCommand: 'KLOPT HET?', goOn: 'DOOR', chains: { ...TEXTS.chains, coffee: { ...TEXTS.chains.coffee, go: 'REDEN' } } };
  assert.deepEqual([new PlayFlow(goToDay(), { texts }).step().command, new PlayFlow(goToDay(), { texts }).step().lead], ['GA', ['REDEN']]);
  assert.equal(new PlayFlow(checkDay(), { texts }).step().command, 'KLOPT HET?');
  assert.equal(new PlayFlow(tellDay(), { texts }).step().choices[0].label, 'DOOR');
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
checkFlowContract('PlayFlow (a check)', () => flowFor(checkDay()));

// ---- reporting what a find, a put-away and a letting go cost ----

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

test('a put-away that ends is reported once, with its steps, whether it was at home, and that it was not let go', () => {
  const { reported, options } = recorder();
  const flow = flowFor(putAwayDay('keys'), options);
  pick(flow, 'spots');
  pick(flow, 'spot:hook');
  assert.deepEqual(reported.put, [{ thingId: 'keys', steps: 0, atHome: true, left: false }]);
  assert.deepEqual(reported.found, []);
});

test('a put-away on another spot after a walk is reported as not at home, with the steps of the walk', () => {
  const { reported, options } = recorder();
  const flow = flowFor(putAwayDay('keys'), options);
  pick(flow, 'doors');
  pick(flow, 'door:living');
  pick(flow, 'spots');
  pick(flow, 'spot:sofa');
  assert.deepEqual(reported.put, [{ thingId: 'keys', steps: 1, atHome: false, left: false }]);
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

test('a thing that was let go is reported as a put-away with no steps, not at home, and left set, before the end is announced', () => {
  const order = [];
  const day = makeDay([tell('kitchen', 'coffee', 'open'), letGo(['scissors'])], {
    state: { ...KITCHEN, inHand: ['scissors'], leftAt: { scissors: spot('kitchen', 'counter') } },
  });
  const flow = flowFor(day, { onPut: (record) => order.push(record), onFinished: () => order.push('finished') });
  pick(flow, 'go');
  assert.deepEqual(order, [{ thingId: 'scissors', steps: 0, atHome: false, left: true }, 'finished']);
  assert.deepEqual(day.world.whereIs('scissors'), spot('kitchen', 'counter'));
});

test('letting go says nothing on the next screen', () => {
  const day = makeDay([tell('kitchen', 'coffee', 'open'), letGo(['scissors']), tell('kitchen', 'coffee', 'fill')], {
    state: { ...KITCHEN, inHand: ['scissors'], leftAt: { scissors: spot('kitchen', 'counter') } },
  });
  const flow = flowFor(day);
  pick(flow, 'go');
  assert.deepEqual(flow.step().lead, []);
});
