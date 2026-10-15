# NIGHTSHIFT Implementation Plan

> Execution: implement inline in this session using the existing isolated, empty Site directory.

**Goal:** A polished mobile poker game against three local AI opponents.

**Architecture:** Buildless native ES modules. Pure card evaluation and equity simulation are separate from the mutable betting state machine. The browser app renders that state and owns timers, sound, dialogs, and persistence.

**Tech Stack:** HTML, CSS, JavaScript modules, Node’s test runner, Python static preview.

**Spec:** `docs/superpowers/specs/2026-10-15-nightshift-design.md`

## Global Constraints

- Four players, 2,500 starting chips each; blinds 10/20; no rake.
- Mobile portrait first; Chinese UI; no required remote dependencies.
- AI uses its own two cards and public board only.
- Source and packaged static output must match the pushed commit.

## Review Focus

- Short all-in: previously acting players can call but cannot reraise.
- Unequal all-ins: distribute each side pot among its eligible players.
- Board plays: identical best five cards split correctly, regardless of hole cards.
- Reload during an AI turn: exactly one timer resumes the saved hand.
- Small screens: every betting button and complete hand remain readable without overflow.

## Task 1 — Engine

Files: `dist/cards.js`, `dist/engine.js`, `dist/ai.js`, `tests/engine.test.mjs`.

Interfaces: `evaluate(cards) -> {value,category,name}`; `equity(hole,board,opponents,samples,rng) -> number`; `createGame(rng) -> state`; `newHand(state,rng)`; `legalActions(state) -> legal`; `act(state,type,amount)`; `settleShowdown(state)`; `chooseAction(state,difficulty,rng) -> {type,amount?}`.

- [x] Write and run failing rule tests.
- [x] Implement evaluation, deck, betting, pots, and AI.
- [x] Pass all engine tests and seeded simulation.

## Task 2 — Playable interface

Files: `dist/index.html`, `dist/style.css`, `dist/app.js`, `dist/assets/*.svg`.

- [x] Build the responsive branded table, avatars, cards, and action controls.
- [x] Connect all controls to the engine, including dialogs, help, settings, sound, statistics, history, and restoration.
- [x] Verify phone and desktop gameplay with a browser; fix observed issues.

## Task 3 — Publish

- [x] Run the complete Node suite and browser checks.
- [x] Commit and push source using the Site’s short-lived credential through stdin only.
- [x] Package unchanged static output and manifest; deploy owner-private.
- [x] Confirm deployment success and hand off the URL.
