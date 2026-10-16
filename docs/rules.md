# Vassal v1.0 — Rules

Transcribed from [Vassal_1.0.pdf](Vassal_1.0.pdf) with card symbols decoded. Cards are written `<rank><suit>`: A 2–10 J Q K, suits ♠ ♣ (black) ♥ ♦ (red), 🃏 = joker. This file is the single source of truth for the engine; the **Clarifications** section at the bottom records every interpretation the rulebook leaves open (cite them as `C1…C14` in code and tests).

## Introduction

Vassal is a two-player card game in which you try to win over the allegiance of nine noble houses.

**Object of the game:** win the allegiance of either **any 5 noble houses** or **3 adjacent noble houses** by forming alliances with people of influence.

## Setup

- A standard deck of **54 cards (incl. 2 jokers)** represents people of influence; **9 tokens** represent the noble houses.
- Place the 9 tokens in a straight line between the players, spaced to leave room for cards in front of each token on both sides:

  ```
  □ □ □ □ □ □ □ □ □   ← opponent's card spaces
  ■ ■ ■ ■ ■ ■ ■ ■ ■   ← noble house tokens
  □ □ □ □ □ □ □ □ □   ← your card spaces
  ```

- Put the two jokers aside, shuffle the remaining deck and place it face down: this is the **draw pile**.
- Deal **1 joker + 6 random cards** from the draw pile to each player's hand. You may inspect your own hand at any time but never see your opponent's.

## Forming alliances

You assign cards to noble houses. **Each player can assign at most 3 cards to each noble house** (on their own side); those three cards constitute an **alliance**.

### Alliance tiers (highest → lowest)

| Tier              | Requirement                       | Example  |
| ----------------- | --------------------------------- | -------- |
| **Triumvirate** ✱ | Three of the same rank            | 7♠ 7♥ 7♦ |
| **Coup**          | In sequence **and** of same suit  | 2♠ 3♠ 4♠ |
| **Scheme**        | In sequence **and** of same color | 2♠ 3♣ 4♠ |
| **Plan**          | In sequence                       | 2♠ 3♥ 4♣ |
| **Intent**        | Of same suit                      | 2♠ 4♠ 8♠ |
| **Motive**        | Of same color                     | 2♠ 4♣ 8♠ |
| **Discord**       | Any other alliance                | 2♠ 4♥ 8♣ |

- ✱ **Triumvirate is a house rule** added to this implementation (see C14); the original rulebook has no three-of-a-kind tier.
- The order in which cards are played does not matter when determining an alliance's tier.
- An alliance in a higher tier is always stronger than one in a lower tier.
- Within the same tier, strength is the **combined rank** (A = 1, J = 11, Q = 12, K = 13).
- Equally tiered and ranked alliances are won by the player who **first completed** their alliance.

**Example:** 2♠ 3♥ 4♣ (Plan) > 2♠ 4♠ 6♠ (Intent) > 2♠ 4♥ 9♣ (Discord, 15) > 2♠ 4♥ 6♣ (Discord, 12)

### Wildcards

Jokers are wildcards and can mirror any other card. A joker always takes the rank and suit that **maximises the strength** of the alliance it is part of.

## Winning allegiance

- When **both** players have assigned a full alliance (3 cards) to a noble house, the player with the stronger alliance claims that house's pledge of allegiance. If equally strong, the player who first completed a full alliance there claims it.
- At the end of your turn you may also claim one or more other houses to which you have assigned a full alliance, **if you can prove that your opponent is unable to assign an even stronger alliance** there. The proof must be based on the cards on the table (and knowledge of which cards make up the full 54-card deck). Remember to take jokers into account.
- Move the house token to the winning side to mark the pledge.

## Playing the game

Choose a starting player. On your turn:

1. **Play** — you must assign a card from your hand to one of the noble houses (in front of its token on your side).
2. **Draw** — draw a card if the draw pile isn't empty (skip if empty).
3. **Evaluate allegiances.**
4. **Check winning conditions.**

Players alternate turns until a winner is determined: the first player to claim **any 5** noble houses or **3 adjacent** noble houses.

## Quick reference

- Turn: play a card → draw a card → evaluate allegiances → check winning conditions.
- Tiers: Triumvirate > Coup > Scheme > Plan > Intent > Motive > Discord; ties broken by combined rank, then by who completed first.

## Variants (optional rules)

### No Motive tier

