/** Heraldry for the nine noble houses, left to right. Purely cosmetic; houses are referred to by position. */
export interface HouseArms {
  field: string;
  metal: string;
  /** Heraldic ordinary drawn on the shield. */
  charge: 'chevron' | 'fess' | 'bend' | 'cross' | 'saltire' | 'pale' | 'chief' | 'pall' | 'lozenge';
}

export const HOUSES: readonly HouseArms[] = [
  { field: '#2c4f8a', metal: '#d8b45a', charge: 'chevron' },
  { field: '#9b2c2c', metal: '#ece5d3', charge: 'fess' },
  { field: '#2f6b46', metal: '#d8b45a', charge: 'bend' },
  { field: '#5b3a7a', metal: '#d8b45a', charge: 'cross' },
  { field: '#c9a54c', metal: '#8e2430', charge: 'saltire' },
  { field: '#ece5d3', metal: '#2c4f8a', charge: 'pale' },
  { field: '#b5652b', metal: '#ece5d3', charge: 'chief' },
  { field: '#2b6f75', metal: '#d8b45a', charge: 'pall' },
  { field: '#7a2333', metal: '#d8b45a', charge: 'lozenge' },
];

/** "house 3": houses are numbered 1–9 from left to right (the keyboard shortcuts use the same numbers). */
export const houseLabel = (i: number): string => `house ${i + 1}`;
