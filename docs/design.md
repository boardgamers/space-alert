# Game design and implementation scope

Updated: 2026-09-30. The requested scope is the base game **and The New Frontier**. This document records the architecture, implemented local rules and online release gates.

## Architecture

Space Alert has two different kinds of time. The programming round runs against real elapsed time and announces threats whose labels refer to later resolution turns. T+5 is a **resolution turn**, not the fifth minute. The resolution engine subsequently executes the committed programs in a deterministic order. Advancing an individual player's planning phase must never execute their ship actions early.

Use four separate components:

1. **Mission source:** produces a deterministic, versioned sequence of announcements. It can import fixed schedules first and later generate missions from a server-secret seed. Threat cards and trajectories are separate seeded decks.
2. **Game engine:** owns setup, cards, phase locks, transfers, androids, ship systems, threats, damage, resolution, scoring and expansion effects. It consumes ordered player commands and trusted time events. No `Date.now()`, client timer or audio playback position inside rule transitions.
3. **Viewer:** programs cards, displays public and private information, plays localized announcements and animates resolution. It may predict a clock display, but cannot extend a deadline or reveal a future threat.
4. **Host adapter:** binds the game to BGS authentication, durable ordering, deadlines, persistence, reconnect, cancellation and cooperative outcomes. The BGS adapter uses protocol 0.7 and durable platform wakeups.

All four layers are implemented, with both a standalone local host and an authenticated BGS adapter. Announcements deal cards, reveal threats and open transfers; programming resolves to a scored result.

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
| Outcome            | Shared survival and score. Expired readiness keeps the crew waiting; it does not end a game. BGS needs explicit cooperative/no-rating treatment.                                                                                                                       |
| Campaign           | Up to three linked base-game missions, repairs and carried damage. Keep an in-game campaign in engine state; do not confuse it with persistent New Frontier character careers.                                                                                                    |

Sources: [base rules](https://filemanager.czechgames.com/storage/files/space-alert/rules/space-alert-rules-en.pdf), especially §§2–3 and §§5–6, and the [teaching handbook](https://filemanager.czechgames.com/storage/files/space-alert/other-downloads/handbook/space-alert-handbook-en.pdf).

## The New Frontier — all four modules in scope

Modules should be selectable independently where the rules permit, with validated dependencies. All four modules now have local engine and viewer support. Detailed component evidence and limitations are in [the component audit](components.md).

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

For the current audit of the complete standard inventory, see [components](components.md). Continue cross-checking the exact action-card multiset, all threat values/effects, seven trajectories, damage tiles, heroic cards, specialization cards and experience tables against verified components. The rulebooks do not enumerate every component face. Missing data must remain explicit; do not fill gaps with plausible-looking values.

## Implementation status and release gates

1. **Timing:** readiness, shared start, autonomous deadlines, reconnect and per-player phase locks implemented and tested. Untimed tutorials use explicit host clock advances without changing normal mission timing.
2. **Local play:** private physical cards, Android/solo rules, ship resolution, all threat cards, all specialization abilities, scoring, campaigns and local explorer persistence implemented.
3. **Teaching/viewer:** seven untimed guided exercises use the actual engine. FR/EN controls and effect descriptions, threat details, replay, native scrolling and journal available. Official names remain English; original visual symbols are placeholders for any later licensed artwork.
4. **Rules validation:** deterministic fixtures cover critical interactions, and every threat terminates and replays from serialized state. This is not exhaustive proof of all combinations; human playtests remain necessary before claiming release readiness.
5. **BGS release:** the private-playtest adapter is implemented; see [integration and deployment](realtime-host.md). Public release awaits human playtesting. Careers currently persist within a table, and voice remains external.

The fixed mission catalogue is playable. Porting the random mission generator and supplying official recordings/art are separate tasks, not silently emulated by invented components. Achievement criteria requiring group judgment remain explicit manual claims; the optional group-defined Hometown Hero entry is not automated.
