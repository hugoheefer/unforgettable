// The questions the app asks during a day, one screen at a time: a command and the choices the player can
// make. The player picks one (and taps Next when the
// setting asks for two taps). Pure: it drives a Day and holds no DOM.
//
// A screen is { lead: string[], command: string, choices: { id, label, mark? }[], selected: string | null,
// canLeave: true }. Which screen a day shows is its *mode*: the kind of the running event, or 'putting' (the
// player puts a thing away on their own) or 'back' (the story waits in another room). Choice ids:
// 'go' | 'yes' | 'no' | 'else' | 'spots' | 'pockets' | 'doors' | 'hang:<garment>' | 'puton:<garment>' |
// 'putaway:<thing>' | 'forgot:<thing>' open a list or act; inside a list 'spot:<id>' | 'pocket:<garment>/<pocket>' |
// 'door:<room>' act; 'back' returns.
//
// The lead is, in time order: what the last action did, the sentence of the move that ended in this room (that
// screen only), and the lines that explain the event (why you look, why you walk).
// A put-away on the home spot, and a thing found at once on its home spot, add `praise` to the step instead of a
// lead line.
// A tell and an empty "Something else first" have their Go on selected when they open, so they cost one tap.

import { describeLocation, describeRoom } from './room-view.js';
import { RefusedMove, choiceNotOffered } from './errors.js';
import { named } from './names.js';

const FIRST_SESSION = 1;

/** The texts that differ between putting a thing away and looking for it. */
const askingFor = (texts) => ({
  put: {
    command: texts.putCommand, spots: texts.spotsPutAway, pockets: texts.whichPocketPutAway, hereOption: texts.putInRoom, pocketOption: texts.putInPocket,
  },
  find: {
    command: texts.findCommand, spots: texts.spotsFinding, pockets: texts.whichPocketFinding, hereOption: texts.lookHere, pocketOption: texts.lookInPocket,
  },
});

/** The sentence a chain has for a step: a string, or a function of the names of the things. */
function sentenceOf(texts, chain, step) {
  const sentence = texts.chains[chain]?.[step];
  return typeof sentence === 'function' ? sentence({ things: texts.things }) : sentence;
}

/**
 * What each mode adds to the lead of its screens (`context`), and its first question (`root`). A root returns
 * { command, choices, preselect? }.
 */
const MODES = {
  pause: {
    // the first session starts a new game; every later one goes on with the world as it was left
    context: (flow, state) => [flow.texts.sessionNotes[state.number === FIRST_SESSION ? 'first' : 'later']],
    root: (flow, state) => ({ command: flow.texts.pauses[state.event.text]({ number: state.number }), choices: [] }),
  },
  tell: {
    context: () => [],
    root: (flow, state) => ({
      command: sentenceOf(flow.texts, state.event.chain, state.event.step),
      choices: [{ id: 'go', label: flow.texts.goOn }, flow.elseChoice()],
      preselect: 'go',
    }),
  },
  goTo: {
    context: (flow, state) => [sentenceOf(flow.texts, state.event.chain, state.event.step)],
    root: (flow, state) => ({
      command: flow.texts.goToCommand({ room: flow.roomNamed(state.event.roomId) }),
      choices: [flow.walkChoice(), flow.elseChoice()],
    }),
  },
  check: {
    context: (flow, state) => [sentenceOf(flow.texts, state.event.chain, state.event.step)],
    root: (flow) => ({
      command: flow.texts.checkCommand,
      choices: [{ id: 'yes', label: flow.texts.yesEverything }, { id: 'no', label: flow.texts.noForgot }, flow.elseChoice()],
    }),
  },
  find: {
    context: (flow, state) => (state.event.step === null ? [] : [sentenceOf(flow.texts, state.event.chain, state.event.step)]),
    root: (flow, state, view) => ({
      command: flow.texts.findCommand({ room: view.room, thing: flow.thingOf(state.event.thingId) }),
      choices: flow.placeChoices('find', view),
    }),
  },
  putAway: {
    context: () => [],
    root: (flow, state, view) => ({
      command: flow.texts.putCommand({ room: view.room, thing: flow.thingOf(state.event.thingId) }),
      choices: flow.placeChoices('put', view),
    }),
  },
  putting: {
    context: () => [],
    root: (flow, state, view) => ({
      command: flow.texts.putCommand({ room: view.room, thing: flow.thingOf(flow.putting) }),
      choices: [...flow.placeChoices('put', view), flow.back],
    }),
  },
  back: {
    context: () => [],
    root: (flow, state) => ({
      command: flow.texts.goBackCommand({ room: flow.roomNamed(state.returnTo) }),
      choices: [flow.walkChoice()],
    }),
  },
};

