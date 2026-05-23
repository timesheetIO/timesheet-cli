import { Command } from 'commander';
import inquirer from 'inquirer';
import { format } from 'date-fns';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import { getConfig } from '../../config/index.js';
import { formatDurationSeconds } from '../../utils/index.js';
import type { GlobalOptions, ColumnDef } from '../../types/index.js';
import type {
  Pause,
  PauseCreateRequest,
  PauseListParams,
  PauseUpdateRequest,
} from '@timesheet/sdk';

function formatDate(v: unknown): string {
  if (!v) return '-';
  return format(new Date(v as string), 'yyyy-MM-dd HH:mm');
}

function pauseDuration(p: Pause): string {
  if (!p.startDateTime || !p.endDateTime) return '-';
  const start = new Date(p.startDateTime).getTime();
  const end = new Date(p.endDateTime).getTime();
  return formatDurationSeconds(Math.max(0, Math.floor((end - start) / 1000)));
}

export function registerPausesCommands(program: Command): void {
  const pauses = program.command('pauses').description('Pause/break management commands');

  pauses
    .command('list')
    .description('List pauses')
    .option('-t, --task <id>', 'Filter by task ID')
    .option('-q, --search <query>', 'Free-text search')
    .option('-l, --limit <number>', 'Limit results', '20')
    .action(
      async (
        options: { task?: string; search?: string; limit: string },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const limit = parseInt(options.limit, 10) || getConfig('paginationLimit');
        const params: PauseListParams = { limit };
        if (options.task) params.taskId = options.task;
        if (options.search) params.search = options.search;

        spinner.start('Loading pauses...');
        const page = await client.pauses.list(params);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, page.items);
          return;
        }
        if (page.items.length === 0) {
          output(formatter, formatter.formatInfo('No pauses found.'));
          return;
        }

        const columns: ColumnDef<Pause>[] = [
          { key: 'id', header: 'ID', width: 36 },
          { key: 'startDateTime', header: 'Start', width: 16, format: formatDate },
          { key: 'endDateTime', header: 'End', width: 16, format: formatDate },
          {
            key: 'startDateTime',
            header: 'Duration',
            width: 10,
            format: (_, row) => pauseDuration(row),
          },
          {
            key: 'description',
            header: 'Description',
            width: 30,
            format: (v) => {
              const d = (v as string) || '-';
              return d.length > 27 ? `${d.substring(0, 27)}...` : d;
            },
          },
        ];

        output(formatter, formatter.formatTable(page.items, columns));
        newline();
        output(formatter, formatter.formatHint(`Showing ${page.items.length} pauses.`));
      }
    );

  pauses
    .command('show')
    .description('Show pause details')
    .argument('<id>', 'Pause ID')
    .action(async (id: string, _options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Loading pause...');
      const pause = await client.pauses.get(id);
      spinner.stop();

      if (globalOptions.json) {
        output(formatter, pause);
        return;
      }

      const data: Record<string, string> = {
        ID: pause.id,
        Start: formatDate(pause.startDateTime),
        End: formatDate(pause.endDateTime),
        Duration: pauseDuration(pause),
      };
      if (pause.description) data['Description'] = pause.description;
      if (pause.task?.id) data['Task'] = pause.task.id;
      if (pause.running) data['Running'] = 'Yes';

      output(formatter, formatter.formatHeader('Pause'));
      newline();
      output(formatter, formatter.formatKeyValue(data));
    });

  pauses
    .command('create')
    .description('Create a pause/break entry')
    .requiredOption('-t, --task <id>', 'Task ID')
    .requiredOption('-s, --start <datetime>', 'Start (ISO)')
    .requiredOption('-e, --end <datetime>', 'End (ISO)')
    .option('--description <text>', 'Description')
    .action(
      async (
        options: { task: string; start: string; end: string; description?: string },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: PauseCreateRequest = {
          taskId: options.task,
          startDateTime: options.start,
          endDateTime: options.end,
        };
        if (options.description) data.description = options.description;

        spinner.start('Creating pause...');
        const pause = await client.pauses.create(data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, pause);
          return;
        }
        output(formatter, formatter.formatSuccess('Pause created!'));
        newline();
        output(
          formatter,
          formatter.formatKeyValue({
            ID: pause.id,
            Start: formatDate(pause.startDateTime),
            End: formatDate(pause.endDateTime),
            Duration: pauseDuration(pause),
          })
        );
      }
    );

  pauses
    .command('update')
    .description('Update a pause')
    .argument('<id>', 'Pause ID')
    .option('-s, --start <datetime>', 'Start (ISO)')
    .option('-e, --end <datetime>', 'End (ISO)')
    .option('--description <text>', 'Description')
    .action(
      async (
        id: string,
        options: { start?: string; end?: string; description?: string },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: PauseUpdateRequest = {};
        if (options.start) data.startDateTime = options.start;
        if (options.end) data.endDateTime = options.end;
        if (options.description !== undefined) data.description = options.description;

        if (Object.keys(data).length === 0) {
          output(formatter, formatter.formatWarning('No updates specified.'));
          return;
        }

        spinner.start('Updating pause...');
        const pause = await client.pauses.update(id, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, pause);
          return;
        }
        output(formatter, formatter.formatSuccess('Pause updated.'));
      }
    );

  pauses
    .command('delete')
    .description('Delete a pause')
    .argument('<id>', 'Pause ID')
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
            { type: 'confirm', name: 'confirm', message: `Delete pause ${id}?`, default: false },
          ]);
          if (!confirm) {
            output(formatter, formatter.formatInfo('Deletion cancelled.'));
            return;
          }
        }

        spinner.start('Deleting pause...');
        await client.pauses.delete(id);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, { deleted: true, id });
          return;
        }
        output(formatter, formatter.formatSuccess('Pause deleted.'));
      }
    );
}
