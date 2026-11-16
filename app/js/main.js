// Entry point: connects the game to the page. Holds which screen is showing; all rules live in the other modules.

import { LAYOUT, ITEMS, DEFAULT_PLAN } from './layout.js';
import { World } from './world.js';
import { Round } from './round.js';
import { createSaveStore } from './save-store.js';
import { createRandomSource } from './random-source.js';
import { renderSetup, renderPlay, renderDone } from './screens.js';

const app = document.getElementById('app');
const world = new World(LAYOUT);
const store = createSaveStore(() => window.localStorage, {
  defaults: { plan: DEFAULT_PLAN, progress: { streaks: {} } },
  spotExists: (location) => world.hasSpot(location),
});

let save = store.load();
let round = null;
let message = '';

function show(screen) {
  app.replaceChildren(screen);
}

function showSetup() {
  show(renderSetup({
    layout: LAYOUT,
    items: ITEMS,
    plan: save.plan,
    onChange: (itemId, location) => {
      save = { ...save, plan: { ...save.plan, [itemId]: location } };
      store.save(save);
    },
    onStart: startRound,
  }));
}

function startRound() {
  round = new Round({ layout: LAYOUT, items: ITEMS, plan: save.plan, random: createRandomSource(), progress: save.progress });
  message = '';
  refresh();
}

function refresh() {
  if (round.state().phase === 'done') {
    save = { ...save, progress: round.progress() };
    store.save(save);
    show(renderDone({ round, onAgain: startRound, onPlan: showSetup }));
    return;
  }
  show(renderPlay({ round, message, onSpot: tapSpot, onDoor: tapDoor }));
}

function tapSpot(spotId) {
  const { phase, findItem } = round.state();
  message = '';
  if (phase === 'drop') {
    round.putDown(spotId);
  } else {
    const outcome = round.open(spotId);
    const name = ITEMS.find((item) => item.id === findItem).name;
    message = outcome.found ? `Found your ${name}!` : 'Not here.';
  }
  refresh();
}

function tapDoor(roomId) {
  message = '';
  round.walkTo(roomId);
  refresh();
}

showSetup();
