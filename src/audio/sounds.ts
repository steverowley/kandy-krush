import type { Suit } from "../game/engine/types";
import { arpeggio, scoreRamp as _scoreRamp, thud, tone } from "./synth";

/**
 * Named sound vocabulary. Suits live on a pentatonic scale so cascades
 * are always consonant; arpeggios use major (win) / diminished (loss)
 * voicings to carry tone.
 */

const SUIT_FREQ: Record<Suit, number> = {
  cups: 523.25,      // C5
  pentacles: 392.0,  // G4
  swords: 659.25,    // E5
  wands: 440.0,      // A4
};

const PENTATONIC = [
  392.0,   // G4
  440.0,   // A4
  523.25,  // C5
  587.33,  // D5
  659.25,  // E5
  783.99,  // G5
  880.0,   // A5
];

export function selectTick() {
  tone(880, { type: "sine", gain: 0.45, duration: 0.04, release: 0.06 });
}

export function illegalSwap() {
  thud(120, 0.55);
}

export function matchChime(suit: Suit) {
  tone(SUIT_FREQ[suit], {
    type: "sine",
    gain: 0.75,
    duration: 0.18,
    release: 0.28,
  });
  // Soft harmonic an octave up.
  tone(SUIT_FREQ[suit] * 2, {
    type: "sine",
    gain: 0.22,
    duration: 0.18,
    release: 0.3,
  });
}

/** Each cascade step climbs the pentatonic — chains feel rewarding. */
export function cascadeStep(depth: number) {
  const idx = Math.min(PENTATONIC.length - 1, depth);
  tone(PENTATONIC[idx]!, {
    type: "triangle",
    gain: 0.5,
    duration: 0.12,
    release: 0.25,
  });
}

export function winFlourish() {
  arpeggio([
    { freq: 523.25, duration: 0.18 },   // C5
    { freq: 659.25, duration: 0.18 },   // E5
    { freq: 783.99, duration: 0.18 },   // G5
    { freq: 1046.5, duration: 0.35, gain: 1.0 }, // C6
  ]);
}

export function lossFlourish() {
  arpeggio([
    { freq: 523.25, duration: 0.18, type: "triangle" },        // C5
    { freq: 622.25, duration: 0.18, type: "triangle" },        // D#5
    { freq: 739.99, duration: 0.18, type: "triangle" },        // F#5
    { freq: 415.3,  duration: 0.45, type: "triangle", gain: 0.8 }, // G#4 (low resolution)
  ]);
}

export function deadlock() {
  tone(196, { type: "triangle", gain: 0.6, duration: 0.55, release: 0.6 });
  tone(146.83, { type: "triangle", gain: 0.4, duration: 0.55, release: 0.7, delay: 0.04 });
}

/** Re-export the score ramp under the named-vocabulary namespace. */
export function scoreRamp(magnitude: number) {
  _scoreRamp(magnitude);
}