export class PlayFlow {
  /**
   * @param {import('./day.js').Day} day
   * @param {{ texts: object, onFinished?: () => void, onFound?: (record: object) => void, onPut?: (record: object) => void }} options
   *   `onFinished` is called once, when the last event is done; `onFound` and `onPut` get what each finished find
   *   or put-away cost, and each thing that was let go (`left: true`), before `onFinished`
   */
  constructor(day, { texts, onFinished = () => {}, onFound = () => {}, onPut = () => {} }) {
    this.day = day;
    this.texts = texts;
    this.onFinished = onFinished;
    this.onFound = onFound;
    this.onPut = onPut;
    this.back = { id: 'back', label: texts.back };
    this.menu = { type: 'root' };
    this.putting = null; // the thing the player puts away on their own
    this.lead = [];
    this.praise = null; // set when the last put-away landed on its home spot, or a thing was found there at once
    this.arrival = day.state().arrival; // a day restored right after a move shows its sentence again
    this.reported = false;
    this.selected = this.screen().preselect ?? null;
  }

  isFinished() {
    return this.day.state().finished;
  }

  mode(state) {
    if (this.putting) return 'putting';
    return state.returnTo ? 'back' : state.event.kind;
  }

  /** The screen as { lead, command, choices, preselect? } for the menu the player is in. */
  screen() {
    const state = this.day.state();
    if (state.finished) return { lead: [], command: '', choices: [] };
    const mode = this.mode(state);
    const view = describeRoom(this.day, this.texts);
    const menus = { root: () => MODES[mode].root(this, state, view), else: () => this.elseScreen(), forgot: () => this.forgotScreen() };
    const screen = menus[this.menu.type]?.() ?? this.listScreen(mode, view);
    const explains = ['else', 'forgot'].includes(this.menu.type) ? [] : MODES[mode].context(this, state, view);
    return { lead: [...(screen.lead ?? []), ...explains], ...screen };
  }

  step() {
    const state = this.day.state();
    const { lead, command, choices } = this.screen();
    if (state.finished) return { lead: this.lead, command: '', choices: [], selected: null, canLeave: true };
    const step = { lead: [...this.lead, ...this.arrivalLines(), ...lead], command, choices, selected: this.selected, canLeave: true };
    return this.praise ? { ...step, praise: this.praise } : step;
  }

  arrivalLines() {
    const { arrival } = this;
    return arrival ? [sentenceOf(this.texts, arrival.chain, arrival.step)] : [];
  }

  // ---- the lists behind the first question ----

  /** A list of spots, pockets or rooms, or the question where to hang the coat. */
  listScreen(mode, view) {
    const { texts } = this;
    const asking = askingFor(texts)[mode === 'find' ? 'find' : 'put'];
    switch (this.menu.type) {
      case 'spots':
        return { command: asking.spots({ room: view.room }), choices: this.spotChoices(view) };
      case 'pockets':
        return { command: asking.pockets, choices: this.pocketChoices(view) };
      case 'doors':
        return { command: texts.walkWhere, choices: [...view.rooms.map((room) => ({ id: `door:${room.id}`, label: texts.walkOption({ room, steps: room.steps }) })), this.back] };
      default: {
        const garment = named(texts.garments, this.day.garmentOf(this.menu.garmentId));
        return { command: texts.hangWhere({ garment }), choices: this.spotChoices(view) };
      }
    }
  }

  thingOf(thingId) {
    return named(this.texts.things, this.day.things.find((candidate) => candidate.id === thingId));
  }

