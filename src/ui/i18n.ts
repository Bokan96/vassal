import { createContext, useContext } from 'react';
import {
  formatCard,
  isJoker,
  rankOf,
  suitOf,
  type CardId,
  type GameResult,
} from '../engine/index.ts';

export type Lang = 'sr' | 'en';
export const LANGS: readonly Lang[] = ['sr', 'en'];
export const DEFAULT_LANG: Lang = 'sr';

/**
 * Who a player is from the reader's point of view. Text is built from roles, never by comparing
 * display names, so each language can handle its own grammar (verb forms, cases).
 */
export type Role = 'you' | 'opponent' | 'player1' | 'player2';

export interface Dict {
  lang: Lang;
  /** Name of the language in itself, for the flag button. */
  langName: string;

  // Start screen
  tagline: string;
  opponent: string;
  computer: string;
  friend: string;
  difficulty: string;
  levels: Record<'easy' | 'normal' | 'hard', { label: string; hint: string }>;
  firstMove: string;
  random: string;
  variants: string;
  noMotive: string;
  noMotiveHint: string;
  noWildcards: string;
  noWildcardsHint: string;
  begin: string;
  resume: string;
  howToPlay: string;
  language: string;
  tutorial: string;
  tutorialHint: string;
  next: string;
  skipTutorial: string;
  stepOf(step: number, total: number): string;
  playGame: string;
  menu: string;
  combinations: string;
  sound: string;
  soundOn: string;
  soundOff: string;

  // Shell
  rules: string;
  newGame: string;
  backToMenu: string;
  viewBoard: string;
  nobleHouses: string;
  close: string;
  closeRules: string;

  // Players
  name(r: Role): string;

  // Status line and hand-off
  winsTitle(r: Role): string;
  toPlay(r: Role): string;
  deliberating: string;
  dealing: string;
  chooseHouseFor(card: string): string;
  chooseCard(r: Role | null): string;
  passTo(r: Role): string;
  passHint: string;
  showHand(r: Role): string;

  // Tug of war
  housesWon: string;
  tugLevel(each: number): string;
  tugLead(leader: Role, lead: number, a: number, b: number): string;

  // Board
  cardsAt(r: Role, house: number): string;
  playTo(house: number): string;
  yourHand: string;
  deckLabel(count: number): string;

  // Unseen cards dialog
  unseenTitle(count: number): string;
  unseenSummary(pile: number, hand: number, opp: Role): string;
  jokerHeld(opp: Role): string;
  jokerPlayed(opp: Role): string;

  // Log
  chronicle: string;
  logEmpty: string;
  gameLog: string;
  played(r: Role, card: CardId, house: number): string;
  claimed(r: Role, house: number, why: string): string;
  wonWith(r: Role, result: GameResult): string;
  jokerAs(card: string): string;
  beats(a: string, b: string): string;
  higherSum(a: string, b: string, x: number, y: number): string;
  equalSum(a: string, b: string, x: number): string;
  unbeatableNone(a: string, loser: Role): string;
  unbeatableBest(a: string, loser: Role, best: string): string;
  withSum(tier: string, sum: number): string;
  rankSum(sum: number): string;
  finalResolved: string;

  // Cards and tiers
  tierNames: readonly string[];
  /** Screen-reader text for a star rating, e.g. "3 of 6 stars". */
  starsOf(filled: number, slots: number): string;
  joker: string;
  suitNames: readonly string[];
  cardName(c: CardId): string;
  standingIn(c: CardId): string;
}

// ---------------------------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------------------------

const EN_RANKS = [
  'Ace',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Jack',
  'Queen',
  'King',
];
const EN_SUITS = ['Spades', 'Clubs', 'Hearts', 'Diamonds'];
const enName = (r: Role) =>
  ({ you: 'You', opponent: 'Opponent', player1: 'Player 1', player2: 'Player 2' })[r];
/** Mid-sentence form: "you", "the opponent", "Player 2". */
const enMid = (r: Role) => (r === 'you' ? 'you' : r === 'opponent' ? 'the opponent' : enName(r));
/** Third-person -s, except for "you". */
const enS = (r: Role, verb: string) => (r === 'you' ? verb : `${verb}s`);
const enPossessive = (r: Role) =>
  r === 'you' ? 'your' : r === 'opponent' ? "the opponent's" : `${enName(r)}'s`;
const enCard = (c: CardId) =>
  isJoker(c) ? 'Joker' : `${EN_RANKS[rankOf(c) - 1]} of ${EN_SUITS[suitOf(c)]}`;

