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
  locationExists: (location) => world.hasLocation(location),
});

let save = store.load();
let round = null;
let message = '';
let hangingGarmentId = null; // set while the player is choosing where to hang a garment

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
  hangingGarmentId = null;
  refresh();
}

function refresh() {
  if (round.state().phase === 'done') {
    save = { ...save, progress: round.progress() };
    store.save(save);
    show(renderDone({ round, onAgain: startRound, onPlan: showSetup }));
    return;
  }
  show(renderPlay({ round, message, hangingGarmentId, handlers }));
}

/** Runs one tap; a refused move (for example a pocket out of reach) shows its reason instead of crashing. */
function act(move) {
  message = '';
  try {
    move();
  } catch (error) {
    message = error.message;
  }
  refresh();
}

const findingName = () => ITEMS.find((item) => item.id === round.state().findItem)?.name;

function reportLook(outcome, name) {
  message = outcome.found ? `Found your ${name}!` : 'Not here.';
}

const handlers = {
  onSpot: (spotId) => act(() => {
    if (hangingGarmentId) {
      const garmentId = hangingGarmentId;
      hangingGarmentId = null;
      round.takeOff(garmentId, spotId);
    } else if (round.state().phase === 'drop') {
      round.putDown(spotId);
    } else {
      const name = findingName();
      reportLook(round.open(spotId), name);
    }
  }),
  onPocket: (garmentId, pocketId) => act(() => {
    hangingGarmentId = null;
    if (round.state().phase === 'drop') {
      round.putInPocket(garmentId, pocketId);
    } else {
      const name = findingName();
      reportLook(round.openPocket(garmentId, pocketId), name);
    }
  }),
  onDoor: (roomId) => act(() => {
    hangingGarmentId = null;
    round.walkTo(roomId);
  }),
  onTakeOff: (garmentId) => act(() => { hangingGarmentId = garmentId; }),
  onCancel: () => act(() => { hangingGarmentId = null; }),
  onPutOn: (garmentId) => act(() => round.putOn(garmentId)),
};

showSetup();
