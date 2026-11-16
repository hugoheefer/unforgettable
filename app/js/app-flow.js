// The whole app as a series of screens, each with a command and choices: welcome, choosing home spots,
// the round, and the result. Pure: rounds are made by the injected `createRound`, saving by callbacks.

import { PlayFlow } from './play-flow.js';
import { SetupFlow } from './setup-flow.js';
import { choiceNotOffered } from './errors.js';
import { named } from './names.js';

/** A screen with fixed text whose choices lead somewhere. */
class ChoiceScreen {
  constructor({ lead = [], command, choices }, onChoice) {
    this.base = { lead, command, choices };
    this.onChoice = onChoice;
    this.selected = null;
  }

  step() {
    return { ...this.base, selected: this.selected };
  }

  choose(choiceId) {
    if (!this.base.choices.some((choice) => choice.id === choiceId)) throw choiceNotOffered(choiceId);
    this.selected = choiceId;
  }

  next() {
    if (this.selected) this.onChoice(this.selected);
  }
}

const placementKind = (result) => (result.atHome ? 'atHome' : result.forced ? 'interrupted' : 'away');

export class AppFlow {
  /**
   * @param {{ layout: object, items: object[], plan: object, progress: object, texts: object,
   *           createRound: (plan: object, progress: object) => import('./round.js').Round,
   *           onPlanChange: (plan: object) => void, onProgressChange: (progress: object) => void,
   *           onWorldChange: (snapshot: object) => void }} options
   */
  constructor(options) {
    Object.assign(this, options);
    this.current = this.welcome();
  }

  welcome() {
    return new ChoiceScreen(
      {
        command: this.texts.welcome,
        choices: [{ id: 'play', label: this.texts.startPlaying }, { id: 'setup', label: this.texts.chooseHomeSpots }],
      },
      (choice) => {
        this.current = choice === 'play' ? this.startRound() : this.startSetup();
      },
    );
  }

  startRound() {
    this.round = this.createRound(this.plan, this.progress);
    return new PlayFlow(this.round, { texts: this.texts, onFinished: () => this.finishRound() });
  }

  startSetup() {
    return new SetupFlow({ layout: this.layout, items: this.items, plan: this.plan, texts: this.texts, onFinished: () => this.finishSetup() });
  }

  step() {
    return this.current.step();
  }

  choose(choiceId) {
    this.current.choose(choiceId);
  }

  next() {
    this.current.next();
  }

  finishSetup() {
    this.plan = this.current.plan();
    this.onPlanChange(this.plan);
    this.current = this.welcome();
  }

  describeResult(result) {
    const item = this.round.items.find((candidate) => candidate.id === result.itemId);
    return this.texts.results[placementKind(result)]({ thing: named(this.texts.things, item), cost: result.findCost });
  }

  finishRound() {
    this.progress = this.round.progress();
    this.onProgressChange(this.progress);
    this.onWorldChange(this.round.world.snapshot());
    this.current = new ChoiceScreen(
      {
        lead: this.round.results().map((result) => this.describeResult(result)),
        command: this.texts.resultCommand({ score: this.round.state().score }),
        choices: [{ id: 'again', label: this.texts.playAgain }, { id: 'setup', label: this.texts.chooseHomeSpots }],
      },
      (choice) => {
        this.current = choice === 'again' ? this.startRound() : this.startSetup();
      },
    );
  }
}
