// Entry point: connects the app flow to the page. All rules live in the other modules.

import { LAYOUT, ITEMS, DEFAULT_PLAN } from './layout.js';
import { World } from './world.js';
import { Round } from './round.js';
import { AppFlow } from './app-flow.js';
import { createSaveStore } from './save-store.js';
import { createRandomSource } from './random-source.js';
import { renderStep } from './screens.js';
import { textsFor } from './texts.js';

const app = document.getElementById('app');
const world = new World(LAYOUT);
const store = createSaveStore(() => window.localStorage, {
  defaults: { plan: DEFAULT_PLAN, progress: { streaks: {} }, things: ITEMS.map((item) => item.id) },
  world: { hasLocation: (location) => world.hasLocation(location), restore: (snapshot) => World.restore(LAYOUT, snapshot) },
});

let save = store.load();
const texts = textsFor('en');

const flow = new AppFlow({
  layout: LAYOUT,
  items: ITEMS,
  plan: save.plan,
  progress: save.progress,
  texts,
  createRound: (plan, progress) => new Round({ layout: LAYOUT, items: ITEMS, plan, random: createRandomSource(), progress, texts }),
  onPlanChange: (plan) => {
    save = { ...save, plan };
    store.save(save);
  },
  onProgressChange: (progress) => {
    save = { ...save, progress };
    store.save(save);
  },
  onWorldChange: (snapshot) => {
    save = { ...save, world: snapshot };
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
  }, texts));
}

render();
