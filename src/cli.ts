import { Command } from 'commander';
import { registerCommands } from './commands/index.js';
import { handleError } from './utils/index.js';

/**
 * Create and configure the CLI program
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('timesheet')
    .description('Timesheet.io CLI for time tracking')
    .version('1.1.0', '-v, --version', 'Display version number')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colors')
    .option('--api-key <key>', 'API key for authentication')
    .option('--verbose', 'Verbose output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .helpOption('-h, --help', 'Display help information')
    .addHelpText(
      'after',
      `
Examples:
  $ timesheet auth login              Login with OAuth 2.1
  $ timesheet timer start <project>   Start timer for a project
  $ timesheet timer stop              Stop the current timer
  $ timesheet tasks list --today      List today's tasks
  $ timesheet projects list           List all projects

Authentication:
  Use OAuth 2.1: timesheet auth login
  Use API Key:   export TIMESHEET_API_KEY=your-key

For more information, visit: https://docs.timesheet.io/cli
`
    );

  // Register all commands
  registerCommands(program);

  // Handle unknown commands
  program.on('command:*', () => {
    console.error(`Error: Unknown command '${program.args.join(' ')}'`);
    console.error();
    console.error('Run "timesheet --help" for usage information.');
    process.exit(2);
  });

  return program;
}

/**
 * Run the CLI
 */
export async function run(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(argv);
  } catch (error) {
    handleError(error);
  }
}
