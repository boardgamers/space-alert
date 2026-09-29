# Space Alert — Boardgamers

Preparation for a BGS adaptation of **Space Alert**, including **The New Frontier**. Canonical repository: [boardgamers/space-alert on GitHub](https://github.com/boardgamers/space-alert).

**Current status: an integration study and executable mission-timing prototype. This is not yet a playable adaptation.** No BGS platform or protocol package changes have been made, and nothing is published to the BGS game catalogue.

## Run the prototype

Node 24+, no dependencies:

```sh
npm test
npm run dev
```

Open http://127.0.0.1:5250. The local mission console can check readiness across tabs, start a shared mission clock, announce events, move a player to a later planning phase, and finish programming. It stops at resolution; it does not yet deal action cards, draw threats or simulate the ship. Seat selection and the “Ready all” control are development tools, not authentication.

## Implemented

- A fixed two-minute presence check. Missing confirmations cancel the session; they are not a team defeat. Everyone ready starts a shared three-second launch countdown.
- Server-driven mission events and phase deadlines, independent of browser timers and further player input.
- Individually advancing planning phases, including the irreversible lock on earlier turns.
- Idempotent commands, exact deadline handling, reconnect/catch-up from serialized state, and views without the unannounced event list.
- 34 fixed mission schedules imported from a pinned version of [SpaceAlertMissionGenerator](https://github.com/nibuen/SpaceAlertMissionGenerator): 2 test runs, 3 simulations, 3 advanced simulations, 8 missions, 6 easier double-action missions and 12 double-action missions.
- Local development host and tests. These test timing and integration assumptions; they are not a rules-completeness claim.

## Design and remaining work

- [Implementation scope and rules findings](docs/design.md): base game, all four New Frontier modules, mobile interface, content and release criteria.
- [Future BGS host contract](docs/realtime-host.md): the assumptions needed for real-time play, and how the prototype maps to them. These are proposed integration points, not existing protocol exports.
- [Sources and third-party notices](THIRD_PARTY.md): upstream revisions, licenses and content provenance.

The next game implementation layers are private card programming and the deterministic resolution engine, followed by the complete threat catalogue, all specialization effects and campaign/experience persistence. The upstream project generates announcements; it does not provide those rules.

## Mission data

`mission-data/catalog.json` contains structured schedules, not audio files. The import script accepts only the audited source file and verifies its SHA-256 before parsing a small, explicit subset of Java syntax; it never executes Java source:

```sh
python3 scripts/import-missions.py /path/to/ConstructedMissions.java
```

`src/missions.js` normalizes those schedules into semantic deadlines and announcements. Warning timestamps are semantic countdown points, not sample-accurate cue points for official recordings. Audio synchronization must be validated separately before release. The random generator has not been ported.

Code is AGPL-3.0-only, with third-party material retaining its notices. Space Alert is designed by Vlaada Chvátil and published by Czech Games Edition. No publisher artwork or voice recordings are included in this repository.
