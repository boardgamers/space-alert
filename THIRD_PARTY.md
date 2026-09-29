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
