import { Command } from 'commander';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import type { GlobalOptions, ColumnDef } from '../../types/index.js';
import type { Team } from '@timesheet/sdk';

export function registerTeamsCommands(program: Command): void {
  const teams = program.command('teams').description('Team management commands');

  teams
    .command('list')
    .description('List all teams')
    .action(async (_options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Loading teams...');

      const page = await client.teams.list();

      spinner.stop();

      if (globalOptions.json) {
        output(formatter, page.items);
        return;
      }

      if (page.items.length === 0) {
        output(formatter, formatter.formatInfo('No teams found.'));
        return;
      }

      const columns: ColumnDef<Team>[] = [
        { key: 'id', header: 'ID', width: 36 },
        { key: 'name', header: 'Name', width: 30 },
        {
          key: 'members',
          header: 'Members',
          width: 10,
          format: (v) => String((v as number) ?? 0),
        },
      ];

      output(formatter, formatter.formatTable(page.items, columns));
      newline();
      output(
        formatter,
        formatter.formatHint(`Showing ${page.items.length} teams.`)
      );
    });
}
