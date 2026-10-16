import { useSyncExternalStore } from 'react';

/**
 * Small synthesized sound effects (Web Audio, no files). Everything fails silently: sound is a
 * nicety and must never break the game.
 */
export type Sfx = 'select' | 'place' | 'draw' | 'claimMine' | 'claimTheirs' | 'win' | 'lose';

const MUTE_KEY = 'vassal.muted';
let ctx: AudioContext | null = null;
let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return globalThis.localStorage?.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    globalThis.localStorage?.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function useMuted(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => muted,
  );
}

function audio(): AudioContext | null {
  if (muted || typeof AudioContext === 'undefined') return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A short tone with a quick attack and exponential decay. */
function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  duration: number,
  gain: number,
  type: OscillatorType = 'sine',
): void {
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** A burst of filtered noise: the rustle of a card. */
function rustle(
  ac: AudioContext,
  start: number,
  duration: number,
  gain: number,
  from: number,
  to: number,
): void {
  const length = Math.ceil(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + duration);
  const env = ac.createGain();
  env.gain.setValueAtTime(gain, start);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(filter).connect(env).connect(ac.destination);
  src.start(start);
}

export function playSfx(name: Sfx): void {
  const ac = audio();
  if (!ac) return;
  try {
    const t = ac.currentTime + 0.01;
    switch (name) {
      case 'select':
        tone(ac, 880, t, 0.06, 0.05, 'triangle');
        break;
      case 'place':
        rustle(ac, t, 0.09, 0.25, 2500, 900);
        tone(ac, 150, t, 0.12, 0.18, 'sine');
        break;
      case 'draw':
        rustle(ac, t, 0.14, 0.12, 1200, 4000);
        break;
      case 'claimMine':
        tone(ac, 659.25, t, 0.22, 0.12, 'triangle');
        tone(ac, 987.77, t + 0.11, 0.32, 0.12, 'triangle');
        break;
      case 'claimTheirs':
        tone(ac, 392, t, 0.22, 0.1, 'triangle');
        tone(ac, 293.66, t + 0.12, 0.34, 0.1, 'triangle');
        break;
      case 'win':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          tone(ac, f, t + i * 0.12, 0.5, 0.12, 'triangle'),
        );
        break;
      case 'lose':
        [392, 349.23, 311.13, 261.63].forEach((f, i) =>
          tone(ac, f, t + i * 0.16, 0.5, 0.1, 'triangle'),
        );
        break;
    }
  } catch {
    // ignore
  }
}
