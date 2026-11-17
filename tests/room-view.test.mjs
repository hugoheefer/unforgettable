import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeLocation, describeRoom } from '../app/js/room-view.js';
import { TEXTS } from './texts-helper.mjs';
import { check, find, findDay, goTo, makeDay, pocket, putAway, putAwayDay, spot, tell, worldWith } from './day-helper.mjs';

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

test('the view marks no home spot and names no plan: nothing points at where a thing belongs', () => {
  for (const thingId of ['keys', 'wallet', 'phone']) {
    const view = describe(putAwayDay(thingId));
    assert.equal('hintText' in view, false, thingId);
    assert.ok([...view.spots, ...view.rooms, ...view.worn.flatMap((garment) => garment.pockets)].every((entry) => !('hint' in entry)), thingId);
  }
});

test('a coat that hangs in another room gives that room no hint either', () => {
  const view = describe(putAwayDay('wallet', { world: worldWith({}, { coat: spot('kitchen', 'counter') }) }));
  assert.ok(view.rooms.every((room) => !('hint' in room)));
});

test('a day with a pause on screen still describes the room', () => {
  const day = makeDay([{ kind: 'pause', text: 'day' }, putAway('keys')]);
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

test('the coat can come off during a tell, a walk-to and a check as well, not only while putting away', () => {
  for (const event of [tell('hall'), goTo('kitchen'), check('hall')]) {
    const view = describe(makeDay([event, tell('hall')]));
    assert.equal(tile(view.worn, 'coat').canTakeOff, true, event.kind);
    assert.equal(tile(view.worn, 'trousers').canTakeOff, false, event.kind);
  }
});
