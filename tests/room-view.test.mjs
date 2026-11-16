import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeLocation, describeRoom } from '../app/js/room-view.js';
import { TEXTS } from './texts-helper.mjs';
import { find, findDay, makeDay, pocket, putAway, putAwayDay, spot, worldWith } from './day-helper.mjs';

const describe = (day) => describeRoom(day, TEXTS);
const tile = (tiles, id) => tiles.find((entry) => entry.id === id);

test('the view shows the room you are in and its spots', () => {
  const view = describe(putAwayDay('keys'));
  assert.equal(view.room.name, 'Hallway');
  assert.ok(view.spots.some((entry) => entry.id === 'hook'));
});

test('the view has no instruction and no verb any more: the flow says what to do', () => {
  const view = describe(putAwayDay('keys'));
  assert.equal('instruction' in view, false);
  assert.equal('verb' in view, false);
});

test('the view lists every other room with its distance, nearest first, then in the order of the layout', () => {
  const view = describe(putAwayDay('keys'));
  assert.deepEqual(view.rooms.slice(0, 7).map((room) => [room.id, room.steps]),
    [['living', 1], ['kitchen', 1], ['toilet', 1], ['landing', 1], ['garden', 1], ['dining', 2], ['bedroom', 2]]);
  assert.equal(view.rooms.length, 12);
});

test('in a hurry only rooms at one step are listed', () => {
  const view = describe(putAwayDay('keys', { hurry: 'pan' }));
  assert.deepEqual(view.rooms.map((room) => room.id), ['living', 'kitchen', 'toilet', 'landing', 'garden']);
});

test('the view shows what you wear, with its pockets', () => {
  const view = describe(putAwayDay('keys'));
  assert.deepEqual(view.worn.map((garment) => garment.id), ['coat', 'trousers']);
  assert.deepEqual(tile(view.worn, 'coat').pockets.map((entry) => entry.id), ['coat-left', 'coat-right', 'coat-inside']);
});

test('a coat that can come off offers it while putting away, trousers never, and nothing while finding', () => {
  const putting = describe(putAwayDay('keys'));
  assert.equal(tile(putting.worn, 'coat').canTakeOff, true);
  assert.equal(tile(putting.worn, 'trousers').canTakeOff, false);
  assert.equal(tile(describe(findDay('keys')).worn, 'coat').canTakeOff, false);
});

test('a coat that hangs in this room is shown there with its pockets, and can be put on', () => {
  const day = putAwayDay('keys');
  day.takeOff('coat', 'coat-hooks');
  const view = describe(day);
  assert.deepEqual(view.worn.map((garment) => garment.id), ['trousers']);
  assert.equal(tile(view.hanging, 'coat').onSpot, 'coat-hooks');
  assert.equal(tile(view.hanging, 'coat').pockets.length, 3);
  assert.equal(tile(view.hanging, 'coat').canPutOn, true);
});

test('a coat that hangs in another room is not shown here', () => {
  const day = putAwayDay('keys', { world: worldWith({}, { coat: spot('kitchen', 'counter') }) });
  assert.deepEqual(describe(day).hanging, []);
});

test('while putting away, the things you left on a spot or in a pocket are visible there', () => {
  const world = worldWith({ wallet: spot('hall', 'shoes'), phone: pocket('coat', 'coat-right') });
  const view = describe(putAwayDay('keys', { world }));
  assert.deepEqual(tile(view.spots, 'shoes').seen, ['👛']);
  assert.deepEqual(tile(tile(view.worn, 'coat').pockets, 'coat-right').seen, ['📱']);
});

test('while finding, a pocket shows its things only after you looked in it', () => {
  const world = worldWith({ keys: spot('living', 'sofa'), wallet: pocket('coat', 'coat-right'), phone: pocket('coat', 'coat-right') });
  const day = findDay('keys', { world });
  const seen = () => tile(tile(describe(day).worn, 'coat').pockets, 'coat-right').seen;
  assert.deepEqual(seen(), []);
  day.lookInPocket('coat', 'coat-right');
  assert.deepEqual(seen(), ['👛', '📱']);
});

test('with a short streak the home spot is named and marked', () => {
  const view = describe(putAwayDay('keys'));
  assert.equal(tile(view.spots, 'hook').hint, 'shown');
  assert.equal(view.hintText, 'Your plan: on the key hook in the hallway.');
});

test('a home pocket of a garment within reach is marked, and named by itself in the hint', () => {
  const view = describe(putAwayDay('wallet'));
  assert.equal(tile(tile(view.worn, 'coat').pockets, 'coat-inside').hint, 'shown');
  assert.equal(view.hintText, 'Your plan: in the inside pocket of your coat.');
});

test('the room of the home spot gets the hint in the list of rooms', () => {
  const view = describe(putAwayDay('phone'));
  assert.equal(tile(view.rooms, 'kitchen').hint, 'shown');
  assert.equal(tile(view.rooms, 'living').hint, 'hidden');
});

test('the room where the coat with the home pocket hangs gets the hint, a worn coat gives no room a hint', () => {
  const hanging = describe(putAwayDay('wallet', { world: worldWith({}, { coat: spot('kitchen', 'counter') }) }));
  assert.equal(tile(hanging.rooms, 'kitchen').hint, 'shown');
  assert.ok(describe(putAwayDay('wallet')).rooms.every((room) => room.hint === 'hidden'));
});

test('with a middle streak the home spot is only marked, not named', () => {
  const view = describe(putAwayDay('keys', { streaks: { keys: 2 } }));
  assert.equal(tile(view.spots, 'hook').hint, 'dimmed');
  assert.equal(view.hintText, '');
});

test('with a long streak nothing is hinted: memory has to do the work', () => {
  const view = describe(putAwayDay('phone', { streaks: { phone: 4 } }));
  assert.equal(view.hintText, '');
  assert.ok(view.rooms.every((room) => room.hint === 'hidden'));
});

test('nothing is hinted while finding', () => {
  const view = describe(findDay('keys'));
  assert.ok(view.spots.every((entry) => entry.hint === 'hidden'));
  assert.equal(view.hintText, '');
});

test('a day with a pause on screen still describes the room', () => {
  const day = makeDay([{ kind: 'pause', text: 'day' }, putAway('keys')]);
  assert.equal(describe(day).hintText, '');
  assert.equal(describe(day).room.name, 'Hallway');
});

test('a location is told with its room for a spot, and by itself for a pocket', () => {
  const day = putAwayDay('keys');
  assert.equal(describeLocation(day, spot('hall', 'hook'), TEXTS), 'on the key hook in the hallway');
  assert.equal(describeLocation(day, spot('hall', 'hook'), TEXTS, { withRoom: false }), 'on the key hook');
  assert.equal(describeLocation(day, pocket('coat', 'coat-inside'), TEXTS), 'in the inside pocket of your coat');
  assert.equal(describeLocation(day, pocket('coat', 'coat-inside'), TEXTS, { withRoom: false }), 'in the inside pocket of your coat');
});

test('the view works for a find event too', () => {
  const day = makeDay([find('keys'), putAway('keys')]);
  assert.equal(describe(day).room.name, 'Hallway');
});
