// Draws the screens. No game logic here: it turns plain data into elements and reports what the player tapped.

import { describeRoom } from './room-view.js';
import { locationKey, parseLocationKey, sameLocation } from './world.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, text, onClick) {
  const node = el('button', className, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function option(label, location, chosen) {
  const node = el('option', '', label);
  node.value = locationKey(location);
  node.selected = sameLocation(location, chosen);
  return node;
}

function group(label, options) {
  const node = el('optgroup');
  node.label = label;
  node.append(...options);
  return node;
}

/** The choice of home spots: one drop-down per item, listing every spot and pocket. */
export function renderSetup({ layout, items, plan, onChange, onStart }) {
  const screen = el('section', 'screen');
  screen.append(
    el('h1', '', 'Unforgettable'),
    el('p', 'lead', 'Choose a fixed home for each of your things. Then put them there every time, and you never have to search.'),
  );
  for (const item of items) {
    const label = el('label', 'plan-row');
    label.append(el('span', 'plan-item', `${item.icon} ${item.name}`));
    const select = el('select');
    for (const place of layout.places)
      select.append(group(`${place.icon} ${place.name}`, place.spots.map((spot) => option(`${spot.icon} ${spot.name}`, { placeId: place.id, spotId: spot.id }, plan[item.id]))));
    for (const garment of layout.garments)
      select.append(group(`${garment.icon} ${garment.name}`, garment.pockets.map((pocket) => option(`${pocket.icon} ${pocket.name}`, { garmentId: garment.id, pocketId: pocket.id }, plan[item.id]))));
    select.addEventListener('change', () => onChange(item.id, parseLocationKey(select.value)));
    label.append(select);
    screen.append(label);
  }
  screen.append(button('primary', 'Start', onStart));
  return screen;
}

/** A square the player taps: a spot in the room or a pocket. */
function tileButton(entry, verb, onTap) {
  const tile = button(`spot hint-${entry.hint}`, '', onTap);
  tile.append(el('span', 'spot-icon', entry.icon), el('span', 'spot-name', entry.name), el('span', 'spot-verb', verb));
  if (entry.seen.length > 0) tile.append(el('span', 'spot-items', entry.seen.join(' ')));
  return tile;
}

function garmentPanel(garment, { title, verb, actions, onPocket }) {
  const panel = el('div', 'garment');
  const head = el('div', 'garment-head');
  head.append(el('strong', '', `${garment.icon} ${title}`), ...actions);
  const pockets = el('div', 'spots pockets');
  for (const pocket of garment.pockets) pockets.append(tileButton(pocket, verb, () => onPocket(garment.id, pocket.id)));
  panel.append(head, pockets);
  return panel;
}

/** The room you stand in and what you wear, for both putting things down and searching for them. */
export function renderPlay({ round, message, hangingGarmentId, handlers }) {
  const state = round.state();
  const view = describeRoom(round);
  const hanging = hangingGarmentId ? round.garmentOf(hangingGarmentId) : null;
  const verb = hanging ? 'Hang here' : view.verb;
  const screen = el('section', 'screen');

  const instruction = hanging ? `Where do you hang your ${hanging.icon} ${hanging.name}? Tap a spot in this room.` : view.instruction;
  const banner = el('div', 'instruction');
  banner.append(el('p', 'instruction-text', instruction));
  if (hanging) banner.append(button('secondary', 'Cancel', handlers.onCancel));

  const status = el('div', 'status');
  if (state.phase === 'drop') {
    status.append(
      el('p', 'alarm', `⏱ ${state.pressure}`),
      el('p', 'moves', `Moves left: ${'●'.repeat(state.movesLeft)}${'○'.repeat(round.budget - state.movesLeft)}  (walking and taking off a coat cost one)`),
    );
  } else {
    status.append(el('p', 'alarm', state.distraction), el('p', 'task', state.findPrompt));
  }
  if (state.notice) status.append(el('p', 'notice', state.notice));
  if (message) status.append(el('p', 'message', message));
  if (view.hintText) status.append(el('p', 'hint-text', view.hintText));

  const wearing = el('div', 'wearing');
  wearing.append(el('h3', '', 'You wear'));
  for (const garment of view.worn) {
    const actions = garment.canTakeOff ? [button('small', 'Take off', () => handlers.onTakeOff(garment.id))] : [];
    wearing.append(garmentPanel(garment, { title: garment.name, verb, actions, onPocket: handlers.onPocket }));
  }

  const spots = el('div', 'spots');
  for (const spot of view.spots) spots.append(tileButton(spot, verb, () => handlers.onSpot(spot.id)));

  const here = el('div', 'hanging-here');
  for (const garment of view.hanging) {
    const where = round.roomOf(view.room.id).spots.find((spot) => spot.id === garment.onSpot).name;
    here.append(garmentPanel(garment, {
      title: `${garment.name} hangs on the ${where}`,
      verb,
      actions: [button('small', 'Put on', () => handlers.onPutOn(garment.id))],
      onPocket: handlers.onPocket,
    }));
  }

  const doors = el('div', 'doors');
  for (const exit of view.exits) doors.append(button('door', `${exit.icon} ${exit.name}`, () => handlers.onDoor(exit.id)));

  screen.append(banner, status, el('h2', '', `${view.room.icon} You are in: ${view.room.name}`), spots, here, el('h3', '', 'Go to'), doors, wearing);
  return screen;
}

export function renderDone({ round, onAgain, onPlan }) {
  const screen = el('section', 'screen');
  screen.append(el('h1', '', `Score: ${round.state().score}`));
  const list = el('ul', 'results');
  for (const result of round.results()) {
    const item = round.items.find((candidate) => candidate.id === result.itemId);
    const where = result.atHome ? 'on its home spot' : result.forced ? 'wherever you were when interrupted' : 'away from its home spot';
    list.append(el('li', result.atHome ? 'good' : 'bad', `${item.icon} ${item.name}: put ${where}; found with ${result.findCost} moves.`));
  }
  screen.append(list, el('p', 'lead', 'Items on their home spot are found at once. Keep doing that and the hints fade away.'));
  screen.append(button('primary', 'Play again', onAgain), button('secondary', 'Change my home spots', onPlan));
  return screen;
}
