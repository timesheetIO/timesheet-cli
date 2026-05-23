import type { Command } from 'commander';
import { getClient } from '../../../sdk/index.js';
import { createFormatter, output, newline } from '../../../output/index.js';
import { createSpinner } from '../../../utils/index.js';
import { getConfig } from '../../../config/index.js';
import type { GlobalOptions, ColumnDef } from '../../../types/index.js';
import type { MemberStatusParams, Member } from '@timesheet/sdk';

export function registerTeamMembersStatusCommand(parent: Command): void {
  parent
    .command('status')
    .description('Show members with their current activity status')
    .option('-t, --team <team-id>', 'Team ID')
    .option('-p, --project <project-id>', 'Project ID')
    .option('-o, --organization <organization-id>', 'Organization ID')
    .option(
      '-s, --status <status>',
      'Filter by status (all, active, inactive, running, idle)'
    )
    .option('-l, --limit <number>', 'Limit results', '50')
    .action(
      async (
        options: {
          team?: string;
          project?: string;
          organization?: string;
          status?: string;
          limit: string;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const limit = parseInt(options.limit, 10) || getConfig('paginationLimit');
        const params: MemberStatusParams = { limit };
        if (options.team) params.teamId = options.team;
        if (options.project) params.projectId = options.project;
        if (options.organization) params.organizationId = options.organization;
        if (options.status) params.status = options.status;

        spinner.start('Loading member status...');
        const page = await client.teams.getMemberStatus(params);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, page.items);
          return;
        }

        if (page.items.length === 0) {
          output(formatter, formatter.formatInfo('No members found.'));
          return;
        }

        const columns: ColumnDef<Member>[] = [
          {
            key: 'displayName',
            header: 'Name',
            width: 24,
            format: (v, row) =>
              (v as string) ||
              `${row.firstname || ''} ${row.lastname || ''}`.trim() ||
              row.email ||
              '-',
          },
          { key: 'email', header: 'Email', width: 30 },
          {
            key: 'activity',
            header: 'State',
            width: 10,
            format: (v) => ((v as { running?: boolean } | undefined)?.running ? 'running' : 'idle'),
          },
          {
            key: 'activity',
            header: 'Project',
            width: 20,
            format: (v) => (v as { projectTitle?: string } | undefined)?.projectTitle || '-',
          },
        ];

        output(formatter, formatter.formatTable(page.items, columns));
        newline();
        output(formatter, formatter.formatHint(`Showing ${page.items.length} members.`));
      }
    );
}
