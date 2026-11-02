# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `reports export --title <title>` sets the heading printed at the top of a PDF export, such as
  "Hours report, Jane Smith". Without it the PDF shows the report's name, as before. Excel and CSV
  exports have no title row.
- `reports export` options: `-r, --report` (an ID or name, default 0, the data report), `-t, --team`,
  `-u, --user`, `--tag`, `--type`, `--filter`, `--split-tasks`, `--summarize`, `--filename`,
  `--organization` for the HR reports, `--this-month` and `--last-month`. `-p, --project` and the other
  filters take comma-separated IDs, and `-f` also takes `xlsx1904`.
- `reports export --url-only` prints the download link instead of saving the file, and
  `reports export --email <address>` sends the export by email.
- `reports types` lists the report types.
- `reports templates list|show|create|update|delete|run` manages export templates and runs one for a
  period. `update` changes only the options you pass, and `--title ""` clears the PDF title.

### Fixed
- `reports export` saves the file: to `-o` (a file, or a directory) or as
  `timesheet_<start>_<end>.<format>` in the current directory. It only downloads over https. Before,
  it reported success without saving anything, ignored `-o`, and exported report type 1 instead of
  the data report.
- Exports, export templates and report PDFs go to the configured `reportsUrl`. The setting was never
  passed to the SDK, so these calls always went to the production reports service.
- `reports summary -s/-e` keeps the given days west of UTC: a date was read as UTC midnight, so the
  period started a day early. Invalid dates and two periods at once are refused, as in `reports export`.

### Changed
- `reports export` no longer requires `-f`, `-s` and `-e`: the format defaults to `xlsx` and the
  period to this month up to today, as in `reports summary`.

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