const en: Dict = {
  lang: 'en',
  langName: 'English',

  tagline: 'Win the allegiance of the nine noble houses.',
  opponent: 'Opponent',
  computer: 'The computer',
  friend: 'A friend on this device',
  difficulty: 'Difficulty',
  levels: {
    easy: { label: 'Squire', hint: 'Easy' },
    normal: { label: 'Knight', hint: 'Normal' },
    hard: { label: 'Chancellor', hint: 'Hard' },
  },
  firstMove: 'First move',
  random: 'Random',
  variants: 'Variants',
  noMotive: 'No Same Colour level',
  noMotiveHint: 'Same-colour alliances count as Mixed, closer to Battle Line',
  noWildcards: 'No wildcards',
  noWildcardsHint: 'Play without jokers, with 7-card hands',
  begin: 'Begin',
  resume: 'Resume game',
  howToPlay: 'How to play',
  language: 'Language',
  tutorial: 'Tutorial',
  tutorialHint: 'New here? Start with the tutorial.',
  next: 'Next',
  skipTutorial: 'Skip tutorial',
  stepOf: (step, total) => `Step ${step} of ${total}`,
  playGame: 'Play a game',
  menu: 'Menu',
  combinations: 'Combinations',
  sound: 'Sound',
  soundOn: 'Sound on',
  soundOff: 'Sound off',

  rules: 'Rules',
  newGame: 'New game',
  backToMenu: 'Back to menu',
  viewBoard: 'View the board',
  nobleHouses: 'Noble houses',
  close: 'Close',
  closeRules: 'Close rules',

  name: enName,

  winsTitle: (r) => `${enName(r)} ${enS(r, 'win')}!`,
  toPlay: (r) => `${enName(r)} to play`,
  deliberating: 'The opponent is deliberating…',
  dealing: 'Dealing the cards…',
  chooseHouseFor: (card) => `Choose a house for ${card} (keys 1–9)`,
  chooseCard: (r) => (r ? `${enName(r)}: choose a card` : 'Choose a card to play'),
  passTo: (r) => `Pass the device to ${enName(r)}`,
  passHint: 'The other player should look away while you play.',
  showHand: (r) => `I am ${enName(r)}: show my hand`,

  housesWon: 'Houses won',
  tugLevel: (each) => `Level, ${each} houses each`,
  tugLead: (r, lead, a, b) => `${enName(r)} ${enS(r, 'lead')} by ${lead} (${a} to ${b})`,

  cardsAt: (r, house) => `${r === 'you' ? 'Your' : `${enName(r)}'s`} cards at house ${house + 1}`,
  playTo: (house) => `Play to house ${house + 1}`,
  yourHand: 'Your hand',
  deckLabel: (n) =>
    `Draw pile, ${n} ${n === 1 ? 'card' : 'cards'}. Show the cards you have not seen`,

  unseenTitle: (n) => `Unseen cards (${n})`,
  unseenSummary: (pile, hand, opp) =>
    `Every card that is not on the table or in your hand: ${pile} in the draw pile and ${hand} in ${enPossessive(opp)} hand.`,
  jokerHeld: (opp) =>
    `${opp === 'opponent' ? 'The opponent' : enName(opp)} still holds their Joker.`,
  jokerPlayed: (opp) =>
    `${opp === 'opponent' ? "The opponent's" : `${enName(opp)}'s`} Joker has been played.`,

  chronicle: 'Chronicle',
  logEmpty: 'The houses await your first move.',
  gameLog: 'Game log',
  played: (r, card, house) =>
    `${enName(r)} played ${isJoker(card) ? 'the Joker' : formatCard(card)} to house ${house + 1}`,
  claimed: (r, house, why) => `${enName(r)} ${enS(r, 'win')} house ${house + 1}: ${why}`,
  wonWith: (r, result) => {
    const how =
      result.reason === 'adjacent'
        ? `three adjacent houses (${result.houses[0]! + 1}–${result.houses.at(-1)! + 1})`
        : result.reason === 'five'
          ? `${result.houses.length} houses`
          : `a majority of houses (${result.houses.length})`;
    return `${enName(r)} ${enS(r, 'win')} with ${how}`;
  },
  jokerAs: (card) => `Joker as ${card}`,
  beats: (a, b) => `${a} beats ${b}`,
  higherSum: (a, b, x, y) => `${a} against ${b}, higher rank sum ${x} vs ${y}`,
  equalSum: (a, b, x) => `${a} against ${b}, equal rank sum ${x}; completed first`,
  unbeatableNone: (a, loser) =>
    `${a} is unbeatable: ${enMid(loser)} can no longer complete an alliance here`,
  unbeatableBest: (a, loser, best) =>
    `${a} is unbeatable: the best ${enMid(loser)} could still form is ${best}`,
  withSum: (tier, sum) => `${tier} with rank sum ${sum}`,
  rankSum: (sum) => ` (rank sum ${sum})`,
  finalResolved: 'Resolved after the last card was played',

  // Indexed by Tier: Incomplete, Discord, Motive, Intent, Plan, Scheme, Coup, Triumvirate.
  starsOf: (filled, slots) => `${filled} of ${slots} stars`,
  tierNames: [
    'Incomplete',
    'Mixed',
    'Same Colour',
    'Flush',
    'Straight',
    'Colour Straight',
    'Straight Flush',
    'Three of a Kind',
  ],
  joker: 'Joker',
  suitNames: EN_SUITS,
  cardName: enCard,
  standingIn: (c) => `, standing in for the ${enCard(c)}`,
};

