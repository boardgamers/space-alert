# Space Alert — Boardgamers

A playable local adaptation of **Space Alert** and **The New Frontier**, with a deterministic engine and a French/English browser viewer. Repository: [boardgamers/space-alert](https://github.com/boardgamers/space-alert).

**Status: private BGS playtest, under rules review.** The game runs through programming, ship resolution and scoring. The BGS adapter is implemented and tested against an isolated platform instance. Public release still needs human playtesting.

## Play locally

Node 24+. The standalone playtest and engine tests need no installed packages:

```sh
npm test
npm run dev
```

Open <http://127.0.0.1:5250>. Start with **Flight school / École de vol**: nine exercises use the real engine. Start with **Planning turns**: one crew member, a highlighted destination, two movement actions, and an empty turn. Choose left, right or a deck change to reach the destination; start the planning clock, finish early, and watch all three turns execute. A second attempt runs out of time with empty turns. The next chapter reveals a threat, locks the first group at its deadline, then executes the complete seven-turn training mission. A missed destination can be retried. The later exercises have editable programs and a teammate already maintaining the computer; they cover firing, energy, malfunctions, battlebots/interceptors, double actions, phasing and specializations.

For a full mission, expand **Local session / Session locale**. Select 1–5 humans, the crew, mission, threat pools and optional modules. In solo, you control four androids and have access to the full action deck. In multiplayer testing, open another tab with `?seat=1`, etc. Readiness lasts two minutes; everyone must be ready together. The local mission starts after a three-second countdown. If someone misses the window, the crew keeps waiting. Click a card half to fill the highlighted turn; the cursor advances afterward. Click any editable turn to select it, including a filled turn to replace its card. W leaves a wait and advances; Backspace clears the selected turn, or steps back if it is empty. The hourglass and erase buttons provide the same controls with a mouse or touch. Left/right arrow keys queue horizontal movement; up/down queue a deck change, using an available card. Typing in fields is unaffected. Shift-click or Combine retains multi-card selection; then choose a turn. Advance individual phases to lock previous turns, or let the shared clock do so. After programming, the captain can resolve one step at a time or finish the mission; everyone can inspect the replay and log.

Training starts with its clock paused. **Start practice clock** and **Pause clock** control time only in training; normal missions retain their shared, continuous clock. You can also advance lesson phases explicitly.

The local seat selector, “Ready all” and “Next announcement” buttons are development tools. This host has **no authentication** and deliberately listens only on `127.0.0.1`. It is not an online multiplayer deployment. Use external voice for cooperation; mission announcements are visual, with sound effects for game actions. Communications-blackout silence relies on the players.

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

The BGS integration requires the published `@boardgamers/protocol` **0.10.0** package:

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

Upload the generated engine tarball and the complete viewer bundle (`dist/viewer.js` plus `dist/locales/*.json`) through BGS admin, keeping their relative paths in the same immutable bundle. The entry point remains `viewer.js`; `viewer-meta.json` is only a local build report. Use the metadata in [`bgs/gameinfo.json`](bgs/gameinfo.json): engine entry `bgs/engine.js`, viewer global `SpaceAlert`, game-managed time control, and no Elo. Keep the version private during playtesting. BGS assigns uploaded asset URLs; the example intentionally has no viewer URL. See [the integration notes](docs/realtime-host.md) for clock, table and career behavior.


### Playable tutorials

Open `/learn?chapter=basics&locale=fr` on the local preview server. Lessons use
`@boardgamers/protocol/tutorial` for validated action history, checkpoints,
previous/replay/restart controls, and browser-local progress. The BGS viewer
registers the same `mountLesson` through `launchTutorial`. Publish its chapter
metadata together with the viewer; chapter versions must match saved progress.

Tutorials mount the ordinary console, ship, card controls and program slots.
The first chapter hides unrelated systems, card sides and crew members. Both
ship decks retain the same room height. Resolution is untimed and uses the
ordinary resolution controls; the planning clock never drives individual turns.
During planning, each visible action has a small intended-room marker. Hover or
focus a turn to show a translucent crew marker there; the solid crew stays in its
actual room. This preview assumes movement succeeds and stops when hidden cards
or crew-dependent movement make the route unknown.

Short synthesized action cues are enabled by default and unlock on the first interaction; the speaker toggle preserves the user’s mute choice.

[BGS playable tutorial API](https://codeberg.org/boardgamers/boardgamers/src/branch/main/apps/docs/docs/guide/tutorials.md)

### Localization

English source chapter titles live in `bgs/gameinfo.json`; translated titles use
BGS metadata `optionTranslations` (for example `tutorial.chapters.basics.title`).
A translated title is not a chapter description. Chapter IDs and progress versions
are independent of language.

In-game copy lives in `preview/locales/<locale>.json`. The viewer and tutorials load
only the requested catalog, using BGS preferences / tutorial launch locale. English
and French are currently available; regional French tags resolve to French and
unsupported languages fall back to English. Language changes preserve the table,
selected android, and program. Failed catalog requests fall back to English and
can be retried; stale requests cannot replace a newer language choice.

To add a language, create a catalog with the English keys and named placeholders,
and register its source filename in `preview/i18n.js` and `preview/server.js`. The
build validates key/placeholder parity, emits content-hashed JSON language files,
and embeds only their filenames. URLs resolve relative to the viewer script, so
BGS asset proxies and deployments under subdirectories work. Run `npm test` and
`npm run build` before uploading the **whole viewer bundle**.
