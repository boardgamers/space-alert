# Game design and implementation scope

Research baseline: 2026-09-29. The requested scope is the base game **and The New Frontier**. This document distinguishes decisions, tested timing behavior and work still to implement.

## Architecture

Space Alert has two different kinds of time. The programming round runs against real elapsed time and announces threats whose labels refer to later resolution turns. T+5 is a **resolution turn**, not the fifth minute. The resolution engine subsequently executes the committed programs in a deterministic order. Advancing an individual player's planning phase must never execute their ship actions early.

Use four separate components:

1. **Mission source:** produces a deterministic, versioned sequence of announcements. It can import fixed schedules first and later generate missions from a server-secret seed. Threat cards and trajectories are separate seeded decks.
2. **Game engine:** owns setup, cards, phase locks, transfers, androids, ship systems, threats, damage, resolution, scoring and expansion effects. It consumes ordered player commands and trusted time events. No `Date.now()`, client timer or audio playback position inside rule transitions.
3. **Viewer:** programs cards, displays public and private information, plays localized announcements and animates resolution. It may predict a clock display, but cannot extend a deadline or reveal a future threat.
4. **Host adapter:** binds the game to BGS authentication, durable ordering, deadlines, persistence, reconnect, cancellation and cooperative outcomes. The local host demonstrates this boundary without editing BGS.

The current code implements the **timing/session part** of this design. Mission announcements are recorded; their future gameplay effects (drawing a card, activating a threat, exchanging a card) are not yet implemented.

## Base game

| Area               | Implementation requirements and rule traps                                                                                                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup              | 1–5 humans; distinguish human seats from crew members. Use the official android/solo variants, not generic AI seats. Difficulty for common and serious threats can differ. Choose roles and crew order before the readiness check.                                                |
| Programming        | Three phase ranges: turns 1–3, 4–7, 8–12; introductory two-phase missions use only the first two. Players may individually advance early and obtain their next packet; this permanently locks their earlier phase. The shared deadline forces everyone still behind to advance.   |
| Hidden information | Hands and later packets remain private. Another player can see whether a programmed card shows its action half or movement half, but not the actual symbol. Do not simply broadcast complete programs or hide every part of the card back.                                        |
| Concurrent edits   | Consume/move physical card IDs atomically. Use per-player or per-slot revisions so one player's edit does not invalidate another player's unrelated action. Shared android slots need conflict checks. A retry must not duplicate a card or a transfer.                           |
| Announcements      | Threat category/zone/turn, incoming data, limited transfer windows, communication blackout, phase warnings and final lock. Unconfirmed reports depend on **crew size**, including the optional fifth android.                                                                     |
| Androids           | Multiplayer android actions use donated cards face up and are irreversible once placed. Heroic cards belong to their assigned crew member. Solo has distinct rules: four androids, a shared available deck and revisable programs until the global deadlines.                     |
| Resolution         | Follow the Mission Steps Board: appearances, ordered crew actions, damage calculations, threat movement and X/Y/Z effects, computer checks, and end-of-mission handling. Rebuild from the initial ship and committed programs; a visual planning marker is not actual ship state. |
| Ship               | Six stations, gravolifts, reactor/shield capacities, laser and pulse weapons, rockets, interceptors, battlebots, malfunctions and damage tiles. Delays shift the remaining program and can discard actions; they are not simply skipped turns.                                    |
| Outcome            | Shared survival and score. Cancellation for missing presence is neither a defeat nor a competitive tie. BGS needs explicit cooperative/no-rating treatment.                                                                                                                       |
| Campaign           | Up to three linked base-game missions, repairs and carried damage. Keep an in-game campaign in engine state; do not confuse it with persistent New Frontier character careers.                                                                                                    |