  roomNamed(roomId) {
    return named(this.texts.rooms, this.day.roomOf(roomId));
  }

  walkChoice() {
    return { id: 'doors', label: this.texts.walkToRoom };
  }

  elseChoice() {
    return { id: 'else', label: this.texts.somethingElse };
  }

  /** Here, in a pocket, walk, and the coat: the four ways to answer a find or a put-back. */
  placeChoices(asking, view) {
    const ways = askingFor(this.texts)[asking];
    const choices = [{ id: 'spots', label: ways.hereOption({ room: view.room }) }];
    if (this.reachablePockets(view).length > 0) choices.push({ id: 'pockets', label: ways.pocketOption });
    choices.push(this.walkChoice());
    choices.push(...this.coatChoices(view));
    return choices;
  }

  /** Take a coat off, or put it on again, wherever the day allows it. */
  coatChoices(view) {
    const { texts } = this;
    if (!this.day.canHandle()) return [];
    return [
      ...view.worn.filter((garment) => garment.canTakeOff).map((garment) => ({ id: `hang:${garment.id}`, label: texts.takeOff({ garment }) })),
      ...view.hanging.map((garment) => ({ id: `puton:${garment.id}`, label: texts.putOn({ garment }) })),
    ];
  }

  reachablePockets(view) {
    return [...view.worn, ...view.hanging].flatMap((garment) =>
      garment.pockets.map((pocket) => ({ garment, pocket, hangs: view.hanging.includes(garment) })));
  }

  spotChoices(view) {
    return [...view.spots.map((spot) => ({ id: `spot:${spot.id}`, label: this.texts.tileLabel(spot) })), this.back];
  }

  pocketChoices(view) {
    const pockets = this.reachablePockets(view).map(({ garment, pocket, hangs }) =>
      ({ id: `pocket:${garment.id}/${pocket.id}`, label: this.texts.pocketLabel({ pocket, garment, hangs, seen: pocket.seen }) }));
    return [...pockets, this.back];
  }

  // ---- Something else first, and what was forgotten ----

  elseScreen() {
    const { texts, day } = this;
    const view = describeRoom(day, texts);
    const inHand = day.state().inHand;
    const choices = [
      ...inHand.map((thingId) => ({ id: `putaway:${thingId}`, label: texts.putMineAway({ thing: this.thingOf(thingId) }) })),
      ...this.coatChoices(view),
      { id: 'back', label: texts.goOn },
    ];
    return inHand.length === 0
      ? { lead: [texts.holdNothing], command: texts.elseCommand, choices, preselect: 'back' }
      : { command: texts.elseCommand, choices };
  }

  forgotScreen() {
    const { texts } = this;
    const choices = this.menu.thingIds.map((thingId) => ({ id: `forgot:${thingId}`, label: texts.forgotOption({ thing: this.thingOf(thingId) }) }));
    return { command: texts.forgotCommand, choices: [...choices, this.back] };
  }

  // ---- choosing and acting ----

  choose(choiceId) {
    if (!this.step().choices.some((choice) => choice.id === choiceId)) throw choiceNotOffered(choiceId);
    this.selected = choiceId;
  }

  next() {
    const event = this.day.state().event;
    if (!event) return;
    if (event.kind === 'pause') {
      this.perform(() => this.day.continue());
    } else {
      const choice = this.selected;
      if (!choice) return;
      this.apply(choice);
    }
    this.selected = this.screen().preselect ?? null;
  }

  apply(choice) {
    this.lead = [];
    this.praise = null;
    this.arrival = null;
    if (choice === 'back') {
      if (this.menu.type === 'root') this.putting = null;
      this.menu = { type: 'root' };
      return;
    }
    const [kind, rest] = choice.split(/:(.*)/s);
    const openings = { spots: 'spots', pockets: 'pockets', doors: 'doors', else: 'else' };
    if (openings[kind]) this.menu = { type: openings[kind] };
    else if (kind === 'hang') this.menu = { type: 'hang', garmentId: rest };
    else if (kind === 'no') this.menu = { type: 'forgot', thingIds: this.day.answerCheck(false) };
    else if (kind === 'putaway') this.startPuttingAway(rest);
    else this.act(kind, rest);
  }

