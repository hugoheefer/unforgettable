import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUT } from '../app/js/layout.js';
import { LANGUAGES, textsFor } from '../app/js/texts.js';
import { REFUSALS } from '../app/js/errors.js';
import { THINGS } from '../app/js/things.js';
import { CHAINS } from '../app/js/chains.js';
import { ADVICE } from '../app/js/summary.js';
import { TEXTS } from './texts-helper.mjs';

const ids = (list) => list.map((entry) => entry.id);

/** Every form a sentence may need, per kind of name (see "Rules for texts" in stories.md). */
const FORMS = {
  things: ['name', 'your'],
  rooms: ['name', 'in', 'to'],
  spots: ['name', 'at'],
  garments: ['name', 'your', 'my'],
  pockets: ['name', 'at'],
};

function missingForms(kind, entryIds) {
  const missing = [];
  for (const id of entryIds) {
    const entry = TEXTS[kind]?.[id];
    for (const form of FORMS[kind]) {
      if (typeof entry?.[form] !== 'string' || entry[form].length === 0) missing.push(`${kind}.${id}.${form}`);
    }
  }
  return missing;
}

const kindOf = (value) => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value);

function mismatches(reference, other, path = '') {
  const found = [];
  for (const key of Object.keys(reference)) {
    const here = `${path}${key}`;
    if (!(key in other)) found.push(`${here} is missing`);
    else if (kindOf(other[key]) !== kindOf(reference[key])) found.push(`${here} is a ${kindOf(other[key])}, not a ${kindOf(reference[key])}`);
    else if (kindOf(reference[key]) === 'object') found.push(...mismatches(reference[key], other[key], `${here}.`));
  }
  return found;
}

test('every thing of the layout has all its forms in the texts', () => {
  assert.deepEqual(missingForms('things', ids(THINGS)), []);
});

test('every room of the layout has all its forms in the texts', () => {
  assert.deepEqual(missingForms('rooms', ids(LAYOUT.places)), []);
});

test('every spot of the layout has all its forms in the texts', () => {
  assert.deepEqual(missingForms('spots', LAYOUT.places.flatMap((place) => ids(place.spots))), []);
});

test('every garment of the layout has all its forms in the texts', () => {
  assert.deepEqual(missingForms('garments', ids(LAYOUT.garments)), []);
});

test('every pocket of the layout has all its forms in the texts', () => {
  assert.deepEqual(missingForms('pockets', LAYOUT.garments.flatMap((garment) => ids(garment.pockets))), []);
});

test('every refusal of the game has a sentence for the player', () => {
  const missing = Object.keys(REFUSALS).filter((code) => typeof TEXTS.refusals?.[code] !== 'string' || TEXTS.refusals[code].length === 0);
  assert.deepEqual(missing, []);
});

test('an unknown language code gives English', () => {
  assert.equal(textsFor('xx'), textsFor('en'));
});

test('English is in the table of languages under its code', () => {
  const english = LANGUAGES.find((language) => language.code === 'en');
  assert.equal(english.texts, textsFor('en'));
});

for (const language of LANGUAGES) {
  test(`${language.name} has every key of English, of the same kind`, () => {
    assert.deepEqual(mismatches(textsFor('en'), language.texts), []);
  });
}

test('the check of languages notices a missing key and a key of the wrong kind', () => {
  const broken = { ...TEXTS, notHere: () => 'x', next: undefined };
  delete broken.back;
  assert.deepEqual(mismatches(TEXTS, broken).sort(), ['back is missing', 'next is a undefined, not a string', 'notHere is a function, not a string']);
});

const isSentence = (value) => typeof value === 'string' && value.length > 0;

test('the sentences of the rules that are gone are gone: uses, hurry, the home and away lines, the old arrivals', () => {
  const left = ['uses', 'hurryReasons', 'hurryLine', 'homeLine', 'awayLine', 'arrivals'].filter((key) => key in TEXTS);
  assert.deepEqual(left, []);
  assert.deepEqual(Object.keys(TEXTS.pauses), ['day']);
  assert.deepEqual(Object.keys(TEXTS.refusals).filter((code) => code.includes('hurry')), []);
});

