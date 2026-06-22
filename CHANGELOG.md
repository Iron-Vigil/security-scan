# Changelog

All notable changes to this action are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The `v0`
tag tracks the latest `0.x` release.

## [Unreleased]

## [0.1.0] - 2026-06-21

Initial release.

### Added
- grype-powered CVE scanning of a path, directory, or container image (`target`).
- Severity gate (`fail-on`) — fail the build at `critical`, `high`, `medium`, `low`, or `negligible`, or `none` to report only. The threshold is a floor, so `high` also fails on `critical`.
- SARIF report output (`sarif-file`, default `ironvigil-results.sarif`) for upload to GitHub code scanning.
- Job-summary table of findings (severity, CVE, package, installed version, fixed version), sorted by severity.
- Step outputs: `critical`, `high`, and `sarif-file`.
- Optional submission of results to an Iron Vigil workspace via `iron-vigil-token` / `iron-vigil-api` (best-effort; the scan and gate still run if the API is unreachable).
- Composite action — runs on any Linux runner, no container build required.

[Unreleased]: https://github.com/Iron-Vigil/security-scan/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Iron-Vigil/security-scan/releases/tag/v0.1.0
