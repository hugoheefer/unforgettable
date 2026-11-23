// A player who knows the house, for tests of whole sessions through the real AppFlow: it follows the story, goes
// straight to every thing and puts it on its home spot. Not a test file itself (the runner only takes *.test.mjs).

import { isPocket } from '../app/js/world.js';

/**
 * Plays one session from the start screen to its summary and returns every screen it showed:
 * { lead, command, room, inHand, answer } (`answer` is the choice id tapped, or 'next' on a pause).
 * @param {import('../app/js/app-flow.js').AppFlow} app standing on a start screen that offers 'play' or 'next'
 * @param {{ putsAwayBeforeUse?: boolean, putsAwayWhenDone?: boolean }} options `putsAwayBeforeUse`: like a careful
 *   human, the player puts a thing back on its home spot, on their own, the first time a story step is about to use it;
 *   `putsAwayWhenDone`: the player puts a thing in hand on its home spot as soon as the rest of its chain no longer needs it
 */
export function playSession(app, { putsAwayBeforeUse = false, putsAwayWhenDone = false } = {}) {
  const screens = [];
  const ids = () => app.step().choices.map((entry) => entry.id);
  const tap = (answer) => {
    const { lead, command } = app.step();
    screens.push({ lead, command, praise: app.step().praise, room: app.day?.state().roomId, inHand: app.day?.state().inHand, answer });
    app.choose(answer);
    app.next();
  };
  // a walk-to offers its room as one choice; elsewhere the list of rooms is opened first
  const walkTo = (roomId) => { if (!ids().includes(`door:${roomId}`)) tap('doors'); tap(`door:${roomId}`); };
  const goToThing = (location, state) => {
    if (isPocket(location)) { tap('pockets'); return tap(`pocket:${location.garmentId}/${location.pocketId}`); }
    if (location.placeId !== state.roomId) return walkTo(location.placeId);
    tap('spots');
    return tap(`spot:${location.spotId}`);
  };

  // a thing the player puts away on their own is put on its home spot, however far that is
  let putting = null;
  const warned = new Set();
  const placeAtHome = (state) => {
    const home = app.plan[putting];
    const reached = isPocket(home) || home.placeId === state.roomId;
    goToThing(home, state);
    if (reached) putting = null;
  };
  const aboutToUseInHand = (state) => {
    const { kind, uses, chain, step } = state.event;
    return putsAwayBeforeUse && kind === 'tell' && uses !== undefined && state.inHand.includes(uses) && !warned.has(`${chain}/${step}`);
  };

  // a thing in hand that no later event of the running chain names or uses is finished with
  const finishedWith = (state) => {
    const rest = app.day.events.slice(app.day.index).filter((event) => event.chain === state.event.chain && event.kind !== 'letGo');
    return putsAwayWhenDone ? state.inHand.find((id) => !rest.some((event) => event.thingId === id || event.uses === id)) : undefined;
  };

  tap(ids().includes('play') ? 'play' : 'next');
  for (let guard = 0; !/is done/.test(app.step().command); guard += 1) {
    if (guard > 300) throw new Error('the bot is stuck');
    const state = app.day.state();
    const offered = ids();
    if (offered.length === 0) { screens.push({ lead: app.step().lead, command: app.step().command, praise: app.step().praise, room: state.roomId, inHand: state.inHand, answer: 'next' }); app.next(); }
    else if (putting) placeAtHome(state);
    else if (offered.includes('go') && aboutToUseInHand(state)) {
      warned.add(`${state.event.chain}/${state.event.step}`);
      putting = state.event.uses;
      tap('else');
      tap(`putaway:${putting}`);
    } else if (offered.includes('go') && finishedWith(state) !== undefined) {
      putting = finishedWith(state);
      tap('else');
      tap(`putaway:${putting}`);
    } else if (offered.includes('go')) tap('go');
    else if (offered.includes('yes')) tap('yes');
    else if (state.returnTo) walkTo(state.returnTo);
    else if (state.event.kind === 'goTo') walkTo(state.event.roomId);
    else if (state.event.kind === 'putAway') goToThing(app.plan[state.event.thingId], state);
    else goToThing(app.world.whereIs(state.event.thingId), state);
  }
  return screens;
}
