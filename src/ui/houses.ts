/** Heraldry for the nine noble houses, left to right. Purely cosmetic. */
export interface HouseArms {
  name: string;
  field: string;
  metal: string;
  /** Heraldic ordinary drawn on the shield. */
  charge: 'chevron' | 'fess' | 'bend' | 'cross' | 'saltire' | 'pale' | 'chief' | 'pall' | 'lozenge';
}

export const HOUSES: readonly HouseArms[] = [
  { name: 'Aldmere', field: '#2c4f8a', metal: '#d8b45a', charge: 'chevron' },
  { name: 'Brannoc', field: '#9b2c2c', metal: '#ece5d3', charge: 'fess' },
  { name: 'Corvane', field: '#2f6b46', metal: '#d8b45a', charge: 'bend' },
  { name: 'Dunholt', field: '#5b3a7a', metal: '#d8b45a', charge: 'cross' },
  { name: 'Elsworth', field: '#c9a54c', metal: '#8e2430', charge: 'saltire' },
  { name: 'Fairhaven', field: '#ece5d3', metal: '#2c4f8a', charge: 'pale' },
  { name: 'Greyhelm', field: '#b5652b', metal: '#ece5d3', charge: 'chief' },
  { name: 'Harrowgate', field: '#2b6f75', metal: '#d8b45a', charge: 'pall' },
  { name: 'Ivarsson', field: '#7a2333', metal: '#d8b45a', charge: 'lozenge' },
];

export const houseName = (i: number): string => HOUSES[i]?.name ?? `House ${i + 1}`;
