---
paths:
  - 'src/ui/**'
---

# UI rules

- The UI dispatches `Move`s and renders `PlayerView`s and `GameEvent`s. It never mutates game state or re-implements rules (use engine helpers such as `resolveAlliance`, `legalMoves`).
- Hot-seat: never render a hand while the pass-device screen is shown.
- Everything must work with keyboard only (arrows/Enter/Esc) and have ARIA labels (`cardName()` for cards).
- Layout must work from 360px phone width (16px side gutter, no horizontal scroll) up to desktop; check both with the Playwright MCP.
- Respect `prefers-reduced-motion`. Wrap `localStorage` access in try/catch.
