// The whole app as a series of screens, each with a command and choices: the start screen, choosing home
// spots, the days, and the end of a day. Pure: saving goes through one callback with the complete plain state.

import { Day, canContinue } from './day.js';
import { PlayFlow } from './play-flow.js';
import { SetupFlow } from './setup-flow.js';
import { World } from './world.js';
import { choiceNotOffered, lookBackUnavailable } from './errors.js';
import { emptyHistory, recordFind, recordPut } from './history.js';
import { emptyProgress } from './habit.js';
import { summarize } from './summary.js';
import { chainIdsOf } from './day-plan.js';
import { createScreenLog } from './screen-log.js';
import { LookBackFlow } from './look-back-flow.js';
import { whereEverythingIs } from './where-view.js';

const CURRENT = '★';
const DEFAULT_ONE_TAP = true;

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
   *   `things` are the chosen catalogue entries; `saved` is what `onSave` handed over last time (or the defaults);
   *   `testMode` offers the test view on every screen
   */
  constructor({ layout, things, texts, random, clock, saved, onSave, testMode = false }) {
    Object.assign(this, { layout, things, texts, random, clock, onSave, testMode });
    this.testView = null; // the test view while it is open
    this.plan = saved.plan;
    this.oneTap = saved.oneTap ?? DEFAULT_ONE_TAP;
    this.progress = saved.progress;
    this.dayCount = saved.dayCount;
    this.history = saved.history;
    this.lastDayFinishedOn = saved.lastDayFinishedOn;
    this.yesterdayChains = saved.yesterdayChains;
    this.screens = createScreenLog(); // the screens left during this session, for looking back
    this.world = World.restore(layout, saved.world);
    // until a day has been started, every thing stands on its home spot, whatever the save says
    this.started = saved.dayCount > 0 || saved.day !== null;
    this.placeThingsOnPlan();
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
      yesterdayChains: this.yesterdayChains,
      oneTap: this.oneTap,
    });
  }

  /** Before the first day a home spot is where the thing is: choosing one moves the thing with it. */
  placeThingsOnPlan() {
    if (this.started) return;
    for (const thing of this.things) this.world.put(thing.id, this.plan[thing.id]);
  }

  welcome() {
    const { texts } = this;
    const play = this.day ? texts.continueDay({ number: this.day.state().number }) : texts.startDay({ number: this.dayCount + 1 });
    // a new game has nothing to erase, so it offers no way to start again
    const choices = [
      { id: 'play', label: play },
      { id: 'setup', label: texts.chooseHomeSpots },
      { id: 'settings', label: texts.settings },
      ...(this.started ? [{ id: 'reset', label: texts.startAgain }] : []),
    ];
    const opens = { play: () => this.startDay(), setup: () => this.startSetup(), settings: () => this.settingsScreen(), reset: () => this.confirmReset() };
    return new ChoiceScreen({ command: texts.welcome, choices }, (choice) => {
      this.current = opens[choice]();
    });
  }

  /** How a choice is made; choosing one saves it at once and returns to the start screen. */
  settingsScreen() {
    const { texts } = this;
    const mark = (on) => (this.oneTap === on ? { mark: CURRENT } : {});
    const choices = [
      { id: 'onetap:on', label: texts.oneTapOn, ...mark(true) },
      { id: 'onetap:off', label: texts.oneTapOff, ...mark(false) },
      { id: 'back', label: texts.back },
    ];
    return new ChoiceScreen({ command: texts.oneTapCommand, choices }, (choice) => {
      if (choice !== 'back') this.oneTap = choice === 'onetap:on';
      this.current = this.welcome();
    });
  }

  /** Starting again erases a lot: it is asked first, and says what stays. */
  confirmReset() {
    const { texts } = this;
    const answers = { yes: () => this.resetGame(), no: () => this.welcome() };
    return new ChoiceScreen(
      {
        command: texts.startAgainCommand,
        choices: [{ id: 'yes', label: texts.yesErase }, { id: 'no', label: texts.noKeep }],
      },
      (choice) => {
        this.current = answers[choice]();
      },
    );
  }

  /** A new game: sessions, streaks, history and the world are erased; the home spots stay, so every thing is on its home spot. */
  resetGame() {
    this.day = null;
    this.dayCount = 0;
    this.progress = emptyProgress();
    this.history = emptyHistory();
    this.lastDayFinishedOn = null;
    this.yesterdayChains = [];
    this.world = new World(this.layout);
    this.started = false;
    this.placeThingsOnPlan();
    this.screens.clear();
    return this.welcome();
  }

  startDay() {
    this.started = true;
    if (!this.day) this.screens.clear(); // looking back shows the session you are in
    this.day ??= Day.start({
      layout: this.layout, things: this.things, world: this.world, plan: this.plan, progress: this.progress, random: this.random,
      number: this.dayCount + 1, yesterday: this.yesterdayChains,
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

  /**
   * The screen shown. A screen of a day offers to look back once a screen of the session has been left; Next is
   * shown unless one tap makes it needless (a screen without choices is left with Next only).
   */
  step() {
    const step = this.current.step();
    const showNext = !(this.oneTap && step.choices.length > 0);
    return {
      ...step,
      showNext,
      ...(step.canLeave && !this.screens.isEmpty() ? { canLookBack: true } : {}),
      ...(this.testMode && this.current !== this.testView ? { canSeeWhere: true } : {}),
    };
  }

  choose(choiceId) {
    this.current.choose(choiceId);
  }

  /** A tap on a choice: it selects it and, with one tap, also acts. @returns {boolean} whether the screen moved on */
  tap(choiceId) {
    const acts = this.oneTap;
    this.choose(choiceId);
    if (acts) this.next();
    return acts;
  }

  /** Acts on the choice and hands the new state over when it changed. */
  next() {
    const before = JSON.stringify(this.saveState());
    const shown = this.current.step();
    this.current.next();
    this.recordScreen(shown);
    const after = this.saveState();
    if (JSON.stringify(after) !== before) this.onSave(after);
  }

  /** Keeps a screen of a day that the player has left, with the choice made on it. A Next that did nothing is not a screen left. */
  recordScreen(shown) {
    if (!shown.canLeave || (shown.choices.length > 0 && shown.selected === null)) return;
    const picked = shown.choices.find((entry) => entry.id === shown.selected)?.label ?? null;
    this.screens.record({ lead: [...(shown.praise ? [shown.praise] : []), ...shown.lead], command: shown.command, picked });
  }

  /** The Look back link: read-only screens of the session; going back to the game returns to the screen left. */
  lookBack() {
    if (!this.step().canLookBack) throw lookBackUnavailable();
    const resume = this.current;
    this.current = new LookBackFlow({ entries: this.screens.entries(), texts: this.texts, onReturn: () => { this.current = resume; } });
  }

  /** The test view: where everything is now, read only; going back returns to the screen it was opened from. */
  seeWhere() {
    const resume = this.current;
    const hand = this.day?.state().inHand ?? [];
    const roomId = this.day?.state().roomId ?? null;
    const lines = whereEverythingIs({ layout: this.layout, things: this.things, world: this.world, plan: this.plan, hand, roomId, texts: this.texts });
    this.testView = new ChoiceScreen(
      { lead: [this.texts.testNote, ...lines], command: this.texts.testCommand, choices: [{ id: 'back', label: this.texts.testBack }] },
      () => { this.current = resume; },
    );
    this.current = this.testView;
  }

  /** The Menu link of a day: back to the start screen; the day continues where it was. */
  leave() {
    this.current = this.welcome();
  }

  finishSetup() {
    this.plan = this.current.plan();
    this.day?.usePlan(this.plan);
    this.placeThingsOnPlan();
    this.current = this.welcome();
  }

  finishDay() {
    const { texts } = this;
    const number = this.day.state().number;
    this.progress = this.day.progress();
    const lead = this.summaryLines(number);
    this.yesterdayChains = chainIdsOf(this.day.snapshot().events);
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

  /** The lines of the summary screen, in the order of the story. It never says what lies where. */
  summaryLines(dayNumber) {
    const { texts } = this;
    const summary = summarize({ dayNumber, history: this.history });
    const advice = texts.advice[summary.advice]();
    const noSearch = summary.advice === 'noSearch';
    const lines = [
      noSearch ? advice : texts.searchedLine({ searched: summary.searched, possible: summary.possible }),
      texts.puttingLine({ steps: summary.putSteps }),
      !noSearch && advice,
      this.lastDayFinishedOn === this.clock.today() && texts.comeBackTomorrow,
    ];
    return lines.filter(Boolean);
  }
}
