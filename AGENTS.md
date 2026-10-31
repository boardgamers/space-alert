# Agent notes

## Scope and sources

- Implement the base game **and The New Frontier**. [Component audit](docs/components.md) records exact decks, provenance and unresolved rules; the action decks are now complete. Ninja poison timing still needs a primary-source ruling before public release. Do not replace unknown facts with guesses.
- Keep the real-time programming clock separate from deterministic ship resolution. Never use client timestamps or audio playback as rule authority; preserve hidden hands/future announcements and idempotent commands.
- UI: readable, simplified ship/threat art and prominent pictograms; spatial labels/shapes supplement colors. Use BGS locale/preferences, not duplicate language controls. Keep native mobile scrolling and scrollable chat/journal.
- The local host is unauthenticated and saves the current mission/careers in `.local/session.json`. Do not expose it publicly or reset the user's session for QA.

## BGS tables and clock

Read [integration notes](docs/realtime-host.md) before touching lifecycle code. Protocol **0.10.0** is published; native presence, wakeups and table progress already exist. Do not rebuild them with viewer heartbeat moves.

- Preserve `tableMode: "live"`, `timeControl: "engine"`, `rating: "none"`. Readiness expires after two minutes; BGS uses a ten-second launch countdown. Expiry/disconnection before launch returns to waiting, not cancellation. Reconnection during flight does not pause or restart it.
- A campaign stays within one game. **Play again** creates a new game at the same table; only versioned `tableProgress` crosses that boundary. Careers are keyed by account ID, not seat, and remain table-local. Reject unknown checkpoint schemas rather than erasing progress.
- **Open integration question:** BGS's newer **Play now** lobby currently excludes persistent tables and engine-clock games. Its lobby ready check is not Space Alert's mission readiness. Decide how these flows should combine before adding quick-match support; do not silently remove either guard. Account-wide careers are also outside the implemented table-local contract.
- Check the sibling BGS repo's `apps/docs/docs/guide/timing.md`, `engine-api.md`, and `apps/api/app/routes/game/index.ts` for current behavior. Local platform changes do not prove deployment. Platform/protocol changes need their own scoped task.

## Publication and verification

- GitHub remote: `boardgamers/space-alert`. BGS slug `space-alert`, version **1**, stays **private** until explicitly requested otherwise. Git pushes do not update BGS.
- `npm test`, `npm run build`, then `npm pack`; upload the tarball with entry `bgs/engine.js` and the complete viewer bundle (`dist/viewer.js` plus `dist/locales/*.json`, preserving paths) with global `SpaceAlert`. Follow [README](README.md#build-for-bgs); `bgs/gameinfo.json` is a metadata template, not a snapshot of the deployed package version.
- BGS admin API base: `https://admin.boardgamers.space/api/admin/gameinfo/space-alert`. Load the bearer token from `~/.bgs` without printing it. Read/back up `/1` and `/meta` first; POST the tarball to `/1/engine`, POST each viewer bundle file to `/1/viewer/file?filename=<relative-path>&bundle=<content-hash>`, then PUT `/1` with the returned asset metadata while preserving unrelated settings. Verify the private flag, clock/table settings and downloaded viewer bytes afterward. Bump the package version for engine changes.
- Follow the current [Adding a game guide](https://docs.boardgamers.space/guide/adding-a-game); the sibling monorepo has the same source at `apps/docs/docs/guide/adding-a-game.md`. The public-release checklist is not satisfied merely by this private playtest.
- Stage only `viewer.js` and the current hashed `locales/*.json` in a clean release directory; exclude `viewer-meta.json`. The sibling `scripts/publish-viewer.mjs --game space-alert --version 1 --dir <release> --entry viewer.js --token ~/.bgs --record <backup> --apply --activate` uploads and verifies every file before switching the viewer URL. Do not update only the entry script.
- Publish `version.tutorial` from `bgs/gameinfo.json` with the viewer; IDs and progress versions must match the controller. Use English base titles and empty descriptions, not translated subtitles. In-game translations are authored EN/FR JSON chunks; other BGS locales currently fall back to English.
- `/meta` protects `translations` and `optionTranslations`; round-tripping those fields does not publish them. As in Puerto Rico, use BGS's dedicated `/meta/translate` or `/meta/translate-all` for platform catalog/setup/chapter metadata only, and verify hashes and chapter labels afterward. Do not use translation APIs for authored in-game/tutorial catalogs.
- Upload the original, tightly bounded transparent `bgs/pictogram.svg` with `PUT /assets/pictogram`, content type `image/svg+xml`. The server crops transparent borders and normalizes it. Save only the intended metadata fields (description, etc.), not a stale full metadata snapshot.
- Engine upload immediately changes the requested package; installation/activation is asynchronous. Verify tarball/download integrity and distinguish requested metadata from confirmed activation. Keep `public: false`, `timeControl: "engine"`, `tableMode: "live"`, and `rating: "none"`; never create production test tables or alter existing missions just to check a release.
- Lifecycle changes need multi-client checks: expired readiness, background/disconnected tabs, late commands, reconnect, and Play again with seats reordered/careers retained. Rules tests alone do not validate deployed table behavior or phone audio. Broader expansion playtesting remains necessary before public release.

## BGS publication and Git delivery

Whenever changes are published to BGS, commit the corresponding source, tests,
dependency/lockfile changes and version bumps, then push them to this repository's
`main` or `master` release branch in the same task. A BGS upload or a push only to
a feature branch does not complete delivery. This is standing authorization to
commit and push published changes without asking for separate confirmation.

Fetch and integrate the latest release-branch changes, run the relevant repository
checks, and push without force. Update any public mirrors required by this repo's
existing workflow too. Keep credentials, generated artifacts excluded by the repo,
and unrelated unfinished work out of the commit. Verify the remote branch contains
the delivered commit and report any blocker instead of claiming delivery.
