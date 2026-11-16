// The whole app as a series of screens, each with a command and choices: welcome, choosing home spots,
// the round, and the result. Pure: rounds are made by the injected `createRound`, saving by callbacks.

import { PlayFlow } from './play-flow.js';
import { SetupFlow } from './setup-flow.js';

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
    if (!this.base.choices.some((choice) => choice.id === choiceId)) throw new Error(`Choice not offered: ${choiceId}`);
    this.selected = choiceId;
  }

  next() {
    if (this.selected) this.onChoice(this.selected);
  }
}

const describeResult = (round, result) => {
  const item = round.items.find((candidate) => candidate.id === result.itemId);
  const where = result.atHome ? 'put on its home spot' : result.forced ? 'left where you were interrupted' : 'put away from its home spot';
  return `${item.icon} ${item.name}: ${where}; found with ${result.findCost} moves.`;
};

export class AppFlow {
  /**
   * @param {{ layout: object, items: object[], plan: object, progress: object,
   *           createRound: (plan: object, progress: object) => import('./round.js').Round,
   *           onPlanChange: (plan: object) => void, onProgressChange: (progress: object) => void }} options
   */
  constructor(options) {
    Object.assign(this, options);
    this.current = this.welcome();
  }

  welcome() {
    return new ChoiceScreen(
      {
        command: 'Unforgettable. Learn to always put your things in the same place.',
        choices: [{ id: 'play', label: 'Start playing' }, { id: 'setup', label: 'Choose my home spots' }],
      },
      (choice) => {
        this.current = choice === 'play' ? this.startRound() : this.startSetup();
      },
    );
  }

  startRound() {
    this.round = this.createRound(this.plan, this.progress);
    return new PlayFlow(this.round, { onFinished: () => this.finishRound() });
  }

  startSetup() {
    return new SetupFlow({ layout: this.layout, items: this.items, plan: this.plan, onFinished: () => this.finishSetup() });
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

  finishRound() {
    this.progress = this.round.progress();
    this.onProgressChange(this.progress);
    this.current = new ChoiceScreen(
      {
        lead: this.round.results().map((result) => describeResult(this.round, result)),
        command: `Round finished. Score: ${this.round.state().score}`,
        choices: [{ id: 'again', label: 'Play again' }, { id: 'setup', label: 'Choose my home spots' }],
      },
      (choice) => {
        this.current = choice === 'again' ? this.startRound() : this.startSetup();
      },
    );
  }
}
