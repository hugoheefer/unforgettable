// Entry point: connects the app flow to the page. All rules live in the other modules.

import { LAYOUT } from './layout.js';
import { THINGS, defaultPlan } from './things.js';
import { CHAINS } from './chains.js';
import { World } from './world.js';
import { AppFlow } from './app-flow.js';
import { createSaveStore } from './save-store.js';
import { createRandomSource } from './random-source.js';
import { createClock } from './clock.js';
import { emptyProgress } from './habit.js';
import { renderStep, updateSelection } from './screens.js';
import { textsFor } from './texts.js';

const app = document.getElementById('app');
const world = new World(LAYOUT);
const store = createSaveStore(() => window.localStorage, {
  defaults: { plan: defaultPlan(), progress: emptyProgress(), things: THINGS.map((thing) => thing.id), chainIds: CHAINS.map((chain) => chain.id) },
  world: { hasLocation: (location) => world.hasLocation(location), restore: (snapshot) => World.restore(LAYOUT, snapshot) },
});

let save = store.load();
const texts = textsFor(save.language);

const flow = new AppFlow({
  layout: LAYOUT,
  things: THINGS.filter((thing) => save.things.includes(thing.id)),
  texts,
  random: createRandomSource(),
  clock: createClock(),
  saved: save,
  onSave: (state) => {
    save = { ...save, ...state };
    store.save(save);
  },
});

let screen = null;

/** Draws the current screen. A new screen starts at the top and the command gets the focus (Safari, screen readers). */
function showScreen() {
  screen = renderStep(flow.step(), {
    onChoose: (id) => {
      flow.choose(id);
      updateSelection(screen, flow.step());
    },
    onNext: () => {
      flow.next();
      showScreen();
    },
    onLeave: () => {
      flow.leave();
      showScreen();
    },
    onLookBack: () => {
      flow.lookBack();
      showScreen();
    },
  }, texts);
  app.replaceChildren(screen);
  const command = screen.querySelector('.command');
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    command.focus({ preventScroll: true });
  });
}

showScreen();
