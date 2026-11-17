// A player who knows the house, for tests of whole sessions through the real AppFlow: it follows the story, goes
// straight to every thing and puts it on its home spot. Not a test file itself (the runner only takes *.test.mjs).

import { isPocket } from '../app/js/world.js';

/**
 * Plays one session from the start screen to its summary and returns every screen it showed:
 * { lead, command, room, answer } (`answer` is the choice id tapped, or 'next' on a pause).
 * @param {import('../app/js/app-flow.js').AppFlow} app standing on a start screen that offers 'play' or 'next'
 */
export function playSession(app) {
  const screens = [];
  const ids = () => app.step().choices.map((entry) => entry.id);
  const tap = (answer) => {
    const { lead, command } = app.step();
    screens.push({ lead, command, room: app.day?.state().roomId, answer });
    app.choose(answer);
    app.next();
  };
  const walkTo = (roomId) => { tap('doors'); tap(`door:${roomId}`); };
  const goToThing = (location, state) => {
    if (isPocket(location)) { tap('pockets'); return tap(`pocket:${location.garmentId}/${location.pocketId}`); }
    if (location.placeId !== state.roomId) return walkTo(location.placeId);
    tap('spots');
    return tap(`spot:${location.spotId}`);
  };

  tap(ids().includes('play') ? 'play' : 'next');
  for (let guard = 0; !/is done/.test(app.step().command); guard += 1) {
    if (guard > 300) throw new Error('the bot is stuck');
    const state = app.day.state();
    const offered = ids();
    if (offered.length === 0) { screens.push({ lead: app.step().lead, command: app.step().command, room: state.roomId, answer: 'next' }); app.next(); }
    else if (offered.includes('go')) tap('go');
    else if (offered.includes('yes')) tap('yes');
    else if (state.returnTo) walkTo(state.returnTo);
    else if (state.event.kind === 'goTo') walkTo(state.event.roomId);
    else if (state.event.kind === 'putAway') goToThing(app.plan[state.event.thingId], state);
    else goToThing(app.world.whereIs(state.event.thingId), state);
  }
  return screens;
}
