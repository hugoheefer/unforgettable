// The contract every flow shares: step(), choose(id), next(), isFinished(). Called by each flow's test file so a
// new flow is held to the same rules as the existing ones.

import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * @param {string} name what the flow is called in the test names
 * @param {() => { step: Function, choose: Function, next: Function, isFinished?: Function }} makeFlow a fresh flow on a screen with choices
 */
export function checkFlowContract(name, makeFlow) {
  test(`${name} (contract): a choice that is not on the screen is refused`, () => {
    assert.throws(() => makeFlow().choose('not-on-this-screen'), /not offered/i);
  });

  test(`${name} (contract): Next on a screen with nothing selected changes nothing`, () => {
    const flow = makeFlow();
    const before = flow.step();
    flow.next();
    assert.deepEqual(flow.step(), before);
  });

  test(`${name} (contract): after Next acted on a choice, the choice is not carried over: the new screen has its own default or none`, () => {
    const flow = makeFlow();
    flow.choose(flow.step().choices[0].id);
    assert.notEqual(flow.step().selected, null);
    flow.next();
    const { selected, choices } = flow.step();
    assert.ok(selected === null || choices.some((entry) => entry.id === selected));
  });
}
