// Speech-synthesis wrapper tests — src/audio/speech.js.
//
// The wrapper handles three things the underlying browser API doesn't:
//   - A queue cap so a runaway cascade can't pile up stale callouts.
//   - A consistent "no-op when off / no Web Speech API" guard so callers
//     don't need to feature-check.
//   - A flush helper so we can drop pending speech on mode transitions.
//
// Run with: node --test tests/speech.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Build a minimal stub of the SpeechSynthesis + SpeechSynthesisUtterance APIs.
const spoken = []; // ordered list of utterance texts handed to .speak()
let cancelCalls = 0;
let activeUtterance = null;

class StubUtterance {
  constructor(text) {
    this.text = text;
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
    this.onend = null;
    this.onerror = null;
  }
}

const stubSynth = {
  speak(u) {
    spoken.push(u.text);
    activeUtterance = u;
  },
  cancel() {
    cancelCalls++;
    activeUtterance = null;
  },
};

// Trigger the active utterance's onend (or onerror) callback so the
// internal queue advances.
function finishCurrent(error = false) {
  if (!activeUtterance) return;
  const u = activeUtterance;
  activeUtterance = null;
  if (error && u.onerror) u.onerror();
  else if (!error && u.onend) u.onend();
}

// Polyfill window before importing the module.
Object.defineProperty(globalThis, 'window', {
  value: {
    speechSynthesis: stubSynth,
  },
  configurable: true,
  writable: true,
});
globalThis.SpeechSynthesisUtterance = StubUtterance;

const speech = await import('../src/audio/speech.js');

function resetState() {
  spoken.length = 0;
  cancelCalls = 0;
  activeUtterance = null;
  speech.setSpeechEnabled(false); // start fresh disabled
}

// --- enabled toggle ---

test("speak is a no-op when speech is disabled", () => {
  resetState();
  speech.speak('hello');
  assert.equal(spoken.length, 0);
});

test("setSpeechEnabled(true) lets speak() through", () => {
  resetState();
  speech.setSpeechEnabled(true);
  speech.speak('go');
  assert.deepEqual(spoken, ['go']);
});

test("isSpeechEnabled reflects current toggle", () => {
  resetState();
  assert.equal(speech.isSpeechEnabled(), false);
  speech.setSpeechEnabled(true);
  assert.equal(speech.isSpeechEnabled(), true);
});

test("setSpeechEnabled(false) cancels in-flight speech and drains queue", () => {
  resetState();
  speech.setSpeechEnabled(true);
  speech.speak('a');
  speech.speak('b');
  speech.speak('c');
  // Reset cancelCalls so we measure ONLY the disable transition.
  cancelCalls = 0;
  speech.setSpeechEnabled(false);
  assert.equal(cancelCalls, 1);
  // Subsequent speak() does nothing while disabled.
  speech.speak('d');
  // Only 'a' was actually handed off via speak() pre-disable (pump only
  // calls speechSynthesis.speak() one at a time, awaiting onend).
  assert.deepEqual(spoken, ['a']);
});

// --- queue + pump behavior ---

test("speak queues utterances and only one fires at a time", () => {
  resetState();
  speech.setSpeechEnabled(true);
  speech.speak('one');
  speech.speak('two');
  speech.speak('three');
  // Only the first should be active immediately.
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0], 'one');
  // Simulate first finishing → next pumps.
  finishCurrent();
  assert.deepEqual(spoken, ['one', 'two']);
  finishCurrent();
  assert.deepEqual(spoken, ['one', 'two', 'three']);
});

test("onerror also advances the queue", () => {
  resetState();
  speech.setSpeechEnabled(true);
  speech.speak('a');
  speech.speak('b');
  finishCurrent(true); // simulate error on first
  assert.deepEqual(spoken, ['a', 'b']);
});

test("queue is capped — oldest pending dropped past MAX_QUEUE", () => {
  resetState();
  speech.setSpeechEnabled(true);
  // First call kicks off speaking; rest go to queue.
  // MAX_QUEUE is 4; flooding 10 ensures the oldest get evicted.
  for (let i = 0; i < 10; i++) speech.speak(`msg-${i}`);
  // First one is active immediately; queue holds up to 4 more.
  // Total drained: 1 active + 4 queued = 5.
  // Simulate processing all of them:
  let safety = 20;
  while (activeUtterance && safety-- > 0) finishCurrent();
  assert.equal(spoken.length, 5, `expected exactly 5 (1 active + 4 queued); got ${spoken.length}`);
});

// --- text coercion + empties ---

test("speak ignores empty / null / undefined text", () => {
  resetState();
  speech.setSpeechEnabled(true);
  speech.speak('');
  speech.speak(null);
  speech.speak(undefined);
  assert.equal(spoken.length, 0);
});

test("speak coerces non-string text via String(...)", () => {
  resetState();
  speech.setSpeechEnabled(true);
  speech.speak(123);
  assert.deepEqual(spoken, ['123']);
});

// --- flushSpeech ---

test("flushSpeech clears the queue and calls cancel", () => {
  resetState();
  speech.setSpeechEnabled(true);
  speech.speak('a');
  speech.speak('b');
  speech.speak('c');
  speech.flushSpeech();
  assert.ok(cancelCalls >= 1);
  // Even after letting the active finish, nothing more should come out.
  finishCurrent();
  assert.deepEqual(spoken, ['a']); // only the original active one
});
