# @timesheet/cli

Command-line interface for [timesheet.io](https://timesheet.io) time tracking.

## Installation

```bash
npm install -g @timesheet/cli
```

## Authentication

### OAuth 2.1 (Recommended)

The CLI supports OAuth 2.1 with PKCE for secure authentication:

```bash
timesheet auth login
```

This opens a browser window for authentication. The CLI automatically registers itself using Dynamic Client Registration (RFC 7591).

### API Key

For automation and CI/CD environments:

```bash
# Set via environment variable
export TIMESHEET_API_KEY=ts_your.apikey

# Or configure in CLI
timesheet auth apikey --set ts_your.apikey
```

Check authentication status:

```bash
timesheet auth status
```

## Usage

### Timer Commands

```bash
# Start timer for a project
timesheet timer start <project-id>

# Check timer status
timesheet timer status

# Pause/resume timer
timesheet timer pause
timesheet timer resume

# Stop timer (creates task)
timesheet timer stop
```

### Project Commands

```bash
# List projects
timesheet projects list

# Create a project
timesheet projects create "My Project"

# Show project details
timesheet projects show <id>

# Update/delete
timesheet projects update <id> --title "New Name"
timesheet projects delete <id>
```

### Task Commands

```bash
# List recent tasks
timesheet tasks list

# List today's tasks
timesheet tasks list --today

# Create a task manually
timesheet tasks create -p <project-id> -s "2024-01-15 09:00" -e "2024-01-15 17:00"

# Show/update/delete
timesheet tasks show <id>
timesheet tasks update <id> --billable
timesheet tasks delete <id>
```

### Teams & Tags

```bash
# List teams
timesheet teams list

# List/create/delete tags
timesheet tags list
timesheet tags create "Urgent" --color 1
timesheet tags delete <id>
```

### Filtering & Search

Most `list` commands accept filters that are applied server-side, including a free-text `--search`:

```bash
# Free-text search
timesheet projects list --search website
timesheet teams list --search design

# Filter expenses by project and date range
timesheet expenses list --project <project-id> --start-date 2024-01-01 --end-date 2024-01-31

# Filter absences by user, type and status
timesheet absences list --user <user-id> --type <type-id> --status approved

# Filter contracts by user
timesheet contracts list --user <user-id>
```

Use `--help` on any command to see its available filters, e.g. `timesheet expenses list --help`.

### Reports

```bash
# Time summary
timesheet reports summary --this-month

# Export last month as Excel, saved as timesheet_<start>_<end>.xlsx in the current directory
timesheet reports export --last-month

# PDF export with your own heading instead of the report name, saved to a file of your choice
timesheet reports export -f pdf -s 2024-01-01 -e 2024-01-31 --title "Hours report, Jane Smith" -o hours.pdf

# Billable time of two projects as CSV, saved into a folder
timesheet reports export --this-month -f csv -p <project-id>,<project-id> --filter billable -o exports/

# Print the download link instead of saving the file, or email the export
timesheet reports export --last-month --url-only
timesheet reports export --last-month -f pdf --email billing@example.com

# Report types for --report (default 0, the data report with one row per time entry)
timesheet reports types
```

`reports export` takes a period (`--this-month`, the default, `--last-month`, or `-s`/`-e`), a
report (`-r`, an ID or name), a format (`-f xlsx|xlsx1904|csv|pdf`), filters (`-p` projects, `-t`
teams, `-u` members, `--tag`, `--type`, `--filter`), and `--title`, `--filename`, `--summarize` and
`--split-tasks`. The HR reports take `--organization <id>`. Run `timesheet reports export --help` for
all of them.

### Export Templates

Templates save export settings to run for any period:

```bash
timesheet reports templates list
timesheet reports templates create "Monthly hours" -f pdf --title "Hours report, Jane Smith" --summarize
timesheet reports templates show <id>
timesheet reports templates run <id> --last-month -o exports/

# Options you leave out stay as they are; an empty value clears one
timesheet reports templates update <id> --title "Hours report, October"
timesheet reports templates update <id> --title ""

timesheet reports templates delete <id>
```

### Profile & Settings

```bash
# Show profile
timesheet profile show

# Show settings
timesheet profile settings
```

### Configuration

```bash
# Show config
timesheet config show

# Set a value
timesheet config set defaultProjectId <id>

# Reset to defaults
timesheet config reset
```

## Output Formats

The CLI supports three output formats:

### Human-Readable (Default)

Formatted tables with colors, shown when running in a terminal:

```
Timer Status

  Status:    ● Running
  Project:   Website Redesign
  Duration:  2h 34m
  Started:   Today, 09:15 AM
```

### Pipe-Friendly

Tab-separated values, automatically used when piping output:

```bash
timesheet projects list | cut -f1,2
```

### JSON

Machine-readable JSON output with `--json` flag:

```bash
timesheet timer status --json
```

## Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--no-color` | Disable colors |
| `--api-key <key>` | Use API key for this command |
| `--verbose` | Verbose output |
| `-q, --quiet` | Suppress non-essential output |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

## Configuration

Configuration is stored in `~/.timesheet-cli/`:

| Key | Description | Default |
|-----|-------------|---------|
| `apiUrl` | API base URL | `https://api.timesheet.io` |
| `colors` | Enable colors | `true` |
| `dateFormat` | Date format | `yyyy-MM-dd` |
| `timeFormat` | Time format | `HH:mm` |
| `defaultProjectId` | Default project for timer | - |
| `defaultTeamId` | Default team for new projects | - |
| `confirmDeletes` | Confirm before deleting | `true` |
| `paginationLimit` | Default page size | `20` |

Environment variables override config file settings. Use `TIMESHEET_` prefix:

```bash
export TIMESHEET_API_KEY=your-key
export TIMESHEET_COLORS=false
```

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Usage error (invalid arguments) |
| 3 | Authentication error |
| 4 | API error |
| 5 | Rate limit exceeded |
| 6 | Network error |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
node dist/index.js --help

# Development mode (watch)
npm run dev
```

## License

MIT
