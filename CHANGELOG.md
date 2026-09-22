# Changelog

## 0.3.0 — Unreleased

### Breaking changes

- Advanced runtime exports moved from `jevlish` to `jevlish/runtime`.
- Builder and expression classes moved from `jevlish` to `jevlish/types`.
- `Candidates` and `Selection` are now `ChoiceBuilder` and `Choice`.
- `ChooseCandidates` and `Choose` are now `SubjectChoiceBuilder` and
  `SubjectChoice`.
- The default Noul policy changed from yes/no thresholds of `0.9`/`0.1` to
  `0.8`/`0.2`. Configure the old thresholds explicitly to preserve that
  behavior.

### Added

- `jevlish/testing` with deterministic transports and Noul, Choice, and Score
  answer builders.
- Dedicated `jevlish/runtime`, `jevlish/testing`, and `jevlish/types` package
  entry points.
- Documentation site and packed-tarball checks against the sample apps.

### Fixed

- Chained `.withPolicy()` calls now merge consistently on `given` and `from`.
- Runtime chunk sizes and policy thresholds now reject invalid numeric values.

## 0.2.0

- Renamed the public language around meanings, choices, projections, query
  results, and plans.

## 0.1.0

- Initial npm release.