  startPuttingAway(thingId) {
    this.putting = thingId;
    this.menu = { type: 'root' };
  }

  /** Does what the player chose, then goes back to the first question. */
  act(kind, rest) {
    const { menu } = this;
    this.menu = { type: 'root' };
    this.perform(() => this.run(kind, rest, menu));
  }

  /** Runs an action of the day; a refused move is told in the player's language, a mistake in the code is not hidden. */
  perform(action) {
    this.lead = [];
    this.praise = null;
    try {
      this.lead = action() ?? [];
    } catch (error) {
      if (!(error instanceof RefusedMove)) throw error;
      this.lead = [this.texts.refusals[error.code]];
    }
    for (const thingId of this.day.takeLeftBehind()) this.onPut({ thingId, steps: 0, atHome: false, left: true });
    const state = this.day.state();
    this.arrival = state.arrival;
    if (state.finished && !this.reported) {
      this.reported = true;
      this.onFinished();
    }
  }

  run(kind, rest, menu) {
    const { texts, day } = this;
    const actions = {
      go: () => { day.continue(); return []; },
      yes: () => { day.answerCheck(true); return []; },
      forgot: () => { day.forgot(rest); return []; },
      puton: () => {
        day.putOn(rest);
        return [texts.putOnDone({ garment: named(texts.garments, day.garmentOf(rest)) })];
      },
      door: () => { day.walkTo(rest); return []; },
    };
    if (actions[kind]) return actions[kind]();
    if (menu.type === 'hang') return this.hang(menu.garmentId, rest);
    return this.mode(day.state()) === 'find' ? this.look(kind, rest) : this.place(kind, rest);
  }

  hang(garmentId, spotId) {
    const { texts, day } = this;
    day.takeOff(garmentId, spotId);
    const spot = named(texts.spots, day.roomOf(day.state().roomId).spots.find((candidate) => candidate.id === spotId));
    return [texts.hungDone({ garment: named(texts.garments, day.garmentOf(garmentId)), spot })];
  }

  place(kind, rest) {
    const [first, second] = rest.split('/');
    const asked = this.putting ?? undefined;
    const placed = kind === 'pocket' ? this.day.putInPocket(first, second, asked) : this.day.putDown(first, asked);
    const { thingId, steps, atHome } = placed;
    this.putting = null;
    this.onPut({ thingId, steps, atHome, left: false });
    if (atHome) {
      this.praise = this.texts.praise({ thing: this.thingOf(thingId) });
      return [];
    }
    return [this.placedText(placed)];
  }

  look(kind, rest) {
    const { day } = this;
    const [first, second] = rest.split('/');
    const thingId = day.state().event.thingId;
    const looked = kind === 'pocket' ? day.lookInPocket(first, second) : day.look(first);
    const { found, steps, shortest, wasHome } = looked;
    if (found) this.onFound({ thingId, steps, shortest, wasHome });
    // the moment the habit pays off: the thing lay on its home spot and was found by going straight to it
    if (found && wasHome && steps === shortest) {
      this.praise = this.texts.praiseFound({ thing: this.thingOf(thingId) });
      return [];
    }
    return [this.lookedText(thingId, looked)];
  }

  placedText({ thingId, location }) {
    const thing = this.thingOf(thingId);
    return this.texts.placedAway({
      thing,
      where: describeLocation(this.day, location, this.texts, { withRoom: false }),
      home: describeLocation(this.day, this.day.plan[thingId], this.texts),
    });
  }

  lookedText(thingId, { found, steps, location, seen }) {
    if (found) return this.texts.found({ thing: this.thingOf(thingId), where: describeLocation(this.day, location, this.texts, { withRoom: false }), steps });
    const icons = seen.map((id) => this.day.things.find((candidate) => candidate.id === id).icon);
    return icons.length > 0 ? this.texts.notHereSee({ seen: icons }) : this.texts.notHere;
  }
}
