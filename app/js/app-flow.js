// The whole app as a series of screens, each with a command and choices: the start screen, choosing home
// spots, the days, and the end of a day. Pure: saving goes through one callback with the complete plain state.

import { Day, canContinue } from './day.js';
import { PlayFlow } from './play-flow.js';
import { SetupFlow } from './setup-flow.js';
import { World } from './world.js';
import { choiceNotOffered } from './errors.js';
import { recordFind, recordPut } from './history.js';
import { summarize } from './summary.js';
import { describeLocation } from './room-view.js';
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

export class AppFlow {
  /**
   * @param {{ layout: object, things: object[], texts: object, random: object,
   *           saved: { plan: object, progress: object, world: object, day: object | null, dayCount: number },
   *           onSave: (state: { plan: object, progress: object, world: object, day: object | null, dayCount: number }) => void }} options
   *   `things` are the chosen catalogue entries; `saved` is what `onSave` handed over last time (or the defaults)
   */
  constructor({ layout, things, texts, random, clock, saved, onSave }) {
    Object.assign(this, { layout, things, texts, random, clock, onSave });
    this.plan = saved.plan;
    this.progress = saved.progress;
    this.dayCount = saved.dayCount;
    this.history = saved.history;
    this.lastDayFinishedOn = saved.lastDayFinishedOn;
    this.world = World.restore(layout, saved.world);
    // a day that cannot be continued (it names something that is gone) is dropped; the world stays
    this.day = canContinue(saved.day, { layout, things })
      ? new Day({ layout, things, world: this.world, plan: this.plan, progress: this.progress, state: saved.day })
      : null;
    this.current = this.welcome();
  }

  /** The complete plain state, as a copy that later play does not change. */
  saveState() {
    return structuredClone({
      plan: this.plan,
      progress: this.day ? this.day.progress() : this.progress,
      world: this.world.snapshot(),
      day: this.day ? this.day.snapshot() : null,
      dayCount: this.dayCount,
      history: this.history,
      lastDayFinishedOn: this.lastDayFinishedOn,
    });
  }

  welcome() {
    const { texts } = this;
    const play = this.day ? texts.continueDay({ number: this.day.state().number }) : texts.startDay({ number: this.dayCount + 1 });
    return new ChoiceScreen(
      {
        command: texts.welcome,
        choices: [{ id: 'play', label: play }, { id: 'setup', label: texts.chooseHomeSpots }],
      },
      (choice) => {
        this.current = choice === 'play' ? this.startDay() : this.startSetup();
      },
    );
  }

  startDay() {
    this.day ??= Day.start({
      layout: this.layout, things: this.things, world: this.world, plan: this.plan, progress: this.progress, random: this.random, number: this.dayCount + 1,
    });
    const dayNumber = this.day.state().number;
    return new PlayFlow(this.day, {
      texts: this.texts,
      onFinished: () => this.finishDay(),
      onFound: (record) => { this.history = recordFind(this.history, { day: dayNumber, ...record }); },
      onPut: (record) => { this.history = recordPut(this.history, { day: dayNumber, ...record }); },
    });
  }

  startSetup() {
    return new SetupFlow({ layout: this.layout, items: this.things, plan: this.plan, texts: this.texts, onFinished: () => this.finishSetup() });
  }

  step() {
    return this.current.step();
  }

  choose(choiceId) {
    this.current.choose(choiceId);
  }

  /** Acts on the choice and hands the new state over when it changed. */
  next() {
    const before = JSON.stringify(this.saveState());
    this.current.next();
    const after = this.saveState();
    if (JSON.stringify(after) !== before) this.onSave(after);
  }

  /** The Menu link of a day: back to the start screen; the day continues where it was. */
  leave() {
    this.current = this.welcome();
  }

  finishSetup() {
    this.plan = this.current.plan();
    this.day?.usePlan(this.plan);
    this.current = this.welcome();
  }

  finishDay() {
    const { texts } = this;
    const number = this.day.state().number;
    this.progress = this.day.progress();
    const lead = this.summaryLines(number);
    this.day = null;
    this.dayCount += 1;
    this.lastDayFinishedOn = this.clock.today();
    this.current = new ChoiceScreen(
      {
        lead,
        command: texts.dayDone({ number }),
        choices: [{ id: 'next', label: texts.startDay({ number: this.dayCount + 1 }) }, { id: 'start', label: texts.backToStart }],
      },
      (choice) => {
        this.current = choice === 'next' ? this.startDay() : this.welcome();
      },
    );
  }

  /** The lines of the summary screen, in the order of the story; a line with nothing to say is left out. */
  summaryLines(dayNumber) {
    const { texts } = this;
    const summary = summarize({ dayNumber, history: this.history, world: this.world, plan: this.plan, things: this.things });
    const thingNamed = (thingId) => named(texts.things, this.things.find((thing) => thing.id === thingId));
    const lookup = { garmentOf: (id) => this.layout.garments.find((garment) => garment.id === id), roomOf: (id) => this.layout.places.find((place) => place.id === id) };
    const advice = texts.advice[summary.advice]({ things: summary.away.map((entry) => thingNamed(entry.thingId)) });
    const noSearch = summary.advice === 'noSearch';
    const lines = [
      summary.home.length > 0 && texts.homeLine({ things: summary.home.map(thingNamed) }),
      summary.away.length > 0 && texts.awayLine({
        things: summary.away.map((entry) => ({ thing: thingNamed(entry.thingId), where: describeLocation(lookup, entry.location, texts, { withRoom: false }) })),
      }),
      noSearch ? advice : texts.searchedLine({ searched: summary.searched, possible: summary.possible }),
      texts.puttingLine({ steps: summary.putSteps }),
      !noSearch && advice,
      this.lastDayFinishedOn === this.clock.today() && texts.comeBackTomorrow,
    ];
    return lines.filter(Boolean);
  }
}
