# Vassal

**▶ Play: https://bojanbozovic.com/vassal/**

A two-player card game played with a standard deck, in the spirit of Battle Line / Schotten Totten.
Play against the computer or a friend on the same device.

## Rules in brief

- **Goal:** win any **5** of the 9 noble houses, or **3 adjacent** ones.
- **Turn:** play one card from your hand to a house on your side, then draw.
- **Alliances:** each house takes up to 3 of your cards. When both sides have 3, the stronger
  alliance wins the house. Strongest to weakest:
  1. Three of a kind (7♠ 7♥ 7♦)
  2. Straight in one suit (2♠ 3♠ 4♠)
  3. Straight in one colour (2♠ 3♣ 4♠)
  4. Straight (2♠ 3♥ 4♣)
  5. Same suit (2♠ 4♠ 8♠)
  6. Same colour (2♠ 4♣ 8♠)
  7. Anything else
- **Ties:** the higher total rank wins (A = 1 … K = 13); if still equal, whoever completed first.
- **Early claims:** a house is won as soon as the table shows your opponent can no longer beat it.
- **Jokers** (optional variant) become whatever card makes the alliance strongest.

Full rules: [docs/rules.md](docs/rules.md).

## Run locally

```sh
npm install
npm run dev   # http://localhost:5173
```

MIT licensed (see [LICENSE](LICENSE)).
