import {
  emptyHouse,
  NATURAL_COUNT,
  parseCard,
  parseCards,
  Tier,
  type CardId,
  type GameState,
  type Move,
} from '../../engine/index.ts';
import type { Lang } from '../i18n.ts';

/** The tutorial board is smaller than the real one. */
export const TUTORIAL_HOUSES = 5;

const PLAYER_HAND = 'K♠ K♦ 5♥ 6♥ 2♦ 3♣ 9♣';
const OPPONENT_HAND = '4♠ 9♠ Q♣ J♠ 8♦ 5♣ 10♦';
/** Cards each player draws, in order (the player draws after every move, then the opponent). */
const PLAYER_DRAWS = '10♣ A♦ K♥ 7♥ 4♣ 8♣ 2♠ 6♠ J♦';
const OPPONENT_DRAWS = '3♦ 7♠ A♥ Q♦ 9♥ 5♦ J♣ 4♦';

/**
 * A stacked, card-complete opening: fixed hands, and a draw pile ordered so each player draws the
 * cards the lesson needs (the next card drawn is the last element of the pile).
 */
export function tutorialStart(): GameState {
  const hands: [CardId[], CardId[]] = [parseCards(PLAYER_HAND), parseCards(OPPONENT_HAND)];
  const p = parseCards(PLAYER_DRAWS);
  const o = parseCards(OPPONENT_DRAWS);
  const drawOrder: CardId[] = [];
  for (let i = 0; i < p.length; i++) {
    drawOrder.push(p[i]!);
    if (o[i] !== undefined) drawOrder.push(o[i]!);
  }
  const used = new Set([...hands[0], ...hands[1], ...drawOrder]);
  const rest: CardId[] = [];
  for (let c = 0; c < NATURAL_COUNT; c++) if (!used.has(c)) rest.push(c);
  return {
    v: 1,
    config: { motive: true, wildcards: false },
    start: 0,
    turn: 1,
    active: 0,
    hands,
    pile: [...rest, ...drawOrder.reverse()],
    houses: Array.from({ length: TUTORIAL_HOUSES }, emptyHouse),
    result: null,
  };
}

/** What a step points at. Houses are 0-based indices. */
export interface Focus {
  houses?: number[];
  card?: CardId;
  deck?: boolean;
  tug?: boolean;
  combos?: boolean;
  board?: boolean;
}

export interface TutorialStep {
  text: Record<Lang, string>;
  focus?: Focus;
  /** Combination rows this step talks about ('all' for the whole board). */
  combos?: Tier[] | 'all';
  /** The player must make exactly this move. */
  expect?: Move;
  /** The opponent makes this move automatically. */
  opponent?: Move;
  /** The final step: offers to play a real game. */
  outro?: boolean;
}

