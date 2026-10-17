# Verification — 2026-10-15

- `npm test`: 18 passing rule and simulation tests. Seeded multi-hand simulations preserve all 10,000 chips and finish without invalid actions or negative balances.
- All four shipped JavaScript modules pass `node --check`.
- Chromium browser checks at 1440, 768, 390, 360, and 320 CSS pixels: no horizontal overflow; betting controls remain within the viewport; opponents’ cards do not overlap the public board.
- Completed a real browser hand through human check/call decisions, showed the settlement, opened history, and continued to the next hand.
- Verified the all-in shortcut, half-pot shortcut, practice estimates, rules, difficulty and pace selections, and confirmed reset.
- Reloading at a human turn restores the identical hand and statistics.
- Additional phone checks cover an all-in hand through settlement and malformed, invalid, or blocked browser storage. All cases remain playable.
- No browser page errors in the completed checks. Browser QA used the installed Chromium executable; physical iOS and Android devices were not available.

The Site is static and requires no runtime API credentials. User progress is stored in the current browser only.

## Continuous integration — 2026-10-17

`.github/workflows/ci.yml` runs on every push and pull request using Node.js 24.
It runs the existing rule/simulation suite and checks all four shipped modules.
The syntax step also runs after a test failure; either failure makes the job fail.
No dependency installation or additional runtime dependencies are required.

Reproduce from the repository root with Node.js 24:

```sh
npm test
npm run check:syntax
```

Local verification (Node.js 24.19.0): 18 tests passed, 0 failed; all four syntax checks passed.
Failure detection was checked with temporary mutations, then restored:

- Changed the existing deck-size assertion from 52 to 51: `npm test` exited 1 with an assertion failure (17 passed, 1 failed).
- Appended `const = ;` to each of `dist/cards.js`, `dist/engine.js`, `dist/ai.js`, and `dist/app.js`, one file at a time: `npm run check:syntax` exited 1 with `SyntaxError` in every case.
- After restoring each file, both commands passed again. No deliberate failures are committed.

CI covers rules, simulations, and JavaScript parsing; the browser checks above remain manual.
This workflow reports status checks; requiring them before merge needs a separate branch protection or ruleset setting.
