# Agent notes

## Scope and sources

- Implement the base game **and The New Frontier**. [Component audit](docs/components.md) records exact decks, provenance and unresolved rules; the action decks are now complete. Ninja poison timing still needs a primary-source ruling before public release. Do not replace unknown facts with guesses.
- Keep the real-time programming clock separate from deterministic ship resolution. Never use client timestamps or audio playback as rule authority; preserve hidden hands/future announcements and idempotent commands.
- UI: readable, simplified ship/threat art and prominent pictograms; spatial labels/shapes supplement colors. Use BGS locale/preferences, not duplicate language controls. Keep native mobile scrolling and scrollable chat/journal.
- The local host is unauthenticated and saves the current mission/careers in `.local/session.json`. Do not expose it publicly or reset the user's session for QA.

## BGS tables and clock

Read [integration notes](docs/realtime-host.md) before touching lifecycle code. Protocol **0.8** is published; native presence, wakeups and table progress already exist. Do not rebuild them with viewer heartbeat moves.

- Preserve `tableMode: "live"`, `timeControl: "engine"`, `rating: "none"`. Readiness expires after two minutes; BGS uses a ten-second launch countdown. Expiry/disconnection before launch returns to waiting, not cancellation. Reconnection during flight does not pause or restart it.
- A campaign stays within one game. **Play again** creates a new game at the same table; only versioned `tableProgress` crosses that boundary. Careers are keyed by account ID, not seat, and remain table-local. Reject unknown checkpoint schemas rather than erasing progress.
- **Open integration question:** BGS's newer **Play now** lobby currently excludes persistent tables and engine-clock games. Its lobby ready check is not Space Alert's mission readiness. Decide how these flows should combine before adding quick-match support; do not silently remove either guard. Account-wide careers are also outside the implemented table-local contract.
- Check the sibling BGS repo's `apps/docs/docs/guide/timing.md`, `engine-api.md`, and `apps/api/app/routes/game/index.ts` for current behavior. Local platform changes do not prove deployment. Platform/protocol changes need their own scoped task.

## Publication and verification

- GitHub remote: `boardgamers/space-alert`. BGS slug `space-alert`, version **1**, stays **private** until explicitly requested otherwise. Git pushes do not update BGS.
- `npm test`, `npm run build`, then `npm pack`; upload the tarball with entry `bgs/engine.js` and `dist/viewer.js` with global `SpaceAlert`. Follow [README](README.md#build-for-bgs); `bgs/gameinfo.json` is a metadata template, not a snapshot of the deployed package version.
- BGS admin API base: `https://admin.boardgamers.space/api/admin/gameinfo/space-alert`. Load the bearer token from `~/.bgs` without printing it. Read/back up `/1` and `/meta` first; POST the tarball to `/1/engine`, POST the viewer to `/1/viewer/file?filename=viewer.js&bundle=<content-hash>`, then PUT `/1` with the returned asset metadata while preserving unrelated settings. Verify the private flag, clock/table settings and downloaded viewer bytes afterward. Bump the package version for engine changes.
- Lifecycle changes need multi-client checks: expired readiness, background/disconnected tabs, late commands, reconnect, and Play again with seats reordered/careers retained. Rules tests alone do not validate deployed table behavior or phone audio. Broader expansion playtesting remains necessary before public release.
