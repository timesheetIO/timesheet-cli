import { Command } from 'commander';
import inquirer from 'inquirer';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import { getConfig } from '../../config/index.js';
import type { GlobalOptions, ColumnDef } from '../../types/index.js';
import type {
  Todo,
  TodoCreateRequest,
  TodoListParams,
  TodoUpdateRequest,
} from '@timesheet/sdk';

const TODO_STATUS_OPEN = 0;
const TODO_STATUS_CLOSED = 1;

function statusLabel(status: number): string {
  return status === TODO_STATUS_CLOSED ? 'closed' : 'open';
}

export function registerTodosCommands(program: Command): void {
  const todos = program.command('todos').description('Todo management commands');

  todos
    .command('list')
    .description('List todos')
    .option('-p, --project <id>', 'Filter by project ID')
    .option('-s, --status <status>', 'Filter by status (open, closed)')
    .option('--assigned <user>', 'Filter by assigned user')
    .option('-q, --search <query>', 'Free-text search')
    .option('-l, --limit <number>', 'Limit results', '20')
    .action(
      async (
        options: {
          project?: string;
          status?: string;
          assigned?: string;
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
        const params: TodoListParams = { limit };
        if (options.project) params.projectId = options.project;
        if (options.status === 'open' || options.status === 'closed') {
          params.status = options.status;
        }
        if (options.assigned) params.assignedUsers = options.assigned;
        if (options.search) params.search = options.search;

        spinner.start('Loading todos...');
        const page = await client.todos.search(params);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, page.items);
          return;
        }
        if (page.items.length === 0) {
          output(formatter, formatter.formatInfo('No todos found.'));
          return;
        }

        const columns: ColumnDef<Todo>[] = [
          { key: 'id', header: 'ID', width: 36 },
          { key: 'name', header: 'Name', width: 30 },
          {
            key: 'status',
            header: 'Status',
            width: 8,
            format: (v) => statusLabel(v as number),
          },
          {
            key: 'project',
            header: 'Project',
            width: 20,
            format: (v) => (v as { title?: string } | undefined)?.title || '-',
          },
          {
            key: 'dueDate',
            header: 'Due',
            width: 12,
            format: (v) => (v as string) || '-',
          },
          {
            key: 'progress',
            header: 'Progress',
            width: 10,
            format: (v) => (v !== undefined ? `${v}%` : '-'),
          },
        ];

        output(formatter, formatter.formatTable(page.items, columns));
        newline();
        output(formatter, formatter.formatHint(`Showing ${page.items.length} todos.`));
      }
    );

  todos
    .command('show')
    .description('Show todo details')
    .argument('<id>', 'Todo ID')
    .action(async (id: string, _options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Loading todo...');
      const todo = await client.todos.get(id);
      spinner.stop();

      if (globalOptions.json) {
        output(formatter, todo);
        return;
      }

      const data: Record<string, string> = {
        ID: todo.id,
        Name: todo.name,
        Status: statusLabel(todo.status),
      };
      if (todo.description) data['Description'] = todo.description;
      if (todo.project?.title) data['Project'] = todo.project.title;
      if (todo.dueDate) data['Due'] = todo.dueDate;
      if (todo.assignedUsers) data['Assigned'] = todo.assignedUsers;
      if (todo.estimatedHours !== undefined || todo.estimatedMinutes !== undefined) {
        const h = todo.estimatedHours ?? 0;
        const m = todo.estimatedMinutes ?? 0;
        data['Estimated'] = `${h}h ${m}m`;
      }
      if (todo.progress !== undefined) data['Progress'] = `${todo.progress}%`;

      output(formatter, formatter.formatHeader('Todo'));
      newline();
      output(formatter, formatter.formatKeyValue(data));
    });

  todos
    .command('create')
    .description('Create a new todo')
    .argument('<name>', 'Todo name')
    .requiredOption('-p, --project <id>', 'Project ID')
    .option('-d, --description <text>', 'Description')
    .option('--due <date>', 'Due date (YYYY-MM-DD)')
    .option('--assigned <user>', 'Assigned user ID')
    .option('--hours <hours>', 'Estimated hours')
    .option('--minutes <minutes>', 'Estimated minutes')
    .action(
      async (
        name: string,
        options: {
          project: string;
          description?: string;
          due?: string;
          assigned?: string;
          hours?: string;
          minutes?: string;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: TodoCreateRequest = {
          name,
          projectId: options.project,
        };
        if (options.description) data.description = options.description;
        if (options.due) data.dueDate = options.due;
        if (options.assigned) data.assignedUsers = options.assigned;
        if (options.hours) data.estimatedHours = parseInt(options.hours, 10);
        if (options.minutes) data.estimatedMinutes = parseInt(options.minutes, 10);

        spinner.start('Creating todo...');
        const todo = await client.todos.create(data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, todo);
          return;
        }
        if (formatter.mode === 'pipe') {
          output(formatter, `created\t${todo.id}\t${todo.name}`);
          return;
        }
        output(formatter, formatter.formatSuccess('Todo created!'));
        newline();
        output(
          formatter,
          formatter.formatKeyValue({ ID: todo.id, Name: todo.name, Status: statusLabel(todo.status) })
        );
      }
    );

  todos
    .command('update')
    .description('Update a todo')
    .argument('<id>', 'Todo ID')
    .option('-n, --name <name>', 'New name')
    .option('-d, --description <text>', 'Description')
    .option(
      '-s, --status <status>',
      'Status (open, closed, or raw number)'
    )
    .option('--due <date>', 'Due date (YYYY-MM-DD)')
    .option('--assigned <user>', 'Assigned user ID')
    .option('--hours <hours>', 'Estimated hours')
    .option('--minutes <minutes>', 'Estimated minutes')
    .action(
      async (
        id: string,
        options: {
          name?: string;
          description?: string;
          status?: string;
          due?: string;
          assigned?: string;
          hours?: string;
          minutes?: string;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: TodoUpdateRequest = {};
        if (options.name) data.name = options.name;
        if (options.description !== undefined) data.description = options.description;
        if (options.status !== undefined) {
          if (options.status === 'open') data.status = TODO_STATUS_OPEN;
          else if (options.status === 'closed') data.status = TODO_STATUS_CLOSED;
          else {
            const n = parseInt(options.status, 10);
            if (!isNaN(n)) data.status = n;
          }
        }
        if (options.due !== undefined) data.dueDate = options.due;
        if (options.assigned !== undefined) data.assignedUsers = options.assigned;
        if (options.hours) data.estimatedHours = parseInt(options.hours, 10);
        if (options.minutes) data.estimatedMinutes = parseInt(options.minutes, 10);

        if (Object.keys(data).length === 0) {
          output(formatter, formatter.formatWarning('No updates specified.'));
          return;
        }

        spinner.start('Updating todo...');
        const todo = await client.todos.update(id, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, todo);
          return;
        }
        output(formatter, formatter.formatSuccess('Todo updated.'));
        newline();
        output(
          formatter,
          formatter.formatKeyValue({ ID: todo.id, Name: todo.name, Status: statusLabel(todo.status) })
        );
      }
    );

  todos
    .command('close')
    .description('Close (complete) a todo')
    .argument('<id>', 'Todo ID')
    .action(async (id: string, _options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Closing todo...');
      const todo = await client.todos.update(id, { status: TODO_STATUS_CLOSED });
      spinner.stop();

      if (globalOptions.json) {
        output(formatter, todo);
        return;
      }
      output(formatter, formatter.formatSuccess(`Todo "${todo.name}" closed.`));
    });

  todos
    .command('reopen')
    .description('Reopen a closed todo')
    .argument('<id>', 'Todo ID')
    .action(async (id: string, _options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Reopening todo...');
      const todo = await client.todos.update(id, { status: TODO_STATUS_OPEN });
      spinner.stop();

      if (globalOptions.json) {
        output(formatter, todo);
        return;
      }
      output(formatter, formatter.formatSuccess(`Todo "${todo.name}" reopened.`));
    });

  todos
    .command('delete')
    .description('Delete a todo')
    .argument('<id>', 'Todo ID')
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
            { type: 'confirm', name: 'confirm', message: `Delete todo ${id}?`, default: false },
          ]);
          if (!confirm) {
            output(formatter, formatter.formatInfo('Deletion cancelled.'));
            return;
          }
        }

        spinner.start('Deleting todo...');
        await client.todos.delete(id);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, { deleted: true, id });
          return;
        }
        output(formatter, formatter.formatSuccess('Todo deleted.'));
      }
    );
}