const play = (card: string, house: number): Move => ({
  type: 'play',
  card: parseCard(card),
  house: house - 1,
});

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    text: {
      sr: 'Dobro došao u Vassal! Svaka kolona je plemićka kuća. Ti igraš karte na svoju stranu (dole), a protivnik na svoju (gore). Za vežbu igramo sa 5 kuća.',
      en: 'Welcome to Vassal! Each column is a noble house. You play cards on your side (below), the opponent on theirs (above). For practice we play with 5 houses.',
    },
    focus: { board: true },
  },
  {
    text: {
      sr: 'Kuću osvaja jača kombinacija od 3 karte. Pobeđuješ kada osvojiš 3 susedne kuće.',
      en: 'A house goes to the stronger 3-card combination. You win by taking 3 adjacent houses.',
    },
    focus: { board: true },
  },
  {
    text: {
      sr: 'Ovo su kombinacije, od najjače do najslabije. Što više zvezdica, to je kombinacija jača.',
      en: 'These are the combinations, strongest first. More stars means a stronger combination.',
    },
    focus: { combos: true },
    combos: 'all',
  },
  {
    text: {
      sr: 'Imaš dva kralja. Tri karte iste vrednosti su Tripleta, najjača kombinacija. Izaberi K♠ i stavi ga na kuću 3.',
      en: 'You hold two kings. Three cards of the same rank make Three of a Kind, the strongest combination. Pick K♠ and play it to house 3.',
    },
    expect: play('K♠', 3),
    focus: { card: parseCard('K♠'), houses: [2] },
    combos: [Tier.Triumvirate],
  },
  {
    text: {
      sr: 'Posle svakog poteza vučeš novu kartu iz špila. Na svaku kuću možeš staviti najviše 3 karte.',
      en: 'After every move you draw a new card from the deck. Each house takes at most 3 of your cards.',
    },
    focus: { deck: true },
  },
  {
    text: {
      sr: 'Sada igra protivnik. Vidiš karte koje odigra, ali ne i one u njegovoj ruci.',
      en: 'Now the opponent plays. You see the cards they play, but not the ones in their hand.',
    },
    opponent: play('4♠', 2),
  },
  {
    text: {
      sr: 'Stavi i drugog kralja, K♦, na kuću 3.',
      en: 'Add your second king, K♦, to house 3.',
    },
    expect: play('K♦', 3),
    focus: { card: parseCard('K♦'), houses: [2] },
    combos: [Tier.Triumvirate],
  },
  {
    text: {
      sr: 'Protivnik skuplja pik na kući 2. Tri karte istog znaka su Znak.',
      en: 'The opponent is collecting spades on house 2. Three cards of one suit make a Flush.',
    },
    opponent: play('9♠', 2),
    focus: { houses: [1] },
    combos: [Tier.Intent],
  },
  {
    text: {
      sr: 'Odgovori hercom: 5♥ i 6♥ mogu postati Niz znak (niz u istom znaku), koji je jači od Znaka. Stavi 5♥ na kuću 2.',
      en: 'Answer with hearts: 5♥ and 6♥ can become a Straight Flush (a run in one suit), which beats a Flush. Play 5♥ to house 2.',
    },
    expect: play('5♥', 2),
    focus: { card: parseCard('5♥'), houses: [1] },
    combos: [Tier.Coup, Tier.Intent],
  },
  {
    text: {
      sr: 'Iz špila stiže K♥, treći kralj!',
      en: 'You drew K♥, the third king!',
    },
    focus: { card: parseCard('K♥') },
  },
  {
    text: {
      sr: 'Protivnik stavlja Q♣ na kuću 4.',
      en: 'The opponent puts Q♣ on house 4.',
    },
    opponent: play('Q♣', 4),
    focus: { houses: [3] },
  },
  {
    text: {
      sr: 'Završi Tripletu: stavi K♥ na kuću 3.',
      en: 'Complete Three of a Kind: play K♥ to house 3.',
    },
    expect: play('K♥', 3),
    focus: { card: parseCard('K♥'), houses: [2] },
    combos: [Tier.Triumvirate],
  },
  {
    text: {
      sr: 'Kuća 3 je odmah tvoja! Tri kralja ne može nadmašiti nijedna kombinacija koju protivnik još može da složi, pa je to dokazano. Označena traka pokazuje ko vodi u kućama.',
      en: 'House 3 is yours at once! No combination the opponent could still build can beat three kings, so the win is proven. The highlighted bar shows who is ahead in houses.',
    },
    focus: { houses: [2], tug: true },
  },
  {
    text: {
      sr: 'Protivnik je završio Znak na kući 2. Kuća još nije njegova: tvoja strana još može da bude jača.',
      en: 'The opponent completed a Flush on house 2. The house is not theirs yet: your side can still be stronger.',
    },
    opponent: play('J♠', 2),
    focus: { houses: [1] },
    combos: [Tier.Intent],
  },
  {
    text: {
      sr: 'Stavi 6♥ na kuću 2.',
      en: 'Play 6♥ to house 2.',
    },
    expect: play('6♥', 2),
    focus: { card: parseCard('6♥'), houses: [1] },
    combos: [Tier.Coup, Tier.Intent],
  },
  {
    text: {
      sr: 'Protivnik stavlja 8♦ na kuću 4.',
      en: 'The opponent puts 8♦ on house 4.',
    },
    opponent: play('8♦', 4),
    focus: { houses: [3] },
  },
  {
    text: {
      sr: 'Iz špila stiže 7♥. Stavi ga na kuću 2 i završi Niz znak 5♥ 6♥ 7♥.',
      en: 'You drew 7♥. Play it to house 2 to complete the Straight Flush 5♥ 6♥ 7♥.',
    },
    expect: play('7♥', 2),
    focus: { card: parseCard('7♥'), houses: [1] },
    combos: [Tier.Coup, Tier.Intent],
  },
  {
    text: {
      sr: 'Kad oba igrača popune kuću, jača kombinacija je osvaja: Niz znak pobeđuje Znak. Kod iste kombinacije pobeđuje veći zbir karata, a ako je i on isti, onaj ko je prvi završio.',
      en: 'When both players fill a house, the stronger combination takes it: a Straight Flush beats a Flush. With equal combinations the higher card total wins, and if that is equal too, whoever finished first.',
    },
    focus: { houses: [1], tug: true },
  },
  {
    text: {
      sr: 'Protivnik igra na kuću 1.',
      en: 'The opponent plays to house 1.',
    },
    opponent: play('5♣', 1),
    focus: { houses: [0] },
  },
  {
    text: {
      sr: 'Imaš kuće 2 i 3. Treća susedna kuća donosi pobedu! Protivnik na kući 4 nema ništa jako. Stavi 2♦ na kuću 4.',
      en: 'You hold houses 2 and 3. A third adjacent house wins the game! The opponent has nothing strong on house 4. Play 2♦ to house 4.',
    },
    expect: play('2♦', 4),
    focus: { card: parseCard('2♦'), houses: [3] },
    combos: [Tier.Plan],
  },
  {
    text: {
      sr: 'Protivnik igra na kuću 5.',
      en: 'The opponent plays to house 5.',
    },
    opponent: play('10♦', 5),
    focus: { houses: [4] },
  },
  {
    text: {
      sr: 'Stavi 3♣ na kuću 4. Niz ne mora biti u istom znaku.',
      en: 'Play 3♣ to house 4. A Straight does not need to be one suit.',
    },
    expect: play('3♣', 4),
    focus: { card: parseCard('3♣'), houses: [3] },
    combos: [Tier.Plan],
  },
  {
    text: {
      sr: 'Protivnik igra na kuću 1.',
      en: 'The opponent plays to house 1.',
    },
    opponent: play('3♦', 1),
    focus: { houses: [0] },
  },
  {
    text: {
      sr: 'Završi Niz 2♦ 3♣ 4♣: stavi 4♣ na kuću 4.',
      en: 'Complete the Straight 2♦ 3♣ 4♣: play 4♣ to house 4.',
    },
    expect: play('4♣', 4),
    focus: { card: parseCard('4♣'), houses: [3] },
    combos: [Tier.Plan, Tier.Discord],
  },
  {
    text: {
      sr: 'Pobeda! Tvoje su tri susedne kuće: 2, 3 i 4. Protivnik na kući 4 više nije mogao da te nadmaši, pa je i ona dokazano tvoja.',
      en: 'Victory! You took three adjacent houses: 2, 3 and 4. The opponent could no longer beat you on house 4, so it was proven yours too.',
    },
    focus: { houses: [1, 2, 3], tug: true },
  },
  {
    text: {
      sr: 'Prava igra se igra sa 9 kuća. Pobeđuješ sa 3 susedne kuće ili sa bilo kojih 5 kuća. Savet: ne žuri da završiš slabe kombinacije; strpljenje se isplati. Srećno!',
      en: 'The real game is played with 9 houses. You win with 3 adjacent houses or any 5 houses. Tip: don’t rush to complete weak combinations; patience pays off. Good luck!',
    },
    outro: true,
  },
];
