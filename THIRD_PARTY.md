# Sources and notices

## Mission schedules

`mission-data/catalog.json` is derived from:

- [nibuen/SpaceAlertMissionGenerator](https://github.com/nibuen/SpaceAlertMissionGenerator), revision `8dd0734c4f4a5c8ad9f1376a7459a87f32471f0e`.
- Source file: `app/src/main/java/com/boarbeard/generator/beimax/ConstructedMissions.java`.
- The source SHA-256 is recorded in the catalogue and checked by the importer.
- Repository MIT notice: Copyright (c) 2020 Leif Norcott. See [the preserved notice](LICENSES/mission-schedules-MIT.txt).

The import converts the 34 fixed scenarios to data. It does not port the random generator, bundle the Android application or include its recordings. Normalization turns phase durations and announcement times into explicit semantic deadlines and preserves double-action mission groups. An internal threat has no external zone. Unconfirmed reports are filtered by crew size at runtime.

Several related upstream files, including `EventList.kt`, `MissionImpl.kt` and `event/DataTransfer.kt`, carry explicit **GPL-3.0-or-later** notices for **JSpaceAlertMissionGenerator**, Copyright (C) 2011 Maximilian Kalus. The whole repository must not be assumed to be MIT merely because of the root LICENSE. The event-duration and phase-timing references used here are from those files. Their GPL text is retained in [LICENSES/generator-GPL-3.0.txt](LICENSES/generator-GPL-3.0.txt).

Java upstream reference: [mkalus/JSpaceAlertMissionGenerator](https://github.com/mkalus/JSpaceAlertMissionGenerator), inspected at revision `09a6a08bd805c7b2166644d42f2c03e79dceb200`. Any future code port must retain the applicable source notices. Newly written code in this repository is AGPL-3.0-only; third-party material retains its original terms.

## Game references

Space Alert and The New Frontier are designed by Vlaada Chvátil and published by Czech Games Edition.

- [BoardGameGeek entry](https://boardgamegeek.com/boardgame/38453/space-alert)
- [Publisher page](https://www.czechgames.com/games/space-alert)
- [Base rulebook](https://filemanager.czechgames.com/storage/files/space-alert/rules/space-alert-rules-en.pdf)
- [Teaching handbook](https://filemanager.czechgames.com/storage/files/space-alert/other-downloads/handbook/space-alert-handbook-en.pdf)
- [The New Frontier rulebook](https://filemanager.czechgames.com/storage/files/space-alert-the-new-frontier/rules/space-alert-2-rules-en.pdf)

No publisher artwork, scans, rulebook PDFs or voice recordings are bundled. Code licensing does not establish distribution permission for third-party game materials. Card/component data and any future supplied assets need their own provenance records.

## BGS references

The integration study used the current public [engine contract](https://docs.boardgamers.space/guide/engine-api), [viewer contract](https://docs.boardgamers.space/guide/viewer-api) and [timing documentation](https://docs.boardgamers.space/guide/timing), checked 2026-09-29. Neither the BGS platform nor the protocol package was modified.

## Component data verification (2026-09-30)

- Base action counts: public [SpaceAlertWeb inventory](https://github.com/Theophile-Varnier/SpaceAlertWeb), cross-checked with community component counts and the official rules. Factual counts were used; no source implementation was ported.
- Double-action counts: [mandark, List of double-action cards](https://boardgamegeek.com/filepage/89436/list-of-double-action-cards), 2013-04-01. Exact workbook hash and standard-library import procedure are in [components.md](docs/components.md). The copyrighted XLSX is not bundled; `double-deck.json` contains symbol pairs and counts.
- Threat component inspection: [Russian external threat faces](https://boardgamegeek.com/filepage/108685/russian-external-threats-cards), `external_rus_1.03_web.pdf`, and [Russian internal threat faces](https://boardgamegeek.com/filepage/108686/russian-internal-threats-cards), `internal_rus_1.05_web.pdf`, community translation/layout credited to Jay, uploaded by Igiigi. No scans or translated prose are redistributed. The rules DSL and viewer descriptions were written independently from factual card effects and official rules.
- Independent factual catalogue/trajectory cross-check: [ecm85/space-alert-resolver](https://github.com/ecm85/space-alert-resolver). No license was found; no source code or artwork from this repository is included.
- Career values and criteria: CGE's [official achievements sheet](https://filemanager.czechgames.com/storage/files/space-alert-the-new-frontier/other-downloads/achievements/space-alert-2-achievements-en.pdf) and [explorer log](https://filemanager.czechgames.com/storage/files/space-alert-the-new-frontier/other-downloads/explorers-log-sheets/space-alert-2-explorers-log-en.pdf). The viewer links to the official English/French criteria; it does not redistribute those PDFs.

These references identify the evidence used, not a claim of publisher endorsement. Local research PDFs/XLSX files and login information are outside the repository.
