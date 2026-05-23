import { Command } from 'commander';
import inquirer from 'inquirer';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import { getConfig } from '../../config/index.js';
import type { GlobalOptions, ColumnDef } from '../../types/index.js';
import type {
  AbsenceType,
  AbsenceTypeCreateRequest,
  AbsenceTypeUpdateRequest,
} from '@timesheet/sdk';
import { resolveOrganizationId } from '../absences/helpers.js';

export function registerAbsenceTypesCommands(program: Command): void {
  const types = program
    .command('absence-types')
    .description('Absence type management commands');

  types
    .command('list')
    .description('List absence types')
    .option('-o, --organization <id>', 'Organization ID')
    .action(
      async (options: { organization?: string }, command: Command) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        spinner.start('Loading absence types...');
        const page = await client.absenceTypes.list(organizationId);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, page.items);
          return;
        }

        if (page.items.length === 0) {
          output(formatter, formatter.formatInfo('No absence types found.'));
          return;
        }

        const columns: ColumnDef<AbsenceType>[] = [
          { key: 'id', header: 'ID', width: 36 },
          { key: 'code', header: 'Code', width: 12 },
          { key: 'name', header: 'Name', width: 24 },
          {
            key: 'paid',
            header: 'Paid',
            width: 6,
            format: (v) => (v ? 'Yes' : 'No'),
          },
          {
            key: 'requiresApproval',
            header: 'Approval',
            width: 10,
            format: (v) => (v ? 'Yes' : 'No'),
          },
        ];

        output(formatter, formatter.formatTable(page.items, columns));
        newline();
        output(formatter, formatter.formatHint(`Showing ${page.items.length} absence types.`));
      }
    );

  types
    .command('show')
    .description('Show absence type details')
    .argument('<id>', 'Absence type ID')
    .option('-o, --organization <id>', 'Organization ID')
    .action(
      async (id: string, options: { organization?: string }, command: Command) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        spinner.start('Loading absence type...');
        const type = await client.absenceTypes.get(organizationId, id);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, type);
          return;
        }

        const data: Record<string, string> = {
          ID: type.id,
          Code: type.code,
          Name: type.name,
          Paid: type.paid ? 'Yes' : 'No',
          'Requires Approval': type.requiresApproval ? 'Yes' : 'No',
          'Requires Documentation': type.requiresDocumentation ? 'Yes' : 'No',
        };
        if (type.description) data['Description'] = type.description;
        if (type.maxConsecutiveDays) data['Max Consecutive Days'] = String(type.maxConsecutiveDays);
        if (type.minNoticeDays) data['Min Notice Days'] = String(type.minNoticeDays);
        if (type.countryCode) data['Country'] = type.countryCode;

        output(formatter, formatter.formatHeader('Absence Type'));
        newline();
        output(formatter, formatter.formatKeyValue(data));
      }
    );

  types
    .command('create')
    .description('Create a new absence type')
    .argument('<code>', 'Type code')
    .argument('<name>', 'Type name')
    .option('-o, --organization <id>', 'Organization ID')
    .option('-d, --description <text>', 'Description')
    .option('-c, --color <number>', 'Color code')
    .option('--paid', 'Paid absence')
    .option('--no-paid', 'Unpaid absence')
    .option('--requires-approval', 'Requires approval')
    .option('--requires-documentation', 'Requires documentation')
    .option('--max-consecutive-days <n>', 'Max consecutive days')
    .option('--min-notice-days <n>', 'Min notice days')
    .option('--country <code>', 'Country code')
    .action(
      async (
        code: string,
        name: string,
        options: {
          organization?: string;
          description?: string;
          color?: string;
          paid?: boolean;
          requiresApproval?: boolean;
          requiresDocumentation?: boolean;
          maxConsecutiveDays?: string;
          minNoticeDays?: string;
          country?: string;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        const data: AbsenceTypeCreateRequest = { code, name };
        if (options.description) data.description = options.description;
        if (options.color) data.color = parseInt(options.color, 10);
        if (options.paid !== undefined) data.paid = options.paid;
        if (options.requiresApproval) data.requiresApproval = true;
        if (options.requiresDocumentation) data.requiresDocumentation = true;
        if (options.maxConsecutiveDays) data.maxConsecutiveDays = parseInt(options.maxConsecutiveDays, 10);
        if (options.minNoticeDays) data.minNoticeDays = parseInt(options.minNoticeDays, 10);
        if (options.country) data.countryCode = options.country;

        spinner.start('Creating absence type...');
        const type = await client.absenceTypes.create(organizationId, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, type);
          return;
        }
        output(formatter, formatter.formatSuccess('Absence type created!'));
        newline();
        output(formatter, formatter.formatKeyValue({ ID: type.id, Code: type.code, Name: type.name }));
      }
    );

  types
    .command('update')
    .description('Update an absence type')
    .argument('<id>', 'Absence type ID')
    .option('-o, --organization <id>', 'Organization ID')
    .option('--code <code>', 'New code')
    .option('-n, --name <name>', 'New name')
    .option('-d, --description <text>', 'Description')
    .option('-c, --color <number>', 'Color code')
    .option('--paid', 'Mark as paid')
    .option('--no-paid', 'Mark as unpaid')
    .option('--requires-approval', 'Require approval')
    .option('--no-requires-approval', 'Do not require approval')
    .option('--max-consecutive-days <n>', 'Max consecutive days')
    .option('--min-notice-days <n>', 'Min notice days')
    .action(
      async (
        id: string,
        options: {
          organization?: string;
          code?: string;
          name?: string;
          description?: string;
          color?: string;
          paid?: boolean;
          requiresApproval?: boolean;
          maxConsecutiveDays?: string;
          minNoticeDays?: string;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        const data: AbsenceTypeUpdateRequest = {};
        if (options.code) data.code = options.code;
        if (options.name) data.name = options.name;
        if (options.description !== undefined) data.description = options.description;
        if (options.color) data.color = parseInt(options.color, 10);
        if (options.paid !== undefined) data.paid = options.paid;
        if (options.requiresApproval !== undefined) data.requiresApproval = options.requiresApproval;
        if (options.maxConsecutiveDays) data.maxConsecutiveDays = parseInt(options.maxConsecutiveDays, 10);
        if (options.minNoticeDays) data.minNoticeDays = parseInt(options.minNoticeDays, 10);

        if (Object.keys(data).length === 0) {
          output(formatter, formatter.formatWarning('No updates specified.'));
          return;
        }

        spinner.start('Updating absence type...');
        const type = await client.absenceTypes.update(organizationId, id, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, type);
          return;
        }
        output(formatter, formatter.formatSuccess('Absence type updated.'));
        newline();
        output(formatter, formatter.formatKeyValue({ ID: type.id, Code: type.code, Name: type.name }));
      }
    );

  types
    .command('delete')
    .description('Delete an absence type')
    .argument('<id>', 'Absence type ID')
    .option('-o, --organization <id>', 'Organization ID')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(
      async (
        id: string,
        options: { organization?: string; force?: boolean },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        if (
          !options.force &&
          getConfig('confirmDeletes') &&
          process.stdout.isTTY &&
          !globalOptions.json
        ) {
          const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
            { type: 'confirm', name: 'confirm', message: `Delete absence type ${id}?`, default: false },
          ]);
          if (!confirm) {
            output(formatter, formatter.formatInfo('Deletion cancelled.'));
            return;
          }
        }

        spinner.start('Deleting absence type...');
        await client.absenceTypes.delete(organizationId, id);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, { deleted: true, id });
          return;
        }
        output(formatter, formatter.formatSuccess('Absence type deleted.'));
      }
    );
}
