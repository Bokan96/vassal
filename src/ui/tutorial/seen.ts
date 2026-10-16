const KEY = 'vassal.tutorialSeen';

/** Whether this browser has finished or skipped the tutorial (drives the first-visit hint). */
export function tutorialSeen(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markTutorialSeen(): void {
  try {
    globalThis.localStorage?.setItem(KEY, '1');
  } catch {
    // Storage unavailable: the hint simply shows again next time.
  }
}
