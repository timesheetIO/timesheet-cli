import type { Command } from 'commander';
import { format } from 'date-fns';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import { getConfig } from '../../config/index.js';
import type { GlobalOptions, ColumnDef } from '../../types/index.js';
import type { Absence, AbsenceListParams } from '@timesheet/sdk';
import { resolveOrganizationId } from './helpers.js';

export function registerAbsencesListCommand(parent: Command): void {
  parent
    .command('list')
    .description('List absences')
    .option('-o, --organization <id>', 'Organization ID')
    .option('-c, --contract <id>', 'Filter by contract ID')
    .option('-u, --user <id>', 'Filter by user ID')
    .option('-t, --type <id>', 'Filter by absence type ID')
    .option('-s, --status <status>', 'Filter by status')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--year <year>', 'Filter by year')
    .option('--exclude-rejected', 'Exclude rejected/cancelled')
    .option('-q, --search <query>', 'Free-text search')
    .option('-l, --limit <number>', 'Limit results', '20')
    .action(
      async (
        options: {
          organization?: string;
          contract?: string;
          user?: string;
          type?: string;
          status?: string;
          startDate?: string;
          endDate?: string;
          year?: string;
          excludeRejected?: boolean;
          search?: string;
          limit: string;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        spinner.start('Loading absences...');

        const limit = parseInt(options.limit, 10) || getConfig('paginationLimit');
        const params: AbsenceListParams = { limit };
        if (options.contract) params.contractId = options.contract;
        if (options.user) params.userId = options.user;
        if (options.type) params.absenceTypeId = options.type;
        if (options.status) params.status = options.status;
        if (options.startDate) params.startDate = options.startDate;
        if (options.endDate) params.endDate = options.endDate;
        if (options.year) params.year = parseInt(options.year, 10);
        if (options.excludeRejected) params.excludeRejectedCancelled = true;
        if (options.search) params.search = options.search;

        const page = await client.absences.search(organizationId, params);

        spinner.stop();

        if (globalOptions.json) {
          output(formatter, page.items);
          return;
        }

        if (page.items.length === 0) {
          output(formatter, formatter.formatInfo('No absences found.'));
          return;
        }

        const formatDate = (v: unknown): string => {
          if (!v) return '-';
          return format(new Date(v as string), 'yyyy-MM-dd');
        };

        const columns: ColumnDef<Absence>[] = [
          { key: 'id', header: 'ID', width: 36 },
          { key: 'startDateTime', header: 'Start', width: 12, format: formatDate },
          { key: 'endDateTime', header: 'End', width: 12, format: formatDate },
          {
            key: 'absenceType',
            header: 'Type',
            width: 16,
            format: (v) => (v as { name?: string } | undefined)?.name || '-',
          },
          {
            key: 'status',
            header: 'Status',
            width: 12,
            format: (v) => (v as string) || '-',
          },
          {
            key: 'member',
            header: 'Member',
            width: 24,
            format: (v) => {
              const m = v as { displayName?: string; email?: string } | undefined;
              return m?.displayName || m?.email || '-';
            },
          },
        ];

        output(formatter, formatter.formatTable(page.items, columns));
        newline();
        output(formatter, formatter.formatHint(`Showing ${page.items.length} absences.`));
      }
    );
}