// ---------------------------------------------------------------------------------------------
// Srpski (latinica)
// ---------------------------------------------------------------------------------------------

const SR_RANKS = [
  'As',
  'Dvojka',
  'Trojka',
  'Četvorka',
  'Petica',
  'Šestica',
  'Sedmica',
  'Osmica',
  'Devetka',
  'Desetka',
  'Žandar',
  'Dama',
  'Kralj',
];
const SR_SUITS = ['pik', 'tref', 'herc', 'karo'];
const srName = (r: Role) =>
  ({ you: 'Ti', opponent: 'Protivnik', player1: 'Igrač 1', player2: 'Igrač 2' })[r];
/** Genitive ("karte protivnika", "u ruci igrača 2"). */
const srGen = (r: Role) =>
  ({ you: 'tebe', opponent: 'protivnika', player1: 'igrača 1', player2: 'igrača 2' })[r];
/** Second person for "you", third person for everyone else. */
const srV = (r: Role, ti: string, on: string) => (r === 'you' ? ti : on);
/** Serbian plural: 1 karta, 2–4 karte, 5+ karata (21 karta, 12 karata …). */
const srPlural = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return one;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few;
  return many;
};
const srCard = (c: CardId) =>
  isJoker(c) ? 'Džoker' : `${SR_RANKS[rankOf(c) - 1]} ${SR_SUITS[suitOf(c)]}`;

