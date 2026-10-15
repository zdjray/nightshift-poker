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
