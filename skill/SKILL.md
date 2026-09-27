---
name: timesheet
description: Track time and manage projects, tasks, absences, contracts, expenses, todos, and team data in timesheet.io, with the Timesheet connector's tools when they are available and the @timesheet/cli command-line tool otherwise
user-invocable: true
homepage: https://timesheet.io
metadata: {"requires": {"bins": ["timesheet"]}}
---

# Timesheet Skill

Control [timesheet.io](https://timesheet.io) through the Timesheet connector or from the shell. Default to non-destructive reads first (status, list, show) before mutating state.

## Connector or CLI

Check your tools first. When the Timesheet connector's tools are available, use them instead of the CLI: they need no install or login, and they also work on claude.ai and in Cowork, where the CLI usually isn't installed.

- Tool names follow `<area>_<action>` in the singular, such as `timer_start`, `task_list`, `project_create`, and `absence_approve`. Hosts may add a prefix, for example `mcp__timesheet__timer_start` in Claude Code. The CLI's `show` is the tool's `get`.
- Reports map to `statistics_get` for summaries (up to one year per call) and `export_generate` for xlsx, csv, or pdf exports, which it returns as a download URL. Get its `report` type from `export_report_types`.
- Take parameters from each tool's input schema, not from the CLI flags below. The workflows and rules in this skill still apply: only the call changes.

Use the CLI when the connector isn't available, for local defaults (`timesheet config`), or when an export must be saved as a file on disk. The connector handles sign-in itself, so `timesheet auth` is for the CLI only.

With the CLI, use `--json` on every read command so output is machine-parseable.

## Global flags

Available on every command:

| Flag | Purpose |
|------|---------|
| `--json` | Structured JSON output (always use when parsing) |
| `--no-color` | Disable ANSI colors |
| `--api-key <key>` | One-off API key (overrides the stored sign-in) |
| `--verbose` | Verbose logging |
| `-q, --quiet` | Suppress non-essential output |

The CLI auto-switches to TSV when stdout is piped, so `| cut`, `| awk`, and friends work without flags.

## Authentication

```bash
timesheet auth status --json     # check first
timesheet auth login             # OAuth 2.1 + PKCE (opens browser)
timesheet auth logout
timesheet auth apikey --set <your-api-key>
timesheet auth apikey --show     # masked
timesheet auth apikey --clear
```

For automation, store an API key with `timesheet auth apikey --set`. Exit code `3` means re-authentication is needed.

## Timer

```bash
timesheet timer status --json
timesheet timer start <project-id> [-d "Description"] [--billable | --no-billable]
timesheet timer pause
timesheet timer resume
timesheet timer stop [-d "Final description"]   # creates a task
timesheet timer update -d "..." [--billable] [-l "Location"]
```

`timer start` without an ID uses `defaultProjectId` from config if set.

## Tasks

```bash
timesheet tasks list --json [-p <project-id>] [-s YYYY-MM-DD] [-e YYYY-MM-DD] [--today] [-l 50]
timesheet tasks show <id> --json
timesheet tasks create -p <project-id> -s "2026-05-24 09:00" -e "2026-05-24 12:00" [-d "..."] [--billable] [-l "Office"]
timesheet tasks update <id> [-d "..."] [-s "10:00"] [-e "12:00"] [--billable|--no-billable] [--billed|--no-billed] [--paid|--no-paid] [-l "..."]
timesheet tasks delete <id>
```

Datetimes accept ISO 8601 or `YYYY-MM-DD HH:mm`. `tasks list` defaults to the last 7 days.

## Projects

```bash
timesheet projects list --json
timesheet projects show <id> --json
timesheet projects create "Project Name" [--billable] --json
timesheet projects update <id> [--title "..."]
timesheet projects delete <id>

# Project members
timesheet projects members list <project-id> --json
timesheet projects members add <project-id> [options]
timesheet projects members update <project-id> <member-id> [options]
timesheet projects members remove <project-id> <member-id>
```

## Teams

```bash
timesheet teams list --json
timesheet teams members list <team-id> --json
timesheet teams members add <team-id> [options]
timesheet teams members update <team-id> <member-id> [options]
timesheet teams members remove <team-id> <member-id>
timesheet teams members status --json    # who is currently tracking
```

## Organizations

```bash
timesheet organizations list --json
timesheet orgs list --json                # alias
timesheet organizations show <id>
timesheet organizations create "Acme" [-d "..."] [-c <color>] [--ai-chat]
timesheet organizations update <id> [options]
timesheet organizations delete <id>

# Organization members
timesheet organizations members list -o <org-id> --json
timesheet organizations members show <member-id>
timesheet organizations members add -o <org-id> [options]      # invites
timesheet organizations members update <member-id> [options]
timesheet organizations members remove <member-id>
```

## Contracts

```bash
timesheet contracts list -o <org-id> --json [-u <user-id>] [-s <status>] [-q "search"] [-l 50]
timesheet contracts show <id> --json
timesheet contracts create "Contract name" -u <user-id> -o <org-id> \
  [--valid-from YYYY-MM-DD] [--valid-to YYYY-MM-DD] \
  [--work-days 1111100] [--weekly-hours 40] [--daily-hours 8] \
  [--salary-type fixed] [--salary-amount 4500] [--salary-currency EUR] \
  [--vacation-days 25] [--country DE] [--timezone Europe/Berlin]
timesheet contracts update <id> [options]
timesheet contracts activate <id> -o <org-id>
timesheet contracts suspend <id> -o <org-id>
timesheet contracts reactivate <id> -o <org-id>
timesheet contracts terminate <id> -o <org-id>
timesheet contracts delete <id>
```

## Absences

```bash
timesheet absences list --json [-o <org-id>] [-c <contract-id>] [-u <user-id>] \
  [-t <type-id>] [-s <status>] [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD] \
  [--year 2026] [--exclude-rejected] [-q "vacation"] [-l 50]
timesheet absences show <id> --json
timesheet absences create -c <contract-id> -t <type-id> -s 2026-06-01 -e 2026-06-05 \
  [--full-day] [-r "Annual leave"] [--documentation-url <url>] \
  [--file-name "doctor.pdf"] [--file-uri "..."]
timesheet absences update <id> [options]
timesheet absences approve <id> [-o <org-id>]
timesheet absences reject <id> -r "Reason" [-o <org-id>]
timesheet absences cancel <id> [-r "Reason"] [-o <org-id>]
timesheet absences delete <id>
```

## Absence types

```bash
timesheet absence-types list -o <org-id> --json
timesheet absence-types show <id>
timesheet absence-types create <code> "Display name" -o <org-id> \
  [-d "..."] [-c <color>] [--paid|--no-paid] [--requires-approval] \
  [--requires-documentation] [--max-consecutive-days N] [--min-notice-days N] [--country DE]
timesheet absence-types update <id> [options]
timesheet absence-types delete <id>
```

## Todos

```bash
timesheet todos list --json [-p <project-id>] [-s open|closed] [--assigned <user-id>] [-q "search"] [-l 50]
timesheet todos show <id> --json
timesheet todos create "Todo name" [-p <project-id>] [-d "..."] [--due YYYY-MM-DD] \
  [--assigned <user-id>] [--hours 2] [--minutes 30]
timesheet todos update <id> [-n "New name"] [-d "..."] [-s open|closed] \
  [--due YYYY-MM-DD] [--assigned <user-id>] [--hours N] [--minutes N]
timesheet todos close <id>
timesheet todos reopen <id>
timesheet todos delete <id>
```

## Tags

```bash
timesheet tags list --json
timesheet tags show <id>
timesheet tags create "Urgent" [--color 1]
timesheet tags update <id> [options]
timesheet tags delete <id>
```

## Notes

```bash
timesheet notes list --json [-t <task-id>] [-d <document-id>] [-o <org-id>] \
  [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD] [-q "search"] [-l 50]
timesheet notes show <id> --json
timesheet notes create -t <task-id> --text "Meeting notes" [-d 2026-05-24] \
  [--uri "..."] [--drive-id "..."]
timesheet notes update <id> [options]
timesheet notes delete <id>
timesheet notes file-url <id>             # signed URL for the attachment
```

## Expenses

```bash
timesheet expenses list --json [-t <task-id>] [-d <document-id>] [-o <org-id>] \
  [-p <project-id>] [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD] \
  [--filter <status>] [-q "search"] [-l 50]
timesheet expenses show <id>
timesheet expenses create -t <task-id> -a 42.50 [-d 2026-05-24] \
  [--description "Taxi"] [--refunded] [--file-name "receipt.pdf"] [--file-uri "..."]
timesheet expenses update <id> [options]
timesheet expenses refund <id> [--refunded | --no-refunded]
timesheet expenses delete <id>
timesheet expenses file-url <id>
```

## Pauses (breaks)

```bash
timesheet pauses list --json [-t <task-id>] [-q "search"] [-l 50]
timesheet pauses show <id>
timesheet pauses create -t <task-id> -s "2026-05-24T12:00:00Z" -e "2026-05-24T12:30:00Z" \
  [--description "Lunch"]
timesheet pauses update <id> [options]
timesheet pauses delete <id>
```

## Rates

```bash
timesheet rates list --json [-t <team-id>] [-p <project-id>] [-s active|inactive|all] [-q "search"]
timesheet rates show <id>
timesheet rates create "Overtime" 1.5 [--extra <value>] [-t <team-id>] \
  [--enabled|--no-enabled] [--archived]
timesheet rates update <id> [options]
timesheet rates delete <id>
```

## Reports

```bash
timesheet reports summary --json [--this-month | --last-month | -s YYYY-MM-DD -e YYYY-MM-DD] [-p <project-id>]
timesheet reports export -f xlsx -s 2026-05-01 -e 2026-05-31 [-p <project-id>] [-o /path/out.xlsx]
timesheet reports export -f csv  --this-month
timesheet reports export -f pdf  -s 2026-05-01 -e 2026-05-31
```

## Profile & settings

```bash
timesheet profile show --json
timesheet profile update -f "First" -l "Last" [-e email] [--image-url <url>] [--newsletter|--no-newsletter]
timesheet profile settings --json
timesheet profile settings-update --theme dark --language en --timezone Europe/Berlin \
  [--currency EUR] [--date-format yyyy-MM-dd] [--time-format HH:mm] \
  [--duration-format decimal] [--first-day 1] [--default-task-duration 60] [--default-break-duration 30]
```

## Config (local CLI state)

```bash
timesheet config show
timesheet config set defaultProjectId <id>
timesheet config set defaultTeamId <id>
timesheet config set paginationLimit 50
timesheet config reset
```

Stored in `~/.timesheet-cli/`. Override at runtime with `TIMESHEET_*` environment variables (e.g. `TIMESHEET_COLORS=false`).

## Common workflows

### Log time for current work
1. `timesheet timer status --json`
2. If no running timer: `timesheet timer start <project-id>`
3. When done: `timesheet timer stop -d "What was accomplished"`

### Backfill a completed entry
```bash
timesheet tasks create -p <project-id> -s "2026-05-24 09:00" -e "2026-05-24 12:00" -d "Standup + dev" --json
```

### Find a project by name
```bash
timesheet projects list --json | jq '.[] | select(.title | contains("ProjectName"))'
```

### Approve all pending absences for an organization
```bash
timesheet absences list -o <org-id> -s pending --json \
  | jq -r '.items[].id' \
  | xargs -I{} timesheet absences approve {} -o <org-id>
```

### Onboard a new contractor
```bash
timesheet organizations members add -o <org-id> --email new@example.com [...]
timesheet contracts create "Contractor agreement" -u <user-id> -o <org-id> \
  --valid-from 2026-06-01 --weekly-hours 40 --vacation-days 25 --country DE
timesheet contracts activate <contract-id> -o <org-id>
```

## Error handling

Exit codes:
- `0` Success
- `1` General error
- `2` Usage error (invalid arguments)
- `3` Auth error - run `timesheet auth login`
- `4` API error
- `5` Rate limit exceeded - wait and retry
- `6` Network error

When a command fails on exit code `3`, prompt the user to re-authenticate before retrying. On `5`, back off before retrying.

With the connector, a failed call returns an error message instead of an exit code. If the connector reports that sign-in is needed, ask the user to reconnect it (in Claude Code: `/mcp`), then retry.

## Tips

- Always pass `--json` when the model needs to read output programmatically.
- Use `--quiet` (or `-q`) in scripts to suppress spinners and tips.
- Set `defaultProjectId` so `timer start` and many task commands can skip the project lookup.
- List endpoints accept `-l <number>` to raise the default page size of 20.
- Most write commands echo the created/updated resource as JSON when `--json` is passed, so you can pipe the result straight into the next command with `jq`.
