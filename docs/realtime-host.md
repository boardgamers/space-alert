# BGS integration

The adapter is in `bgs/engine.js`; the hosted viewer is `bgs/viewer.js`. It uses BGS protocol 0.8 and the platform's durable engine wakeups. The standalone development server remains useful for rule tests, but is not the online host.

## Clock and commands

BGS supplies a trusted `context.now` after acquiring the game lock. The adapter never trusts browser timestamps. It exposes `advanceTime` and `nextWakeup`; BGS saves each semantic deadline and wakes the game even when everyone closes their browser. It also commits due events before accepting a player move. Late moves return HTTP 422.

The crew can wait indefinitely. **I’m ready** lasts two minutes; everyone must be ready at once. BGS launches after a ten-second countdown, with native BGS presence checks. The platform tracks loaded, visible tabs; the viewer sends no heartbeat moves. Expiry, withdrawal or a disconnect returns to waiting without cancelling the game. Once the flight starts, reconnecting never restarts or pauses it.

Commands carry a sequence number per seat. Repeated committed commands are harmless; gaps and stale edits are rejected. The viewer receives `move:result` acknowledgements and refreshes after rejection. Snapshots omit seeds, future announcements, decks and other players' hands. Server time accompanies snapshots so the browser can animate the countdown between updates.

The adapter reports waiting, playing and between-mission phases. While waiting or between campaign missions, **Leave table** ends the attempt without a quit penalty. Once play begins, that shortcut is unavailable.

After programming, resolution has no deadline. Campaign repairs and the decision to launch the next mission are untimed too. Only the next presence check and flight restart the clock. Campaigns contain three or five missions within one BGS game; their repairs and shared results stay in that game state.

## Same table, new game

BGS **Play again** creates a new game record with fresh randomness, the same reserved seats and optional setup changes. The crew stays seated at the same table URL, with one shared chat. The next Space Alert mission opens its preparation screen immediately; everyone uses **I’m ready** there. Async games such as Fuji ask for one new confirmation per play. Reservations send no invitation emails. Old games remain available through the table's paginated history. This generic flow also works for asynchronous games such as Fuji.

BGS carries only the versioned `tableProgress` checkpoint into the next game's `init`; full game states are never copied. The adapter keeps career totals, achievements and the latest mission summary, keyed by account ID. Older summaries stay with their original replays. `migrateTableProgress` rejects unknown schemas. Cancellation clears an unfinished run without awarding experience; disabling careers preserves earned progress.

Careers are **table-local**, not account-wide profiles. Moving to another table starts a separate career. There is no global campaign directory or cross-table character synchronization. The game version is retained between games; retired versions ask players to create a new table.

## Results and limitations

Configure `timeControl: "engine"` and `rating: "none"`. Players receive the shared mission/campaign score, without competitive Elo settlement. BGS individual clock rings and turn emails are disabled. Game-managed clocks do not yet support BGS analysis mode. The viewer retains its own resolution replay.

Use external voice for cooperation. Speech synthesis is optional; no official recordings or publisher artwork are bundled. Players must honor communications blackouts in their external voice channel. Physical-device audio/background behavior and expansion combinations still need human playtesting before public release.

## Verification

`npm test` covers trusted timestamps, deadline catch-up without clients, readiness expiry, withdrawal and disconnect recovery, duplicate commands, late rejections, spectator secrecy, reordered-seat career inheritance, cancellation, and the underlying game rules. BGS tests cover durable wakeups, terminal notifications, atomic table creation, concurrent continuations, access checks and seat confirmation. The hosted viewer has also been exercised with two authenticated browser sessions, including a mobile viewport.
