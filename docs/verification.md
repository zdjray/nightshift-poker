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

The original CI job covers rules, simulations, and JavaScript parsing. Browser automation is described below.
This workflow reports status checks; requiring them before merge needs a separate branch protection or ruleset setting.


## Browser smoke automation — 2026-10-21

Playwright Test (pinned dev dependency, Chromium headless shell only) now runs
against the local `npm start` static service. No deployment URL, login, or
application credentials are required. The existing Node job is unchanged;
a separate five-minute `Chromium browser smoke` job on pinned Ubuntu 24.04 installs locked packages
and Chromium, runs the tests, and uploads screenshots/traces on failure
(retained seven days). Runtime dependencies and shipped game code are unchanged.

Reproduce with Node.js 24 and Python available on PATH:

```sh
npm ci
npx playwright install --with-deps --only-shell chromium
npm test
npm run check:syntax
npm run test:browser
```

The suite has three cases:

- Call using the actual button, verify progress and contributed chips, wait for
  a player turn, reload, compare the entire saved session plus visible cards,
  pot and hand number, then fold to prove the restored game remains playable.
- At 1440×900 and 390×844: fold, use the real skip control to finish the bots,
  inspect settlement, verify history and completed-hand statistics, and deal
  the next hand. Verify the hand counter advances and action becomes available.

Each test uses a fresh browser context and fixed random seed (42), keeping the
real engine, AI, event handlers and timers. localStorage is read for assertions,
never preloaded or edited by tests. Assertions wait on observable conditions;
there are no fixed sleeps or automatic retries. Browser page errors fail tests.
These are interaction checks, not screenshot comparisons or AI strength tests.

Local verification: 18 rule/simulation tests and all four syntax checks passed;
three browser cases passed in 11.7 seconds. Temporary fault injections each
produced exit code 1 at the expected assertion: disabling the call handler,
ignoring saved sessions, and disabling next-hand advancement. All mutations
were restored; none are included in the change. The full clean suite is rerun
before submission. The test runtime excludes initial browser downloads.

The broader manual checks above (all-in variants, malformed/blocked storage,
all listed viewport widths) are not claimed as automated coverage.
