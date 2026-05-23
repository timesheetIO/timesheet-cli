import { Command } from 'commander';
import inquirer from 'inquirer';
import { format } from 'date-fns';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import { getConfig } from '../../config/index.js';
import type { GlobalOptions, ColumnDef } from '../../types/index.js';
import type {
  Expense,
  ExpenseCreateRequest,
  ExpenseListParams,
  ExpenseUpdateRequest,
} from '@timesheet/sdk';

function formatDate(v: unknown): string {
  if (!v) return '-';
  return format(new Date(v as string), 'yyyy-MM-dd HH:mm');
}

export function registerExpensesCommands(program: Command): void {
  const expenses = program
    .command('expenses')
    .description('Expense management commands');

  expenses
    .command('list')
    .description('List expenses')
    .option('-t, --task <id>', 'Filter by task ID')
    .option('-d, --document <id>', 'Filter by document ID')
    .option('-o, --organization <id>', 'Filter by organization ID')
    .option('-p, --project <id>', 'Filter by project ID (repeatable)', (v, p: string[]) => [...p, v], [] as string[])
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--filter <filter>', 'Status filter')
    .option('-q, --search <query>', 'Free-text search')
    .option('-l, --limit <number>', 'Limit results', '20')
    .action(
      async (
        options: {
          task?: string;
          document?: string;
          organization?: string;
          project: string[];
          startDate?: string;
          endDate?: string;
          filter?: string;
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
        const params: ExpenseListParams = { limit };
        if (options.task) params.taskId = options.task;
        if (options.document) params.documentId = options.document;
        if (options.organization) params.organizationId = options.organization;
        if (options.project.length) params.projectIds = options.project;
        if (options.startDate) params.startDate = options.startDate;
        if (options.endDate) params.endDate = options.endDate;
        if (options.filter) params.filter = options.filter;
        if (options.search) params.search = options.search;

        spinner.start('Loading expenses...');
        const page = await client.expenses.list(params);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, page.items);
          return;
        }
        if (page.items.length === 0) {
          output(formatter, formatter.formatInfo('No expenses found.'));
          return;
        }

        const columns: ColumnDef<Expense>[] = [
          { key: 'id', header: 'ID', width: 36 },
          { key: 'dateTime', header: 'Date', width: 16, format: formatDate },
          { key: 'amount', header: 'Amount', width: 12, format: (v) => (v as string) || '-' },
          {
            key: 'refunded',
            header: 'Refunded',
            width: 10,
            format: (v) => (v ? 'Yes' : 'No'),
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
        output(formatter, formatter.formatHint(`Showing ${page.items.length} expenses.`));
      }
    );

  expenses
    .command('show')
    .description('Show expense details')
    .argument('<id>', 'Expense ID')
    .action(async (id: string, _options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Loading expense...');
      const expense = await client.expenses.get(id);
      spinner.stop();

      if (globalOptions.json) {
        output(formatter, expense);
        return;
      }

      const data: Record<string, string> = {
        ID: expense.id,
        Date: formatDate(expense.dateTime),
        Amount: expense.amount || '-',
        Refunded: expense.refunded ? 'Yes' : 'No',
      };
      if (expense.description) data['Description'] = expense.description;
      if (expense.task?.id) data['Task'] = expense.task.id;
      if (expense.fileName) data['Attachment'] = expense.fileName;
      if (expense.invoiceId) data['Invoice'] = expense.invoiceId;

      output(formatter, formatter.formatHeader('Expense'));
      newline();
      output(formatter, formatter.formatKeyValue(data));
    });

  expenses
    .command('create')
    .description('Create a new expense')
    .requiredOption('-t, --task <id>', 'Task ID')
    .requiredOption('-d, --date <datetime>', 'Date/time (ISO or YYYY-MM-DD)')
    .option('-a, --amount <amount>', 'Amount (decimal string)')
    .option('--description <text>', 'Description')
    .option('--refunded', 'Mark as refunded')
    .option('--file-name <name>', 'Attachment filename')
    .option('--file-uri <uri>', 'Attachment URI')
    .action(
      async (
        options: {
          task: string;
          date: string;
          amount?: string;
          description?: string;
          refunded?: boolean;
          fileName?: string;
          fileUri?: string;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: ExpenseCreateRequest = {
          taskId: options.task,
          dateTime: options.date,
        };
        if (options.amount) data.amount = options.amount;
        if (options.description) data.description = options.description;
        if (options.refunded) data.refunded = true;
        if (options.fileName) data.fileName = options.fileName;
        if (options.fileUri) data.fileUri = options.fileUri;

        spinner.start('Creating expense...');
        const expense = await client.expenses.create(data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, expense);
          return;
        }
        output(formatter, formatter.formatSuccess('Expense created!'));
        newline();
        output(
          formatter,
          formatter.formatKeyValue({
            ID: expense.id,
            Date: formatDate(expense.dateTime),
            Amount: expense.amount || '-',
          })
        );
      }
    );

  expenses
    .command('update')
    .description('Update an expense')
    .argument('<id>', 'Expense ID')
    .option('-d, --date <datetime>', 'Date/time')
    .option('-a, --amount <amount>', 'Amount')
    .option('--description <text>', 'Description')
    .option('--refunded', 'Mark refunded')
    .option('--no-refunded', 'Mark not refunded')
    .option('--file-name <name>', 'Attachment filename')
    .option('--file-uri <uri>', 'Attachment URI')
    .action(
      async (
        id: string,
        options: {
          date?: string;
          amount?: string;
          description?: string;
          refunded?: boolean;
          fileName?: string;
          fileUri?: string;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: ExpenseUpdateRequest = {};
        if (options.date) data.dateTime = options.date;
        if (options.amount) data.amount = options.amount;
        if (options.description !== undefined) data.description = options.description;
        if (options.refunded !== undefined) data.refunded = options.refunded;
        if (options.fileName !== undefined) data.fileName = options.fileName;
        if (options.fileUri !== undefined) data.fileUri = options.fileUri;

        if (Object.keys(data).length === 0) {
          output(formatter, formatter.formatWarning('No updates specified.'));
          return;
        }

        spinner.start('Updating expense...');
        const expense = await client.expenses.update(id, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, expense);
          return;
        }
        output(formatter, formatter.formatSuccess('Expense updated.'));
      }
    );

  expenses
    .command('delete')
    .description('Delete an expense')
    .argument('<id>', 'Expense ID')
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
            { type: 'confirm', name: 'confirm', message: `Delete expense ${id}?`, default: false },
          ]);
          if (!confirm) {
            output(formatter, formatter.formatInfo('Deletion cancelled.'));
            return;
          }
        }

        spinner.start('Deleting expense...');
        await client.expenses.delete(id);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, { deleted: true, id });
          return;
        }
        output(formatter, formatter.formatSuccess('Expense deleted.'));
      }
    );

  expenses
    .command('refund')
    .description('Mark an expense as refunded (or not)')
    .argument('<id>', 'Expense ID')
    .option('--refunded', 'Mark refunded (default)')
    .option('--no-refunded', 'Mark not refunded')
    .action(
      async (id: string, options: { refunded?: boolean }, command: Command) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const refunded = options.refunded === undefined ? true : options.refunded;
        spinner.start('Updating refund status...');
        const expense = await client.expenses.updateStatus({ id, refunded });
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, expense);
          return;
        }
        output(
          formatter,
          formatter.formatSuccess(`Expense marked ${refunded ? 'refunded' : 'not refunded'}.`)
        );
      }
    );

  expenses
    .command('file-url')
    .description('Get a download URL for the expense attachment')
    .argument('<id>', 'Expense ID')
    .action(async (id: string, _options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Fetching file URL...');
      const result = await client.expenses.getFileUrl(id);
      spinner.stop();

      if (globalOptions.json) {
        output(formatter, result);
        return;
      }
      output(formatter, result.url);
    });
}
