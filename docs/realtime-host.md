# Proposed real-time boundary for BGS

**Proposal only.** Nothing in the BGS platform or `@boardgamers/protocol` has been edited. The names below belong to this repository's prototype, not to the currently published BGS API.

## What exists today

The [BGS engine API](https://docs.boardgamers.space/guide/engine-api) already has simultaneous `currentPlayer` values, `stripSecret`, live updates, cancellation and replay hooks. These are useful building blocks.

The [current timing contract](https://docs.boardgamers.space/guide/timing) is per-player thinking time. Engines receive no trusted clock context, and expiration is not an autonomous engine callback. Consequently, readiness expiration and Space Alert announcements cannot be implemented faithfully by making browser clients send a timer move. A game with all browsers closed must still progress or cancel.

## Suggested responsibility split

| Host responsibility                                                      | Game responsibility                                                     |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Authenticated seat, ordered commands and trusted receipt timestamp       | Decide whether the command is legal at that time                        |
| Durable wakeup scheduler, rescheduling after restart                     | Return the next meaningful deadline and consume all due events          |
| Store state and command receipt atomically; publish per-viewer snapshots | Deterministic transitions, idempotent event cursor and secret filtering |
| Clock synchronization and full-state refresh after reconnect             | Common mission start, individual phase locks and future-event secrecy   |
| Apply cancellation and cooperative/no-rating semantics                   | Decide missing-presence cancellation versus mission success/failure     |
| Persist cross-game explorer records when this becomes available          | Validate progression, achievements and exactly-once career results      |

The game owns the readiness rule; the host supplies the time and wakeup. A separate platform-wide “confirm presence” subsystem is not required just for Space Alert, though a generic capability may later be useful to other real-time games.

## Concrete prototype contract

```js
createSession({ players, crewSize, mission }, trustedNow);
nextWakeup(state); // absolute deadline, or null
advanceClock(state, trustedNow); // deterministic catch-up
submit(state, authenticatedSeat, command, trustedReceivedAt);
// -> { state, accepted, error?, duplicate? }
snapshot(state, authenticatedSeat); // undefined seat means spectator
```

The local preview calls these directly. Future BGS integration may extend `init`/`move` with a host context and add time/deadline hooks, or adapt an equivalent generic scheduled-event interface. Settle names and types in the protocol change; do not ship a game-specific pseudo-hook that the current host silently ignores.

### Presence and launch

- Finish mission selection/role setup before creating the timed session.
- Start one fixed 120-second presence deadline when the game session is created. Each human must explicitly confirm. Merely being connected, or an old scheduled-table confirmation, is not enough.
- The confirmation interaction should also prepare audio where possible, with an explicit visual/muted alternative. Spectators and androids do not confirm presence.
- Once all humans confirm, replace the presence deadline with a common start three seconds later. Do not restart or extend the clock on refresh, repeated confirmation or another tab opening.
- At `now >= presenceDeadline`, cancel if anyone is still missing, including if nobody sends another move. The game returns the reason and missing seats; the platform applies a penalty-free cancellation, not a ranked loss.
- After launch, disconnecting does not pause the mission or delete that crew member's committed program. Reconnect at the existing mission time. Policy for deliberate quitting after launch still needs a product decision; do not reuse preflight cancellation to erase a losing mission.

### Ordering and deadlines

Serialize clock events and player requests per game. Assign timestamps at an authoritative, ordered ingress; do not trust `Date.now()` sent by a browser. Drain commands already accepted before a cutoff before processing that cutoff. Requests at the cutoff are late for the old phase. Define this ordering once in the host, including across processes.

Call `advanceClock` before validating each request and persist its returned state **even if the request is rejected**. It may have crossed a deadline or cancelled the game. Also call it from autonomous wakeups. Late/repeated wakeups process all due semantic events exactly once via the persisted cursor. No per-second engine writes are needed.

Persist state, revision, timer target and command acknowledgement atomically. On restart reload the state, catch up, then schedule `nextWakeup`. Publishing occurs after the durable commit. The prototype demonstrates serialization and catch-up in pure functions; its local HTTP server is intentionally in-memory, not a production durable scheduler.

The prototype uses per-seat sequence numbers. The full card engine should add card/slot preconditions for shared android edits and transfers; one global expected revision would unnecessarily reject unrelated simultaneous human edits.

### Secrecy, reconnect and audio

Keep random seeds, future announcements, unopened packets and threat decks server-side. Snapshots and log slices need the same secret-filtering discipline. Do not preload the future randomly generated mission into the viewer just to schedule audio. Fixed, publicly known mission tracks are not a promise that their content is unknowable; hidden random missions require server-only generation.

Return a server timestamp and authoritative phase/state on reconnect. Browser timers animate a display between sync points; background throttling must not stop the mission. Audio is driven by semantic event IDs and a synchronized clock. Do not replay every missed recording in a burst after reconnect. If a clip runs long, the mission deadline still wins; localization must not change mission duration.

Semantic announcements in this prototype are not synchronized to recording waveforms. A transfer's imported 15-second event duration comes from the upstream model; verify the actual transfer beep/closing instant before enabling real card transfers.

### Cooperative results and experience

`rankings: [1,1,1,1]` alone would describe a competitive tie, not successful cooperative play. Confirm the platform's handling of shared outcomes and exclude ordinary competitive Elo updates. Cancellation should skip both outcome and experience writes.

Experience belongs to an explorer profile linked to a user, separate from seat numbers and game settings. Career writes require an idempotency key based on the completed game/mission and explorer. A failed request or replay cannot grant XP twice. Implement the career rules in the game behind a persistence interface while leaving the eventual BGS storage/API work deferred.

## Acceptance tests for the future host

- No connected clients: presence expires and cancels once.
- Last confirmation just before versus exactly at the deadline.
- Reconnect, second browser tab, duplicate request and reordered delivery.
- Server restart during countdown, blackout, transfer and phase transition.
- Simultaneous commands from distinct seats; competing android-slot writes.
- A slow client cannot backdate commands or expose future threats.
- Clock correction does not move a committed phase backward.
- Spectators receive only revealed information; replay preserves intended secrecy.
- Mobile background/resume and audio permission failure do not extend the mission.
- Final cooperative result and career updates are applied exactly once.
