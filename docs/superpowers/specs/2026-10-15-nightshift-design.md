# NIGHTSHIFT 午夜牌局

Build a complete mobile browser Texas Hold’em game for a Chinese-speaking player who explicitly delegates creative direction. Success means opening the URL and immediately playing a full hand against three distinctive local AI opponents.

## Experience

Midnight club aesthetic: charcoal surroundings, forest-green felt, acid-lime accents, warm ivory cards, bespoke illustrated opponents. The desktop table is accompanied by session statistics and a live action feed. At phone widths these secondary views move into a dialog; large betting controls remain directly below the table. No external asset or runtime dependency is required.

## Rules and state

Four players start with 2,500 chips each, blinds 10/20, rotating dealer. Implement all four betting streets, legal minimum raises, short all-ins without reopening betting, individual side pots, split pots with deterministic odd-chip allocation, heads-up blinds, elimination, and new hands. Folded cards stay hidden. Seven-card evaluation uses the best five cards with all kickers. Chips are conserved, no rake.

## AI

LUNA is conservative, RIVER balanced, BLAZE aggressive. Each decision samples unknown cards using only that AI’s own two cards and the public board. Opponents’ real hole cards and the real remaining deck are never passed to equity estimation. Difficulty changes sample counts and decision noise. The optional practice view estimates the human’s showdown equity, labels it as an estimate, and never exposes opponents’ cards.

## Interaction and persistence

Support fold, check/call, bet/raise with a slider, half-pot/pot/all-in shortcuts, next hand, sound toggle, difficulty, pace, practice help, rules, history, and an explicitly confirmed session reset. Store the current hand, settings, and completed session statistics in localStorage; tolerate unavailable or corrupt storage. Resume AI turns after reload. Freeze automatic decisions while a dialog is open or the page is hidden.

## Verification

Node tests cover hand ranks and kickers, wheel straights, two-trip full houses, flush selection, side pots, ties, short all-ins, illegal actions, heads-up action order, randomized hand termination, and conservation of all 10,000 chips. Browser checks cover desktop and 390px/360px phone widths, a playable hand, settings/rules/history, storage restoration, console errors, and horizontal overflow. Publish owner-private and report the literal deployment URL.
