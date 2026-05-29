import { Command } from 'commander';
import inquirer from 'inquirer';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import { getConfig } from '../../config/index.js';
import type { GlobalOptions, ColumnDef } from '../../types/index.js';
import type {
  Rate,
  RateCreateRequest,
  RateListParams,
  RateUpdateRequest,
} from '@timesheet/sdk';

export function registerRatesCommands(program: Command): void {
  const rates = program.command('rates').description('Rate management commands');

  rates
    .command('list')
    .description('List rates')
    .option('-t, --team <id>', 'Filter by team ID')
    .option('-p, --project <id>', 'Filter by project ID')
    .option(
      '-s, --status <status>',
      'Filter by status (active, inactive, all)',
      'active'
    )
    .option('-q, --search <query>', 'Free-text search')
    .option('-l, --limit <number>', 'Limit results', '20')
    .action(
      async (
        options: {
          team?: string;
          project?: string;
          status: string;
          search?: string;
          limit: string;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const limit = parseInt(options.limit, 10) || getConfig('paginationLimit');
        const params: RateListParams = { limit };
        if (options.team) params.teamId = options.team;
        if (options.project) params.projectId = options.project;
        if (options.status === 'active' || options.status === 'inactive' || options.status === 'all') {
          params.status = options.status;
        }
        if (options.search) params.search = options.search;

        spinner.start('Loading rates...');
        const page = await client.rates.search(params);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, page.items);
          return;
        }
        if (page.items.length === 0) {
          output(formatter, formatter.formatInfo('No rates found.'));
          return;
        }

        const columns: ColumnDef<Rate>[] = [
          { key: 'id', header: 'ID', width: 36 },
          { key: 'title', header: 'Title', width: 24 },
          { key: 'factor', header: 'Factor', width: 10 },
          { key: 'extra', header: 'Extra', width: 10, format: (v) => (v as string) || '-' },
          {
            key: 'archived',
            header: 'Status',
            width: 10,
            format: (v) => (v ? 'Archived' : 'Active'),
          },
          {
            key: 'team',
            header: 'Team',
            width: 20,
            format: (v) => (v as { name?: string } | undefined)?.name || '-',
          },
        ];

        output(formatter, formatter.formatTable(page.items, columns));
        newline();
        output(formatter, formatter.formatHint(`Showing ${page.items.length} rates.`));
      }
    );

  rates
    .command('show')
    .description('Show rate details')
    .argument('<id>', 'Rate ID')
    .action(async (id: string, _options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Loading rate...');
      const rate = await client.rates.get(id);
      spinner.stop();

      if (globalOptions.json) {
        output(formatter, rate);
        return;
      }

      const data: Record<string, string> = {
        ID: rate.id,
        Title: rate.title,
        Factor: rate.factor,
        Status: rate.archived ? 'Archived' : 'Active',
        Enabled: rate.enabled ? 'Yes' : 'No',
      };
      if (rate.extra) data['Extra'] = rate.extra;
      if (rate.team?.id) data['Team'] = rate.team.name || rate.team.id;

      output(formatter, formatter.formatHeader('Rate'));
      newline();
      output(formatter, formatter.formatKeyValue(data));
    });

  rates
    .command('create')
    .description('Create a new rate')
    .argument('<title>', 'Rate title')
    .argument('<factor>', 'Rate factor (decimal string)')
    .option('--extra <value>', 'Extra value')
    .option('-t, --team <id>', 'Team ID')
    .option('--enabled', 'Mark as enabled (default)')
    .option('--no-enabled', 'Mark as disabled')
    .option('--archived', 'Create as archived')
    .action(
      async (
        title: string,
        factor: string,
        options: {
          extra?: string;
          team?: string;
          enabled?: boolean;
          archived?: boolean;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: RateCreateRequest = { title, factor };
        if (options.extra) data.extra = options.extra;
        if (options.team) data.teamId = options.team;
        if (options.enabled !== undefined) data.enabled = options.enabled;
        if (options.archived) data.archived = true;

        spinner.start('Creating rate...');
        const rate = await client.rates.create(data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, rate);
          return;
        }
        if (formatter.mode === 'pipe') {
          output(formatter, `created\t${rate.id}\t${rate.title}`);
          return;
        }
        output(formatter, formatter.formatSuccess('Rate created!'));
        newline();
        output(
          formatter,
          formatter.formatKeyValue({ ID: rate.id, Title: rate.title, Factor: rate.factor })
        );
      }
    );

  rates
    .command('update')
    .description('Update a rate')
    .argument('<id>', 'Rate ID')
    .option('-t, --title <title>', 'New title')
    .option('-f, --factor <factor>', 'Rate factor')
    .option('--extra <value>', 'Extra value')
    .option('--enabled', 'Enable the rate')
    .option('--no-enabled', 'Disable the rate')
    .option('--archive', 'Archive the rate')
    .option('--unarchive', 'Unarchive the rate')
    .action(
      async (
        id: string,
        options: {
          title?: string;
          factor?: string;
          extra?: string;
          enabled?: boolean;
          archive?: boolean;
          unarchive?: boolean;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: RateUpdateRequest = {};
        if (options.title) data.title = options.title;
        if (options.factor) data.factor = options.factor;
        if (options.extra !== undefined) data.extra = options.extra;
        if (options.enabled !== undefined) data.enabled = options.enabled;
        if (options.archive) data.archived = true;
        if (options.unarchive) data.archived = false;

        if (Object.keys(data).length === 0) {
          output(formatter, formatter.formatWarning('No updates specified.'));
          return;
        }

        spinner.start('Updating rate...');
        const rate = await client.rates.update(id, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, rate);
          return;
        }
        output(formatter, formatter.formatSuccess('Rate updated.'));
        newline();
        output(
          formatter,
          formatter.formatKeyValue({
            ID: rate.id,
            Title: rate.title,
            Factor: rate.factor,
            Status: rate.archived ? 'Archived' : 'Active',
          })
        );
      }
    );

  rates
    .command('delete')
    .description('Delete a rate')
    .argument('<id>', 'Rate ID')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(
      async (id: string, options: { force?: boolean }, command: Command) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        if (
          !options.force &&
          getConfig('confirmDeletes') &&
          process.stdout.isTTY &&
          !globalOptions.json
        ) {
          const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
            { type: 'confirm', name: 'confirm', message: `Delete rate ${id}?`, default: false },
          ]);
          if (!confirm) {
            output(formatter, formatter.formatInfo('Deletion cancelled.'));
            return;
          }
        }

        spinner.start('Deleting rate...');
        await client.rates.delete(id);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, { deleted: true, id });
          return;
        }
        output(formatter, formatter.formatSuccess('Rate deleted.'));
      }
    );
}
