// Draws the screens. No game logic here: it turns plain data into elements and reports what the player tapped.

import { describeRoom } from './room-view.js';

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

/** The choice of home spots: one drop-down per item, listing every spot as "Room: spot". */
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
    for (const place of layout.places) {
      const group = el('optgroup');
      group.label = `${place.icon} ${place.name}`;
      for (const spot of place.spots) {
        const option = el('option', '', `${spot.icon} ${spot.name}`);
        option.value = `${place.id}/${spot.id}`;
        option.selected = plan[item.id].placeId === place.id && plan[item.id].spotId === spot.id;
        group.append(option);
      }
      select.append(group);
    }
    select.addEventListener('change', () => {
      const [placeId, spotId] = select.value.split('/');
      onChange(item.id, { placeId, spotId });
    });
    label.append(select);
    screen.append(label);
  }
  screen.append(button('primary', 'Start', onStart));
  return screen;
}

/** The room you stand in, for both putting things down and searching for them. */
export function renderPlay({ round, message, onSpot, onDoor }) {
  const state = round.state();
  const view = describeRoom(round);
  const screen = el('section', 'screen');

  const status = el('div', 'status');
  if (state.phase === 'drop') {
    const item = round.items.find((candidate) => candidate.id === state.holding);
    status.append(
      el('p', 'alarm', `⏱ ${state.pressure}`),
      el('p', 'moves', `Moves left: ${'●'.repeat(state.movesLeft)}${'○'.repeat(round.budget - state.movesLeft)}`),
      el('p', 'task', `You hold your ${item.icon} ${item.name}. Where do you put it?`),
    );
  } else {
    status.append(el('p', 'alarm', state.distraction), el('p', 'task', state.findPrompt));
  }
  if (state.notice) status.append(el('p', 'notice', state.notice));
  if (message) status.append(el('p', 'message', message));
  if (view.hintText) status.append(el('p', 'hint-text', view.hintText));

  const spots = el('div', 'spots');
  for (const spot of view.spots) {
    const tile = button(`spot hint-${spot.hint}`, '', () => onSpot(spot.id));
    tile.append(el('span', 'spot-icon', spot.icon), el('span', 'spot-name', spot.name));
    if (spot.seen.length > 0) tile.append(el('span', 'spot-items', spot.seen.join(' ')));
    spots.append(tile);
  }

  const doors = el('div', 'doors');
  for (const exit of view.exits) doors.append(button('door', `${exit.icon} ${exit.name}`, () => onDoor(exit.id)));

  screen.append(status, el('h2', '', `${view.room.icon} ${view.room.name}`), spots, el('h3', '', 'Go to'), doors);
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
