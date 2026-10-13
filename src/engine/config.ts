export interface RulesConfig {
  /** Include the Motive tier (variant "No Motive tier" sets this to false). */
  readonly motive: boolean;
  /** Deal one joker to each player (variant "No wildcards" sets this to false). */
  readonly wildcards: boolean;
}

export const DEFAULT_CONFIG: RulesConfig = { motive: true, wildcards: true };

export const HOUSE_COUNT = 9;
export const ALLIANCE_SIZE = 3;
export const WIN_HOUSES = 5;
export const WIN_ADJACENT = 3;
/** Natural cards dealt to each player at setup (plus a joker when wildcards are on). */
export const dealSize = (config: RulesConfig): number => (config.wildcards ? 6 : 7);
/** Total number of plies when every card is played. */
export const totalPlies = (config: RulesConfig): number => (config.wildcards ? 54 : 52);
