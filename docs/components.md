# Component audit

Checked 2026-09-30. Rules are implemented in original code; component faces were transcribed as factual values and effects, not copied artwork or prose. This is a completeness inventory, not certification of every rule interaction.

| Component       | Implemented inventory                                                                                                  | Evidence                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Base actions    | 90 physical cards: for each of red, blue and lift, 10 × A, 8 × B, 7 × C, 5 × battlebots                                | Base rulebook total; independently matching SpaceAlertWeb component inventory and BGG community inventory |
| Double actions  | 90 physical cards, 78 distinct ordered face pairs                                                                      | BGG _List of double-action cards_ workbook, counts imported reproducibly                                  |
| Heroic actions  | 6 cards, each with the fixed action/movement pairing                                                                   | Component references and base rules                                                                       |
| Threats         | 55 base + 48 expansion; expansion replacement Fighter/Stealth Fighter are corrected base entries, not additional draws | Component faces, expansion appendix and reference inventory                                               |
| Trajectories    | 7 boards, 10–16 spaces; distances 1–5, 6–10, 11–16                                                                     | Component reference and rules                                                                             |
| Ship damage     | 6 different tiles per zone                                                                                             | Base rules                                                                                                |
| Specializations | 10 types, basic/advanced cards, levels 1–3                                                                             | Official expansion rules                                                                                  |
| Careers         | 30 level transitions, dotted hardcore boxes, official fixed achievements                                               | Official explorer log and achievement sheets                                                              |

## Exact action decks

The base multiset was cross-checked with the `ActionCards` inventory in [Theophile-Varnier/SpaceAlertWeb](https://github.com/Theophile-Varnier/SpaceAlertWeb). The six heroic movement destinations are not interchangeable with their printed heroic actions. The code calls those card faces `teleport:*` for serialization compatibility, but executes **heroic movement**: sealed doors and destination effects still apply. Teleporter specialization actions use actual teleportation rules.

The double deck comes from [mandark’s BGG workbook](https://boardgamegeek.com/filepage/89436/list-of-double-action-cards), uploaded 2013-04-01, `SATNF_-_Double_Actions.xlsx`:

```
SHA-256 3fb17351f46fd278962d4d02c3ade38e0a39c72c83f8951118dc8ee441d2e86c
```

The importer reads the worksheet's ordered symbol columns and physical counts, combining only identical face pairs. The workbook has 79 data rows; the repeated left / B / A row combines to produce 78 distinct pairs. Both face ordering and counts are retained in `src/game/double-deck.json`.

```sh
python3 scripts/import-action-deck.py /path/to/SATNF_-_Double_Actions.xlsx
```

The script verifies the source hash and uses only Python's standard library. The workbook is not redistributed.

## Threat verification

The expansion component audit used [external threat faces](https://boardgamegeek.com/filepage/108685/russian-external-threats-cards) and [internal threat faces](https://boardgamegeek.com/filepage/108686/russian-internal-threats-cards), read alongside the official English expansion appendix. The public [ecm85/space-alert-resolver](https://github.com/ecm85/space-alert-resolver) inventory provided an independent factual cross-check of identifiers, statistics and trajectories. That repository has no license notice: no implementation code or art was copied from it.

Corrections and interpretation points retained in code/tests:

- The corrected base Stealth Fighter has speed 3.
- Polarized Fighter is `E3-108`; one translated face duplicates the Phasing Pulser's `E3-102` ID.
- A trajectory's sixteenth space is still range 3.
- Pulse targets all external zones in range; a spanning threat is only hit once by a single pulse/rocket/interceptor attack.
- A carrier's reduction depends on interceptors being in the applicable range, not on the carrier being their selected target.
- Called threat cards are public recursively; a Vortex's surprise internal draw stays private until revealed by resolution.
- Ninja/Rabid Beast aftermath can persist after destruction; a discarded Vortex draw must not become a permanent malfunction.
- Campaign missions prepare new threat decks. A previous mission's used cards are not excluded from the next mission's deck.

## Experience and achievements

Primary sources: CGE's [English explorer sheet](https://filemanager.czechgames.com/storage/files/space-alert-the-new-frontier/other-downloads/explorers-log-sheets/space-alert-2-explorers-log-en.pdf) and [achievement sheet](https://filemanager.czechgames.com/storage/files/space-alert-the-new-frontier/other-downloads/achievements/space-alert-2-achievements-en.pdf), checked against the expansion rules. Blank XP boxes per level are `8 + 4 × level`; dotted prefixes are 0 for levels 0–1, then 4/7/10/13/16 for levels 2–6, then `4 + 2 × level`. Dotted boxes are skipped only when marking the following blank box; later consent to cloning does not revoke previously skipped boxes.

The engine checks minimum levels before the run, successful completion, applicable mission difficulty/crew constraints, and once-per-career / once-per-category limits. Social, personal close-call, hot-shot and specialization-use achievements may require observation or group judgment; the local viewer records the players' attestation, rather than pretending to infer it from the move log. The optional group-defined Hometown Hero achievement remains a paper/house-rule entry.

## Source discrepancy to resolve before online release

**Ninja poison timing:** the official English and French appendix activates drones when Ninja appears, whereas the translated card face places their release in action X. This implementation follows the official appendix (poison starts at appearance), with its X effect idempotently reasserting the state. The original English printed card or publisher errata should settle this discrepancy before BGS publication; it is not presented as verified agreement between all sources.

## Remaining validation and integration

The exact action decks and all standard threat faces are now available; no missing component is filled with a guessed deck distribution. Remaining work before an online release includes broader human playtesting of expansion combinations, mobile multi-client testing on physical devices and a decision about account-wide careers beyond the implemented table-local records. Random mission generation and licensed official art/audio are separate optional work; fixed missions and generated browser speech already run locally.