test('being asked to come back is a refusal with a sentence', () => {
  assert.equal(typeof REFUSALS['come-back'], 'string');
  assert.ok(isSentence(TEXTS.refusals['come-back']));
  assert.equal('too-far-in-a-hurry' in REFUSALS, false);
});

test('the spot where the scissors stay in the coffee chain is called the worktop', () => {
  assert.deepEqual(TEXTS.spots.counter, { name: 'Worktop', at: 'on the worktop' });
});

test('the command of a walk-to and of coming back are one general sentence built from the room', () => {
  const room = TEXTS.rooms.kitchen;
  assert.equal(TEXTS.goToCommand({ room }), 'Go to the kitchen.');
  assert.equal(TEXTS.goBackCommand({ room }), 'Go back to the kitchen.');
});

test('the pause that opens a day has a text', () => {
  assert.equal(TEXTS.pauses.day({ number: 4 }), 'Day 4.');
});

// ---- the sentences of the chains ----

const sentenceOf = (chain, step) => {
  const sentence = TEXTS.chains?.[chain]?.[step];
  return typeof sentence === 'function' ? sentence({ things: TEXTS.things }) : sentence;
};

/** The sentences of the story (section 4), word for word; a step without a sentence is not in the table. */
const CHAIN_SENTENCES = {
  'come-home': {
    door: 'You come home and stand at your front door.',
    keys: 'You need your keys to get in.',
    inside: 'You open the door. You are inside.',
    shoes: 'You take off your shoes.',
  },
  'go-out': {
    start: 'You are in the hallway.',
    plan: 'You are going out for some shopping.',
    keys: 'You cannot leave without your keys.',
    away: 'You lock the door. An hour later you are back with a full bag.',
    inside: 'You open the door. You are inside.',
    bag: 'You put the shopping bag down.',
    unpack: 'The shopping belongs in the kitchen.',
    done: 'Everything is unpacked.',
  },
  coffee: {
    go: 'You feel like coffee.',
    pack: 'Take a new pack of coffee from the top right cupboard.',
    scissors: 'The pack has to be cut open.',
    open: 'You cut the pack open.',
    tin: 'Take the tin with the flowers from the worktop.',
    fill: 'You pour the coffee into the tin and make a pot of filter coffee.',
    'tin-back': 'You put the lid on the tin and put the tin back in the cupboard.',
    sit: 'You want to drink your coffee in the living room.',
    drink: 'You sit down and drink your coffee.',
  },
  present: {
    go: 'A birthday present has to be wrapped at the dining table.',
    paper: 'Take the wrapping paper from the sideboard.',
    scissors: 'The paper has to be cut.',
    wrap: 'You cut the paper and wrap the present.',
    phone: 'You want to ask what time the party starts.',
    call: 'The party starts at eight.',
    'paper-back': 'You put the rest of the paper back in the sideboard.',
    hall: 'The present has to stand ready in the hallway.',
    ready: 'The present stands ready by the door.',
  },
  pizza: {
    start: 'You are in the living room.',
    bell: 'The doorbell rings: your pizza is here.',
    go: 'Someone has to open the front door.',
    wallet: 'The pizza has to be paid.',
    pay: 'You pay and take the pizza.',
    table: 'The pizza goes on the dining table.',
    eat: 'The pizza is on the table.',
  },
  call: {
    start: 'You are in the living room.',
    ring: 'Somewhere your phone rings.',
    phone: 'You want to answer the call.',
    walk: 'You talk and walk around. The call ends in the garden.',
    in: 'It gets chilly outside.',
    sit: 'You sit down on the sofa.',
  },
};

