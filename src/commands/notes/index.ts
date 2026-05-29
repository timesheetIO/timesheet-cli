import { Command } from 'commander';
import inquirer from 'inquirer';
import { format } from 'date-fns';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import { getConfig } from '../../config/index.js';
import type { GlobalOptions, ColumnDef } from '../../types/index.js';
import type {
  Note,
  NoteCreateRequest,
  NoteListParams,
  NoteUpdateRequest,
} from '@timesheet/sdk';

function formatDate(v: unknown): string {
  if (!v) return '-';
  return format(new Date(v as string), 'yyyy-MM-dd HH:mm');
}

export function registerNotesCommands(program: Command): void {
  const notes = program.command('notes').description('Note management commands');

  notes
    .command('list')
    .description('List notes')
    .option('-t, --task <id>', 'Filter by task ID')
    .option('-d, --document <id>', 'Filter by document ID')
    .option('-o, --organization <id>', 'Filter by organization ID')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('-q, --search <query>', 'Free-text search')
    .option('-l, --limit <number>', 'Limit results', '20')
    .action(
      async (
        options: {
          task?: string;
          document?: string;
          organization?: string;
          startDate?: string;
          endDate?: string;
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
        const params: NoteListParams = { limit };
        if (options.task) params.taskId = options.task;
        if (options.document) params.documentId = options.document;
        if (options.organization) params.organizationId = options.organization;
        if (options.startDate) params.startDate = options.startDate;
        if (options.endDate) params.endDate = options.endDate;
        if (options.search) params.search = options.search;

        spinner.start('Loading notes...');
        const page = await client.notes.search(params);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, page.items);
          return;
        }
        if (page.items.length === 0) {
          output(formatter, formatter.formatInfo('No notes found.'));
          return;
        }

        const columns: ColumnDef<Note>[] = [
          { key: 'id', header: 'ID', width: 36 },
          { key: 'dateTime', header: 'Date', width: 16, format: formatDate },
          {
            key: 'text',
            header: 'Text',
            width: 40,
            format: (v) => {
              const t = (v as string) || '-';
              return t.length > 37 ? `${t.substring(0, 37)}...` : t;
            },
          },
        ];

        output(formatter, formatter.formatTable(page.items, columns));
        newline();
        output(formatter, formatter.formatHint(`Showing ${page.items.length} notes.`));
      }
    );

  notes
    .command('show')
    .description('Show note details')
    .argument('<id>', 'Note ID')
    .action(async (id: string, _options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Loading note...');
      const note = await client.notes.get(id);
      spinner.stop();

      if (globalOptions.json) {
        output(formatter, note);
        return;
      }

      const data: Record<string, string> = {
        ID: note.id,
        Date: formatDate(note.dateTime),
      };
      if (note.text) data['Text'] = note.text;
      if (note.task?.id) data['Task'] = note.task.id;
      if (note.uri) data['Attachment'] = note.uri;

      output(formatter, formatter.formatHeader('Note'));
      newline();
      output(formatter, formatter.formatKeyValue(data));
    });

  notes
    .command('create')
    .description('Create a new note')
    .requiredOption('-t, --task <id>', 'Task ID')
    .requiredOption('-d, --date <datetime>', 'Date/time (ISO or YYYY-MM-DD)')
    .requiredOption('--text <text>', 'Note text')
    .option('--uri <uri>', 'Attachment URI')
    .option('--drive-id <id>', 'Drive file ID')
    .action(
      async (
        options: {
          task: string;
          date: string;
          text: string;
          uri?: string;
          driveId?: string;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: NoteCreateRequest = {
          taskId: options.task,
          dateTime: options.date,
          text: options.text,
        };
        if (options.uri) data.uri = options.uri;
        if (options.driveId) data.driveId = options.driveId;

        spinner.start('Creating note...');
        const note = await client.notes.create(data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, note);
          return;
        }
        output(formatter, formatter.formatSuccess('Note created!'));
        newline();
        output(formatter, formatter.formatKeyValue({ ID: note.id, Date: formatDate(note.dateTime) }));
      }
    );

  notes
    .command('update')
    .description('Update a note')
    .argument('<id>', 'Note ID')
    .option('-d, --date <datetime>', 'Date/time')
    .option('--text <text>', 'Note text')
    .option('--uri <uri>', 'Attachment URI')
    .option('--drive-id <id>', 'Drive file ID')
    .action(
      async (
        id: string,
        options: { date?: string; text?: string; uri?: string; driveId?: string },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: NoteUpdateRequest = {};
        if (options.date) data.dateTime = options.date;
        if (options.text !== undefined) data.text = options.text;
        if (options.uri !== undefined) data.uri = options.uri;
        if (options.driveId !== undefined) data.driveId = options.driveId;

        if (Object.keys(data).length === 0) {
          output(formatter, formatter.formatWarning('No updates specified.'));
          return;
        }

        spinner.start('Updating note...');
        const note = await client.notes.update(id, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, note);
          return;
        }
        output(formatter, formatter.formatSuccess('Note updated.'));
      }
    );

  notes
    .command('delete')
    .description('Delete a note')
    .argument('<id>', 'Note ID')
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
            { type: 'confirm', name: 'confirm', message: `Delete note ${id}?`, default: false },
          ]);
          if (!confirm) {
            output(formatter, formatter.formatInfo('Deletion cancelled.'));
            return;
          }
        }

        spinner.start('Deleting note...');
        await client.notes.delete(id);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, { deleted: true, id });
          return;
        }
        output(formatter, formatter.formatSuccess('Note deleted.'));
      }
    );

  notes
    .command('file-url')
    .description('Get a download URL for the note attachment')
    .argument('<id>', 'Note ID')
    .action(async (id: string, _options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Fetching file URL...');
      const result = await client.notes.getFileUrl(id);
      spinner.stop();

      if (globalOptions.json) {
        output(formatter, result);
        return;
      }
      output(formatter, result.url);
    });
}