const sr: Dict = {
  lang: 'sr',
  langName: 'Srpski',

  tagline: 'Pridobij odanost devet plemićkih kuća.',
  opponent: 'Protivnik',
  computer: 'Računar',
  friend: 'Prijatelj na ovom uređaju',
  difficulty: 'Težina',
  levels: {
    easy: { label: 'Štitonoša', hint: 'Lako' },
    normal: { label: 'Vitez', hint: 'Srednje' },
    hard: { label: 'Kancelar', hint: 'Teško' },
  },
  firstMove: 'Prvi potez',
  random: 'Nasumično',
  variants: 'Varijante',
  noMotive: 'Bez kombinacije Boja',
  noMotiveHint: 'Karte iste boje se računaju kao Ništa, bliže igri Battle Line',
  noWildcards: 'Bez džokera',
  noWildcardsHint: 'Igra bez džokera, sa 7 karata u ruci',
  begin: 'Počni',
  resume: 'Nastavi igru',
  howToPlay: 'Kako se igra',
  language: 'Jezik',
  tutorial: 'Tutorijal',
  tutorialHint: 'Prvi put? Kreni od tutorijala.',
  next: 'Dalje',
  skipTutorial: 'Preskoči tutorijal',
  stepOf: (step, total) => `Korak ${step} od ${total}`,
  playGame: 'Igraj partiju',
  menu: 'Meni',
  combinations: 'Kombinacije',
  sound: 'Zvuk',
  soundOn: 'Zvuk uključen',
  soundOff: 'Zvuk isključen',

  rules: 'Pravila',
  newGame: 'Nova igra',
  backToMenu: 'Nazad na meni',
  viewBoard: 'Pogledaj tablu',
  nobleHouses: 'Plemićke kuće',
  close: 'Zatvori',
  closeRules: 'Zatvori pravila',

  name: srName,

  winsTitle: (r) => (r === 'you' ? 'Pobeda je tvoja!' : `${srName(r)} pobeđuje!`),
  toPlay: (r) => (r === 'you' ? 'Ti si na potezu' : `Na potezu: ${srName(r)}`),
  deliberating: 'Protivnik razmišlja…',
  dealing: 'Deljenje karata…',
  chooseHouseFor: (card) => `Izaberi kuću za ${card} (tasteri 1–9)`,
  chooseCard: (r) => (r ? `${srName(r)}: izaberi kartu` : 'Izaberi kartu za igru'),
  passTo: (r) => `Predaj uređaj: ${srName(r)}`,
  passHint: 'Drugi igrač neka ne gleda dok igraš.',
  showHand: (r) => `Ja sam ${srName(r)}: prikaži moje karte`,

  housesWon: 'Osvojene kuće',
  tugLevel: (each) => `Nerešeno, po ${each} ${srPlural(each, 'kuća', 'kuće', 'kuća')}`,
  tugLead: (r, lead, a, b) =>
    r === 'you' ? `Vodiš za ${lead} (${a}:${b})` : `${srName(r)} vodi za ${lead} (${a}:${b})`,

  cardsAt: (r, house) =>
    r === 'you' ? `Tvoje karte kod kuće ${house + 1}` : `Karte ${srGen(r)} kod kuće ${house + 1}`,
  playTo: (house) => `Igraj na kuću ${house + 1}`,
  yourHand: 'Tvoje karte',
  deckLabel: (n) => `Špil, ${n} ${srPlural(n, 'karta', 'karte', 'karata')}. Prikaži neviđene karte`,

  unseenTitle: (n) => `Neviđene karte (${n})`,
  unseenSummary: (pile, hand, opp) =>
    `Sve karte koje nisu na stolu ni u tvojoj ruci: ${pile} u špilu i ${hand} u ruci ${srGen(opp)}.`,
  jokerHeld: (opp) => `${srName(opp)} još drži svog džokera.`,
  jokerPlayed: (opp) => `Džoker ${srGen(opp)} je odigran.`,

  chronicle: 'Hronika',
  logEmpty: 'Kuće čekaju prvi potez.',
  gameLog: 'Tok igre',
  played: (r, card, house) =>
    `${srName(r)} ${srV(r, 'igraš', 'igra')} ${isJoker(card) ? 'džokera' : formatCard(card)} na kuću ${house + 1}`,
  claimed: (r, house, why) =>
    `${srName(r)} ${srV(r, 'osvajaš', 'osvaja')} kuću ${house + 1}: ${why}`,
  wonWith: (r, result) => {
    const n = result.houses.length;
    const how =
      result.reason === 'adjacent'
        ? `sa tri susedne kuće (${result.houses[0]! + 1}–${result.houses.at(-1)! + 1})`
        : result.reason === 'five'
          ? `sa ${n} ${srPlural(n, 'kućom', 'kuće', 'kuća')}`
          : `većinom kuća (${n})`;
    return `${srName(r)} ${srV(r, 'pobeđuješ', 'pobeđuje')} ${how}`;
  },
  jokerAs: (card) => `Džoker kao ${card}`,
  beats: (a, b) => `${a} pobeđuje ${b}`,
  higherSum: (a, b, x, y) => `${a} protiv ${b}, veći zbir ${x} naspram ${y}`,
  equalSum: (a, b, x) => `${a} protiv ${b}, jednak zbir ${x}; savez je ranije završen`,
  unbeatableNone: (a, loser) =>
    `${a} se ne može nadmašiti: ${
      loser === 'you'
        ? 'ti ovde više ne možeš da sklopiš savez'
        : `${srName(loser).toLowerCase()} ovde više ne može da sklopi savez`
    }`,
  unbeatableBest: (a, loser, best) =>
    `${a} se ne može nadmašiti: najbolje što ${
      loser === 'you'
        ? 'ti još možeš da sklopiš'
        : `${srName(loser).toLowerCase()} još može da sklopi`
    } je ${best}`,
  withSum: (tier, sum) => `${tier} sa zbirom ${sum}`,
  rankSum: (sum) => ` (zbir ${sum})`,
  finalResolved: 'Rešeno posle poslednje odigrane karte',

  starsOf: (filled, slots) =>
    `${filled} od ${slots} ${srPlural(slots, 'zvezdice', 'zvezdice', 'zvezdica')}`,
  tierNames: ['Nepotpuno', 'Ništa', 'Boja', 'Znak', 'Niz', 'Niz boja', 'Niz znak', 'Tripleta'],
  joker: 'Džoker',
  suitNames: ['Pik', 'Tref', 'Herc', 'Karo'],
  cardName: srCard,
  standingIn: (c) => `, kao ${srCard(c).toLowerCase()}`,
};

export const DICTS: Record<Lang, Dict> = { en, sr };

const STORAGE_KEY = 'vassal.lang';
const isLang = (x: unknown): x is Lang => x === 'sr' || x === 'en';

/** `?lang=en` wins (handy for links and tests), then the saved choice, then Serbian. */
export function initialLang(): Lang {
  const param = new URLSearchParams(globalThis.location?.search ?? '').get('lang');
  if (isLang(param)) return param;
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // Storage unavailable: fall back to the default.
  }
  return DEFAULT_LANG;
}

export function saveLang(lang: Lang): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore
  }
}

export interface I18n {
  lang: Lang;
  t: Dict;
  setLang: (lang: Lang) => void;
}

export const I18nContext = createContext<I18n>({ lang: 'en', t: en, setLang: () => {} });

export const useI18n = (): I18n => useContext(I18nContext);
