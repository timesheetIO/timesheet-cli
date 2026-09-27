# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-09-27

### Changed
- The bundled skill (`timesheet skill install`) uses the Timesheet connector's tools when they
  are available and the CLI otherwise, and documents work days as `1111100`.
- Package metadata for npm: `homepage` now points at timesheet.io, and `author` is
  normalized to `timesheet.io <support@timesheet.io>` across every Timesheet package.
- Copyright reassigned from the previous holder to `Timesheet - Mobile Time Tracking OG`,
  the registered company. The license itself is unchanged.

### Fixed
- `contracts create` and `contracts update` explain `--work-days` as the API stores it: seven
  characters from Monday, 1 for a work day and 0 for a day off, such as `1111100`. The old example
  `MTWTF--` saved contracts without work days.

## [1.1.0] - 2026-05-29

### Changed
- Upgraded `@timesheet/sdk` to `1.2.0`
- List commands now use the SDK `search()` endpoint so filters that the plain list endpoint silently ignored are applied server-side: `organizations`, `rates`, `projects`, `pauses`, and `teams` (free-text `--search`); `todos` (assigned users, `--search`); `expenses` (`--document`, `--project`, date range, `--search`); `notes` (`--document`, date range, `--search`); `absences` (`--user`, `--type`, `--status`, date range, `--year`, `--search`)

### Fixed
- `contracts list --user` now filters by user (the value was sent under a parameter the API did not recognize and was ignored)
- `reports summary` project grouping no longer breaks after the SDK removed `Task.projectId`; it now reads the nested project object

## [1.0.0] - 2025-01-05

### Added
- Timer commands: start, stop, pause, resume, status, update
- Project commands: list, show, create, update, delete
- Task commands: list, show, create, update, delete
- Team commands: list
- Authentication: OAuth 2.1 login, API key support, logout, status
- Configuration: show, set, reset
- Global options: --json, --no-color, --api-key, --verbose, --quiet
- Secure credential storage via keytar
- Spinner and progress indicators
- Exit codes for scripting
