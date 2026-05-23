import type { Command } from 'commander';
import { getClient } from '../../../sdk/index.js';
import { createFormatter, output, newline } from '../../../output/index.js';
import { createSpinner } from '../../../utils/index.js';
import { getConfig } from '../../../config/index.js';
import type { GlobalOptions, ColumnDef } from '../../../types/index.js';
import type { TeamMember, TeamMemberListParams } from '@timesheet/sdk';

export function registerTeamMembersListCommand(parent: Command): void {
  parent
    .command('list')
    .description('List members of a team')
    .argument('<team-id>', 'Team ID')
    .option('-s, --status <status>', 'Filter by status')
    .option('--without-me', 'Exclude the current user')
    .option('--include-deleted', 'Include deleted members')
    .option('-q, --search <query>', 'Free-text search')
    .option('-l, --limit <number>', 'Limit results', '20')
    .action(
      async (
        teamId: string,
        options: {
          status?: string;
          withoutMe?: boolean;
          includeDeleted?: boolean;
          search?: string;
          limit: string;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        spinner.start('Loading team members...');

        const limit = parseInt(options.limit, 10) || getConfig('paginationLimit');
        const params: TeamMemberListParams = { limit, teamId };
        if (options.status) params.status = options.status;
        if (options.withoutMe) params.withoutMe = true;
        if (options.includeDeleted) params.deleted = true;
        if (options.search) params.search = options.search;

        const page = await client.teams.listMembers(teamId, params);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, page.items);
          return;
        }

        if (page.items.length === 0) {
          output(formatter, formatter.formatInfo('No team members found.'));
          return;
        }

        const columns: ColumnDef<TeamMember>[] = [
          { key: 'id', header: 'Member ID', width: 36 },
          {
            key: 'displayName',
            header: 'Name',
            width: 24,
            format: (v, row) =>
              (v as string) ||
              `${row.firstname || ''} ${row.lastname || ''}`.trim() ||
              '-',
          },
          { key: 'email', header: 'Email', width: 30 },
          {
            key: 'permission',
            header: 'Role',
            width: 12,
            format: (v) => (v as { role?: string } | undefined)?.role || '-',
          },
          {
            key: 'invited',
            header: 'Status',
            width: 10,
            format: (v, row) =>
              row.deleted ? 'deleted' : v ? 'invited' : 'active',
          },
        ];

        output(formatter, formatter.formatTable(page.items, columns));
        newline();
        output(formatter, formatter.formatHint(`Showing ${page.items.length} members.`));
      }
    );
}
