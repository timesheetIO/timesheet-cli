import type { Command } from 'commander';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import { getConfig } from '../../config/index.js';
import type { GlobalOptions, ColumnDef } from '../../types/index.js';
import type { Organization, OrganizationListParams } from '@timesheet/sdk';

export function registerOrganizationsListCommand(parent: Command): void {
  parent
    .command('list')
    .description('List organizations')
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

        spinner.start('Loading organizations...');

        const limit = parseInt(options.limit, 10) || getConfig('paginationLimit');
        const params: OrganizationListParams = { limit };
        if (options.search) params.search = options.search;

        const page = await client.organizations.search(params);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, page.items);
          return;
        }

        if (page.items.length === 0) {
          output(formatter, formatter.formatInfo('No organizations found.'));
          return;
        }

        const columns: ColumnDef<Organization>[] = [
          { key: 'id', header: 'ID', width: 36 },
          { key: 'name', header: 'Name', width: 30 },
          {
            key: 'permission',
            header: 'Permission',
            width: 16,
            format: (v) => {
              const p = v as { admin?: boolean; invoicing?: boolean; billing?: boolean } | undefined;
              if (!p) return '-';
              const flags = [
                p.admin ? 'admin' : null,
                p.invoicing ? 'invoicing' : null,
                p.billing ? 'billing' : null,
              ].filter(Boolean);
              return flags.length ? flags.join(',') : '-';
            },
          },
        ];

        output(formatter, formatter.formatTable(page.items, columns));
        newline();
        output(formatter, formatter.formatHint(`Showing ${page.items.length} organizations.`));
      }
    );
}
