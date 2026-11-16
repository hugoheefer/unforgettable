// Entry point: connects the app flow to the page. All rules live in the other modules.

import { LAYOUT } from './layout.js';
import { THINGS, defaultPlan } from './things.js';
import { World } from './world.js';
import { AppFlow } from './app-flow.js';
import { createSaveStore } from './save-store.js';
import { createRandomSource } from './random-source.js';
import { renderStep } from './screens.js';
import { textsFor } from './texts.js';

const app = document.getElementById('app');
const world = new World(LAYOUT);
const store = createSaveStore(() => window.localStorage, {
  defaults: { plan: defaultPlan(), progress: { streaks: {} }, things: THINGS.map((thing) => thing.id) },
  world: { hasLocation: (location) => world.hasLocation(location), restore: (snapshot) => World.restore(LAYOUT, snapshot) },
});

let save = store.load();
const texts = textsFor(save.language);

const flow = new AppFlow({
  layout: LAYOUT,
  things: THINGS.filter((thing) => save.things.includes(thing.id)),
  texts,
  random: createRandomSource(),
  saved: save,
  onSave: (state) => {
    save = { ...save, ...state };
    store.save(save);
  },
});

function render() {
  app.replaceChildren(renderStep(flow.step(), {
    onChoose: (id) => {
      flow.choose(id);
      render();
    },
    onNext: () => {
      flow.next();
      render();
      window.scrollTo(0, 0);
    },
    onLeave: () => {
      flow.leave();
      render();
      window.scrollTo(0, 0);
    },
  }, texts));
}

render();