for (const [chain, steps] of Object.entries(CHAIN_SENTENCES)) {
  test(`the sentences of the chain ${chain} are the ones of the story`, () => {
    assert.deepEqual(Object.fromEntries(Object.keys(steps).map((step) => [step, sentenceOf(chain, step)])), steps);
  });

  test(`the chain ${chain} has no other sentences than the ones of the story`, () => {
    assert.deepEqual(Object.keys(TEXTS.chains?.[chain] ?? {}).sort(), Object.keys(steps).sort());
  });
}

test('the chains in the texts are the six chains of the list', () => {
  assert.deepEqual(Object.keys(TEXTS.chains ?? {}).sort(), ['call', 'coffee', 'come-home', 'go-out', 'pizza', 'present']);
  assert.deepEqual(Object.keys(TEXTS.chains ?? {}).sort(), CHAINS.map((chain) => chain.id).sort());
});

// ---- the summary of a day ----

test('every advice that the summary can give has a sentence', () => {
  assert.deepEqual(ADVICE.filter((row) => typeof TEXTS.advice?.[row.key] !== 'function'), []);
  assert.ok(ADVICE.length > 0, 'the summary has advice rows');
});

test('the searching line says one step in the singular and several in the plural', () => {
  assert.equal(TEXTS.searchedLine({ searched: 9, possible: 4 }), 'Searching cost 9 steps today. Going straight to each thing: 4.');
  assert.equal(TEXTS.searchedLine({ searched: 1, possible: 1 }), 'Searching cost 1 step today. Going straight to each thing: 1.');
});

test('the putting-away line says one step in the singular and several in the plural', () => {
  assert.equal(TEXTS.puttingLine({ steps: 5 }), 'Putting things away cost 5 steps.');
  assert.equal(TEXTS.puttingLine({ steps: 1 }), 'Putting things away cost 1 step.');
  assert.equal(TEXTS.puttingLine({ steps: 0 }), 'Putting things away cost 0 steps.');
});

test('the advice sentences are the ones of the story', () => {
  assert.equal(TEXTS.advice.noSearch(), 'Nothing to search for today.');
  assert.equal(TEXTS.advice.costly(), "Most of today's steps went into searching. A fixed place costs a few steps once.");
  assert.equal(TEXTS.advice.straight(), 'You went straight to your things. That is what a fixed place gives you.');
  assert.deepEqual(Object.keys(TEXTS.advice).sort(), ['costly', 'noSearch', 'straight']);
});

test('the line about coming back tomorrow is the one of the story', () => {
  assert.equal(TEXTS.comeBackTomorrow, 'Come back tomorrow. A night in between is the real test.');
});

// ---- the screens of a day ----

const keys = { ...TEXTS.things.keys, icon: '🔑' };
const hall = TEXTS.rooms.hall;

test('the command to find a thing names it with its icon and asks where to look, without a pronoun that depends on the thing', () => {
  assert.equal(TEXTS.findCommand({ room: hall, thing: keys }), 'You need your 🔑 keys. Where do you look? You are in the hallway.');
});

test('the command to put a thing back names the room and the thing', () => {
  assert.equal(TEXTS.putCommand({ room: hall, thing: keys }), 'You are in the hallway. Put your 🔑 keys back.');
});

test('the labels of the tell, the check and Something else first are the ones of the story', () => {
  assert.deepEqual(
    [TEXTS.goOn, TEXTS.somethingElse, TEXTS.elseCommand, TEXTS.holdNothing, TEXTS.checkCommand, TEXTS.yesEverything, TEXTS.noForgot, TEXTS.forgotCommand],
    ['Go on', 'Something else first', 'What do you want to do first?', 'You hold nothing.', 'Is everything back in its place?', 'Yes, everything', 'No, I forgot something', 'What did you forget?'],
  );
});

test('the choices that name a thing carry its icon and name', () => {
  assert.equal(TEXTS.putMineAway({ thing: keys }), 'Put my 🔑 keys away');
  assert.equal(TEXTS.forgotOption({ thing: keys }), '🔑 keys');
});