Ignore the Motive tier (six tiers here, counting the Triumvirate house rule; the rulebook's version has five, like Schotten Totten / Battle Line). Same-color non-sequence alliances become Discord.

### No wildcards

- Remove both jokers; deal **7** random cards to each player.
- If no winner when all cards have been played, each player has one incomplete alliance (2 cards). A full alliance is always stronger than an incomplete one. Two opposing incomplete alliances compare as Discords (highest combined rank wins); on a tie the **starting player** wins the allegiance.
- **Example:** 2♠ 2♥ 3♠ (full) > 6♠ 7♥ (incomplete, 13) > 2♠ 2♥ (incomplete, 4)
- When the game ends this way, the winner is the player with the **most allegiances**.

## Background (designer notes)

Vassal aims to give the experience of Reiner Knizia's Schotten Totten and Battle Line using a standard deck. The tiers were chosen so their probabilities in a random 3-card hand follow those games' distribution:

| Tier        | Rulebook | Exact (ace low, 22 100 hands) |
| ----------- | -------- | ----------------------------- |
| Triumvirate | — (C14)  | 52 (0.24%)                    |
| Coup        | 0.20%    | 44 (0.20%)                    |
| Scheme      | 0.60%    | 132 (0.60%)                   |
| Plan        | 2.39%    | 528 (2.39%)                   |
| Intent      | 4.98%    | 1100 (4.98%)                  |
| Motive      | 17.95%   | 3924 (17.76%) — see C10       |
| Discord     | —        | 16320 (73.85%)                |

---

## Clarifications

Interpretations adopted where the rulebook is silent or ambiguous. Code and tests reference these IDs.

| ID      | Clarification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1**  | **Ace is low only.** Sequences are {r, r+1, r+2} for r = 1..11; Q-K-A and K-A-2 are _not_ sequences. This reproduces the rulebook's probability table exactly.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **C2**  | **A joker becomes any of the 52 cards, including a duplicate** of a card already in its alliance. K♠ 2♠ 🃏 = Intent 28 (joker = K♠).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **C3**  | **Jokers are public and stay on their owner's side.** Each player's joker is known to be theirs and is only ever played on their own side, so an alliance contains at most one joker.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **C4**  | **Proof uses the table only.** The opponent's possible cards = the 52 natural cards minus every natural card on the table, plus the opponent's joker if it is not on the table. The claimant's hidden hand is _not_ excluded (the rule says "based on the cards on the table"); the claimant's own joker is never available to the opponent. Ties favour the claimant (they completed first). A claim can be proved against an empty opponent side (e.g. K♠ K♥ K♦ is claimable as soon as it is completed).                                                                                                            |
| **C5**  | **Evaluation order.** Step 3a: resolve full-vs-full houses (either player may win one) → check win. Step 3b: automatically claim every provable house for the **active** player → check win. Simultaneous wins are therefore impossible.                                                                                                                                                                                                                                                                                                                                                                               |
| **C6**  | **Claimed houses stay open.** Cards may still be assigned to a claimed house (effectively a discard); claims are final and never re-evaluated. With 27 cards and 27 slots per player — and the variant's "one incomplete alliance" ending — locking would make the game deadlock-prone.                                                                                                                                                                                                                                                                                                                                |
| **C7**  | **A legal move always exists** and, with jokers, the game always ends with a winner within 54 plies (once all cards are played every house is resolved, so someone holds ≥ 5).                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **C8**  | **No-wildcards ending.** After the last card is played with no winner, resolve every unclaimed house: full beats incomplete; incomplete vs incomplete compares by combined rank; a tie goes to the starting player. The player with the most houses wins (adjacency is irrelevant here).                                                                                                                                                                                                                                                                                                                               |
| **C9**  | **Starting player** is chosen on the setup screen (random by default).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **C10** | **Motive probability is 17.76%** (3924 / 22 100). The rulebook's 17.95% (= 3968) appears to double-count the 44 Coups.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **C11** | **Proof claims are automatic.** At step 3b the engine claims every provable house for the active player; players never have to click to claim.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **C12** | **Proofs ignore card counts.** A proof considers only which cards are on the table, never how many cards the opponent holds or how many remain in the pile — even when the count alone shows the opponent can no longer complete an alliance (relevant only in the no-wildcards endgame).                                                                                                                                                                                                                                                                                                                              |
| **C13** | **A joker's mirrored card stays available.** A joker on the table removes only the joker from the proof pool; the natural card it mirrors is still considered available to the opponent.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **C14** | **Triumvirate (house rule).** Three cards of the same rank form a **Triumvirate**, ranked as the **highest tier**, above Coup. It is slightly more common than a Coup (52 of 22 100 three-card hands, 0.24%, against 44 Coups, 0.20%), but it is the harder alliance to build: a partial Coup can always fall back to a Scheme, Plan, Intent or Motive, while a pair aiming for a Triumvirate depends on one of at most two remaining cards of its rank. Among natural cards it cannot overlap any other tier (three different suits are never one suit or one colour, and equal ranks are never a sequence; a joker duplicate such as K♠ K♠ K♣ still counts as a Triumvirate); before this rule such hands were Discords. A joker may complete it (e.g. 5♠ 5♣ 🃏 = Triumvirate 15). It is part of every variant, including No Motive tier. |
