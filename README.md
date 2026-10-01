# Space Alert — Boardgamers

A playable local adaptation of **Space Alert** and **The New Frontier**, with a deterministic engine and a French/English browser viewer. Repository: [boardgamers/space-alert](https://github.com/boardgamers/space-alert).

**Status: local playtest, under rules review.** The game runs through programming, ship resolution and scoring. The BGS adapter is implemented and tested against an isolated platform instance. Public release still needs human playtesting.

## Play locally

Node 24+. The standalone playtest and engine tests need no installed packages:

```sh
npm test
npm run dev
```

Open <http://127.0.0.1:5250>. Start with **Flight school / École de vol**: seven untimed exercises use the real engine, with editable programs and a teammate already maintaining the computer. The examples cover firing, energy, malfunctions, battlebots/interceptors, double actions, phasing and specializations.

For a full mission, expand **Local session / Session locale**. Select 1–5 humans, the crew, mission, threat pools and optional modules. In solo, you control four androids and have access to the full action deck. In multiplayer testing, open another tab with `?seat=1`, etc. Readiness lasts two minutes; everyone must be ready together. The local mission starts after a three-second countdown. If someone misses the window, the crew keeps waiting. Select a card half, then a turn. Advance individual phases to lock previous turns, or let the shared clock do so. After programming, the captain can resolve one step at a time or finish the mission; everyone can inspect the replay and log.

The local seat selector, “Ready all” and “Next announcement” buttons are development tools. This host has **no authentication** and deliberately listens only on `127.0.0.1`. It is not an online multiplayer deployment. Use external voice for cooperation; browser speech synthesis is optional and communications-blackout silence relies on the players.

## Implemented

- Trusted host clock, autonomous deadlines, expiring readiness, reconnection, atomic game commands and idempotent command sequences.
- 34 imported fixed mission schedules, including 18 double-action missions. The randomized mission generator has not been ported.
- Private hands and permitted card backs; phase packets, incoming data, transfers, android donations, solo programming and shared-slot conflict checks.
- Exact 90-card base and 90-card double-action decks, 6 heroic cards and all 10 specializations at levels 1–3.
- Six-station ship, energy, lifts, weapons, battlebots, interceptors, internal repairs, damage, delayed programs and deterministic resolution/replay.
- 103 threats: 55 base cards and 48 expansion cards, with seven trajectories. Includes called reinforcements, phasing, carriers, polarization, inaccessibility and the special intruder effects.
- Campaigns of three or five missions: collective continuation, ordered repairs, carried damage, robot placement and final campaign score.
- Local explorer careers: experience, specialization points, cloning/hardcore death and achievement recording. Verifiable mission constraints are checked; achievements requiring human judgment use an explicit attestation and a link to the official criteria. The group-defined **Hometown Hero** house achievement is not automated.
- Responsive FR/EN UI, readable threat effects, grouped cards and hand filters; native page scrolling and a scrollable journal with normal boundary chaining.

## Persistence and tests

The local host atomically saves the session, development clock offset and careers to `.local/session.json` (gitignored). Restarting resumes the same mission; experience completion is applied once by run ID. A saved prototype state from the older schema is backed up as `.legacy-backup` before a fresh session is created.

`npm test` covers timing and secrecy, physical card ownership, action/resolution rules, every threat's termination and serializable replay, expansion interactions, campaign repairs, career progression, host restart, and the tutorial examples. Passing tests do not replace a complete human rules audit, especially for combinations of expansion effects.

## References and integration

- [Components and source verification](docs/components.md)
- [Architecture and implementation status](docs/design.md)
- [BGS integration and deployment](docs/realtime-host.md)
- [Third-party provenance and licenses](THIRD_PARTY.md)

No publisher artwork, scanned cards, rulebook files or official voice recordings are bundled. The viewer uses original HTML/CSS symbols and its own explanatory text. Threat/achievement names remain in English. Code is AGPL-3.0-only; third-party materials retain their notices.

## Build for BGS

The BGS integration requires the published `@boardgamers/protocol` **0.8.x** package:

```sh
npm install
npm run build
npm pack
```

When testing unreleased protocol changes, with the BGS monorepo beside this checkout, install the local package instead:

```sh
cd ../boardgamers-mono
pnpm --filter @boardgamers/protocol build
cd ../space-alert
npm install --no-save --package-lock=false ../boardgamers-mono/packages/protocol
npm run build
```

Upload the generated engine tarball and `dist/viewer.js` through BGS admin. Use the metadata in [`bgs/gameinfo.json`](bgs/gameinfo.json): engine entry `bgs/engine.js`, viewer global `SpaceAlert`, game-managed time control, and no Elo. Keep the version private during playtesting. BGS assigns uploaded asset URLs; the example intentionally has no viewer URL. See [the integration notes](docs/realtime-host.md) for clock, table and career behavior.