Sources: [base rules](https://filemanager.czechgames.com/storage/files/space-alert/rules/space-alert-rules-en.pdf), especially §§2–3 and §§5–6, and the [teaching handbook](https://filemanager.czechgames.com/storage/files/space-alert/other-downloads/handbook/space-alert-handbook-en.pdf).

## The New Frontier — all four modules in scope

Modules should be selectable independently where the rules permit, with validated dependencies. They are **planned**, not implemented by merely importing the expansion mission schedules.

| Module            | Engine and UI work                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New threats       | Complete the 48-card expansion catalogue and corrected base cards. Add reusable handlers for megashields, plasma, phasing, carriers, multi-zone targets, jumps, special trajectories and intruder interactions. Validate actual card values and the appendix instead of inventing equivalents.                                                                                                                      |
| Double actions    | Preserve ordered subactions and card-side/back information. Resolve both halves sequentially for one crew member, with the correct rules for delays and impossible subactions. Handle variable-range interceptors and return penalties. Support external and internal threats sharing a T+number; during threat movement, external precedes internal. Incoming-data adjustments for android crews also belong here. |
| Specializations   | Ten unique specializations; level 1 gives the basic card, level 2 the advanced choice, level 3 both cards. They replace heroic cards and may be selected without the experience system. Implement the actual exceptions, including Medic priority and combinations, Teleporter tokens, and specialization actions for androids.                                                                                     |
| Experience system | Requires specializations. Model explorer identity separately from BGS seat/user identity: experience, specialization progression, achievements, cloning and hardcore death. Career updates must be durable and idempotent across games. Simulations must not grant career progress.                                                                                                                                 |

Crew badges become visible role labels, not a fifth mechanical expansion.

Source: [The New Frontier rulebook](https://filemanager.czechgames.com/storage/files/space-alert-the-new-frontier/rules/space-alert-2-rules-en.pdf), pp. 2, 9–15, 23 onward, and its threat appendix.

## Mobile-first interaction

Keep the ship and active threats visible while the current phase's 3/4/5 program slots and hand occupy a compact bottom area. Tap a card side, then a slot; drag is optional, never required. Allow pinch/pan on the ship while retaining page scroll at boundaries. Never install `touch-action: none` on the whole viewer or intercept all touch starts.

A compact crew strip shows readiness, planning phase and role. Other crew programs display only the permitted card-back information. An explicit phase-advance action previews what will lock; it is not a toggle. Announcements have visual equivalents, so muted audio does not hide threats. Reconnecting shows the current situation and missed announcements without replaying an entire overdue audio queue.

Resolution should support pause, step, replay and a readable explanation of failures. Keep this separate from the real-time programming controls. Tutorials should teach a short external-threat mission, energy/coordination, internal threats, androids, and then each expansion module.

Voice cooperation is a product requirement to resolve: typing alone is unlikely to suit the real-time pressure. Initially document external voice use; do not pretend the game can mute an external voice call during a communications blackout. If BGS later adds integrated communication, enforce the blackout there too. Avoid allowing pings or a program-preview helper to leak extra communication during that interval.

## Content and upstream assessment

The supplied Android application is useful for **mission schedules, generator logic and announcement vocabulary**. It is not a ship engine, card catalogue or reusable web viewer. Its 34 fixed schedules are now imported with reproducible provenance; the randomized generator remains a later port, with property tests over threat budgets, timing, phase constraints and double threats.

The root is MIT-licensed, but multiple generator files have GPL-3.0-or-later headers. Preserve per-file notices when porting; see [THIRD_PARTY.md](../THIRD_PARTY.md). Audio is separate from the timeline. Do not infer publisher-artwork or voice-pack distribution rights from a repository code license. The prototype uses text, with no copied game art or recordings.

Before claiming a complete adaptation, audit the exact action-card multiset, all threat values/effects, seven trajectories, damage tiles, heroic cards, specialization cards and experience tables against verified components. The rulebooks do not enumerate every component face. Missing data must remain explicit; do not fill gaps with plausible-looking values.

## Implementation order and release gates

1. **Timing boundary — implemented prototype:** presence cancellation, common start, autonomous announcements, per-player phase advancement, deadlines and reconnect. Connect this to the eventual host contract later.
2. **Playable training mission:** correct action deck, private programming, six-station ship and deterministic resolution for a documented fixed scenario. Exercise it with multiple independently viewed seats.
3. **Complete base game:** all threats/trajectories, remaining systems, android/solo variants, score, campaigns, replay, localization and tutorials.
4. **New Frontier:** all four modules above, with coverage per rule interaction and a character-persistence adapter. Double-action schedules alone do not satisfy this milestone.
5. **BGS integration and release:** implement the agreed platform/protocol support only when authorized, verify real multi-client timing and reconnect, inspect mobile behavior, confirm content provenance and publish after rules review.

Required regression cases include two simultaneous edits to one android slot; a transfer racing its closing beep; a move received at a phase cutoff; several missed deadlines during restart; a player independently entering phase 3 during global phase 1; delayed double actions; Medic ordering; simultaneous external/internal T+ threats; campaign repairs; and duplicate career-completion writes.
