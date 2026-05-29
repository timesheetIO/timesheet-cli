import type { Command } from 'commander';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import { getConfig } from '../../config/index.js';
import type { GlobalOptions, ColumnDef } from '../../types/index.js';
import type { Team, TeamListParams } from '@timesheet/sdk';

export function registerTeamsListCommand(parent: Command): void {
  parent
    .command('list')
    .description('List all teams')
    .option('-q, --search <query>', 'Free-text search')
    .option('-l, --limit <number>', 'Limit results', '20')
    .action(
      async (
        options: { search?: string; limit: string },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        spinner.start('Loading teams...');

        const limit = parseInt(options.limit, 10) || getConfig('paginationLimit');
        const params: TeamListParams = { limit };
        if (options.search) params.search = options.search;

        const page = await client.teams.search(params);
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
          {
            key: 'projects',
            header: 'Projects',
            width: 10,
            format: (v) => String((v as number) ?? 0),
          },
        ];

        output(formatter, formatter.formatTable(page.items, columns));
        newline();
        output(formatter, formatter.formatHint(`Showing ${page.items.length} teams.`));
      }
    );
}
