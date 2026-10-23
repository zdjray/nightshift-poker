# NIGHTSHIFT · 午夜牌局

A mobile-first, Chinese-language Texas Hold’em game. Open the deployed Site and immediately play against LUNA, RIVER, and BLAZE. All chips are virtual.

[Play NIGHTSHIFT online](https://nightshift-poker.thesora.chatgpt.site) · The deployed Site is owner-private and may require signing in with the owner’s ChatGPT account.

## Play

- Four players start with 2,500 chips each; blinds are 10/20.
- Use the large fold, check/call, and bet/raise buttons. Select a raise using the slider or half-pot, pot, and all-in shortcuts.
- Classic mode leaves the decisions to you; practice mode adds Monte Carlo showdown-equity estimates and contextual guidance.
- Settings control AI difficulty, pace, and sound. A confirmed reset starts a fresh session.
- Rules, history, hand settlements, and session statistics are included. The current browser saves the complete hand and settings automatically.
- Keyboard shortcuts: F to fold, C to check/call when the page itself has focus.

## Run locally

Requires Node 18+ for tests and Python 3 for the static development server. Playing locally requires no dependency installation or runtime API credentials.

```sh
npm test
npm start
```

Visit `http://localhost:3000`. Serve `dist/` with any static HTTP server for other hosting environments.

## Verify locally

Use Node.js 24 and Python available on PATH to match the current verification setup. Run from the repository root:

```sh
npm ci
npx playwright install --with-deps --only-shell chromium
npm test
npm run check:syntax
npm run test:browser
```

The browser suite runs three Chromium smoke tests against the local static server, covering player actions, reload recovery, and settlement/history/next-hand flows at desktop and mobile sizes. Playwright manages the server; no separate `npm start`, deployment login, or application credentials are needed.

GitHub Actions runs on every push and pull request using Node.js 24, with separate `Node tests and syntax` and `Chromium browser smoke` checks. The commands above reproduce both checks locally. See [the verification record](docs/verification.md) for coverage details and the broader manual checks.

## Structure

- `dist/cards.js`: seven-card evaluation, deck generation, and equity simulation.
- `dist/engine.js`: turns, legal bets, all-ins, side pots, ties, and elimination.
- `dist/ai.js`: three AI styles with difficulty-adjusted simulation and decision noise. Estimation receives only the acting player’s cards and public board.
- `dist/app.js`: rendering, input, sound synthesis, local storage, and lifecycle-aware AI timers.
- `dist/style.css` and `dist/assets/`: responsive visual design and original SVG portraits.
- `tests/engine.test.mjs`: rule regressions and seeded chip-conservation simulations.

Progress is browser-local. The game has no server-side account or cross-device synchronization.
