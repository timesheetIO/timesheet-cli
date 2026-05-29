import { Command } from 'commander';
import inquirer from 'inquirer';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import { getConfig } from '../../config/index.js';
import { resolveOrganizationId } from '../_shared/organization.js';
import type { GlobalOptions, ColumnDef } from '../../types/index.js';
import type {
  Contract,
  ContractCreateRequest,
  ContractListParams,
  ContractUpdateRequest,
} from '@timesheet/sdk';

interface CreateOptions {
  organization?: string;
  user: string;
  validFrom?: string;
  validTo?: string;
  workDays?: string;
  weeklyHours?: string;
  dailyHours?: string;
  salaryType?: string;
  salaryAmount?: string;
  salaryCurrency?: string;
  vacationDays?: string;
  country?: string;
  timezone?: string;
}

interface UpdateOptions {
  organization?: string;
  name?: string;
  validFrom?: string;
  validTo?: string;
  workDays?: string;
  weeklyHours?: string;
  dailyHours?: string;
  salaryType?: string;
  salaryAmount?: string;
  salaryCurrency?: string;
  vacationDays?: string;
  country?: string;
  timezone?: string;
}

function formatContractKeyValue(contract: Contract): Record<string, string> {
  const data: Record<string, string> = {
    ID: contract.id,
    Name: contract.name,
    Status: contract.status || '-',
  };
  if (contract.member?.displayName) data['Member'] = contract.member.displayName;
  if (contract.validFrom) data['Valid From'] = contract.validFrom;
  if (contract.validTo) data['Valid To'] = contract.validTo;
  if (contract.weeklyHours !== undefined) data['Weekly Hours'] = String(contract.weeklyHours);
  if (contract.dailyHours !== undefined) data['Daily Hours'] = String(contract.dailyHours);
  if (contract.vacationDaysAnnual !== undefined) data['Vacation Days/Year'] = String(contract.vacationDaysAnnual);
  if (contract.salaryType) data['Salary Type'] = contract.salaryType;
  if (contract.salaryAmount !== undefined) {
    data['Salary'] = `${contract.salaryAmount} ${contract.salaryCurrency || ''}`.trim();
  }
  if (contract.employmentModelName) data['Employment Model'] = contract.employmentModelName;
  if (contract.holidayCollectionName) data['Holiday Collection'] = contract.holidayCollectionName;
  if (contract.countryCode) data['Country'] = contract.countryCode;
  if (contract.timezone) data['Timezone'] = contract.timezone;
  return data;
}

export function registerContractsCommands(program: Command): void {
  const contracts = program
    .command('contracts')
    .description('Contract management commands');

  contracts
    .command('list')
    .description('List contracts in an organization')
    .option('-o, --organization <id>', 'Organization ID')
    .option('-u, --user <id>', 'Filter by user ID')
    .option('-s, --status <status>', 'Filter by status')
    .option('-q, --search <query>', 'Free-text search')
    .option('-l, --limit <number>', 'Limit results', '20')
    .action(
      async (
        options: {
          organization?: string;
          user?: string;
          status?: string;
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

        const limit = parseInt(options.limit, 10) || getConfig('paginationLimit');
        const params: ContractListParams = { limit };
        if (options.user) params.user = options.user;
        if (options.status) params.status = options.status;
        if (options.search) params.search = options.search;

        spinner.start('Loading contracts...');
        const page = await client.contracts.list(organizationId, params);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, page.items);
          return;
        }

        if (page.items.length === 0) {
          output(formatter, formatter.formatInfo('No contracts found.'));
          return;
        }

        const columns: ColumnDef<Contract>[] = [
          { key: 'id', header: 'ID', width: 36 },
          { key: 'name', header: 'Name', width: 24 },
          {
            key: 'member',
            header: 'Member',
            width: 24,
            format: (v) =>
              (v as { displayName?: string; email?: string } | undefined)?.displayName ||
              (v as { email?: string } | undefined)?.email ||
              '-',
          },
          {
            key: 'status',
            header: 'Status',
            width: 12,
            format: (v) => (v as string) || '-',
          },
          {
            key: 'validFrom',
            header: 'From',
            width: 12,
            format: (v) => (v as string) || '-',
          },
          {
            key: 'validTo',
            header: 'To',
            width: 12,
            format: (v) => (v as string) || '-',
          },
        ];

        output(formatter, formatter.formatTable(page.items, columns));
        newline();
        output(formatter, formatter.formatHint(`Showing ${page.items.length} contracts.`));
      }
    );

  contracts
    .command('show')
    .description('Show contract details')
    .argument('<id>', 'Contract ID')
    .option('-o, --organization <id>', 'Organization ID')
    .action(
      async (
        id: string,
        options: { organization?: string },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        spinner.start('Loading contract...');
        const contract = await client.contracts.get(organizationId, id);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, contract);
          return;
        }

        output(formatter, formatter.formatHeader('Contract Details'));
        newline();
        output(formatter, formatter.formatKeyValue(formatContractKeyValue(contract)));
      }
    );

  contracts
    .command('create')
    .description('Create a new contract')
    .argument('<name>', 'Contract name')
    .requiredOption('-u, --user <id>', 'User ID')
    .option('-o, --organization <id>', 'Organization ID')
    .option('--valid-from <date>', 'Valid from (YYYY-MM-DD)')
    .option('--valid-to <date>', 'Valid to (YYYY-MM-DD)')
    .option('--work-days <pattern>', 'Work days (e.g. MTWTF--)')
    .option('--weekly-hours <hours>', 'Weekly hours')
    .option('--daily-hours <hours>', 'Daily hours')
    .option('--salary-type <type>', 'Salary type')
    .option('--salary-amount <amount>', 'Salary amount')
    .option('--salary-currency <currency>', 'Salary currency')
    .option('--vacation-days <days>', 'Annual vacation days')
    .option('--country <code>', 'Country code')
    .option('--timezone <tz>', 'Timezone')
    .action(
      async (name: string, options: CreateOptions, command: Command) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        const data: ContractCreateRequest = {
          name,
          userId: options.user,
        };
        if (options.validFrom) data.validFrom = options.validFrom;
        if (options.validTo) data.validTo = options.validTo;
        if (options.workDays) data.workDays = options.workDays;
        if (options.weeklyHours) data.weeklyHours = parseFloat(options.weeklyHours);
        if (options.dailyHours) data.dailyHours = parseFloat(options.dailyHours);
        if (options.salaryType) data.salaryType = options.salaryType;
        if (options.salaryAmount) data.salaryAmount = parseFloat(options.salaryAmount);
        if (options.salaryCurrency) data.salaryCurrency = options.salaryCurrency;
        if (options.vacationDays) data.vacationDaysAnnual = parseInt(options.vacationDays, 10);
        if (options.country) data.countryCode = options.country;
        if (options.timezone) data.timezone = options.timezone;

        spinner.start('Creating contract...');
        const contract = await client.contracts.create(organizationId, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, contract);
          return;
        }
        output(formatter, formatter.formatSuccess('Contract created!'));
        newline();
        output(formatter, formatter.formatKeyValue(formatContractKeyValue(contract)));
      }
    );

  contracts
    .command('update')
    .description('Update a contract')
    .argument('<id>', 'Contract ID')
    .option('-o, --organization <id>', 'Organization ID')
    .option('-n, --name <name>', 'New name')
    .option('--valid-from <date>', 'Valid from (YYYY-MM-DD)')
    .option('--valid-to <date>', 'Valid to (YYYY-MM-DD)')
    .option('--work-days <pattern>', 'Work days')
    .option('--weekly-hours <hours>', 'Weekly hours')
    .option('--daily-hours <hours>', 'Daily hours')
    .option('--salary-type <type>', 'Salary type')
    .option('--salary-amount <amount>', 'Salary amount')
    .option('--salary-currency <currency>', 'Salary currency')
    .option('--vacation-days <days>', 'Annual vacation days')
    .option('--country <code>', 'Country code')
    .option('--timezone <tz>', 'Timezone')
    .action(
      async (id: string, options: UpdateOptions, command: Command) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        const data: ContractUpdateRequest = {};
        if (options.name) data.name = options.name;
        if (options.validFrom) data.validFrom = options.validFrom;
        if (options.validTo) data.validTo = options.validTo;
        if (options.workDays) data.workDays = options.workDays;
        if (options.weeklyHours) data.weeklyHours = parseFloat(options.weeklyHours);
        if (options.dailyHours) data.dailyHours = parseFloat(options.dailyHours);
        if (options.salaryType) data.salaryType = options.salaryType;
        if (options.salaryAmount) data.salaryAmount = parseFloat(options.salaryAmount);
        if (options.salaryCurrency) data.salaryCurrency = options.salaryCurrency;
        if (options.vacationDays) data.vacationDaysAnnual = parseInt(options.vacationDays, 10);
        if (options.country) data.countryCode = options.country;
        if (options.timezone) data.timezone = options.timezone;

        if (Object.keys(data).length === 0) {
          output(formatter, formatter.formatWarning('No updates specified.'));
          return;
        }

        spinner.start('Updating contract...');
        const contract = await client.contracts.update(organizationId, id, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, contract);
          return;
        }
        output(formatter, formatter.formatSuccess('Contract updated.'));
        newline();
        output(formatter, formatter.formatKeyValue(formatContractKeyValue(contract)));
      }
    );

  contracts
    .command('delete')
    .description('Delete a contract')
    .argument('<id>', 'Contract ID')
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
            { type: 'confirm', name: 'confirm', message: `Delete contract ${id}?`, default: false },
          ]);
          if (!confirm) {
            output(formatter, formatter.formatInfo('Deletion cancelled.'));
            return;
          }
        }

        spinner.start('Deleting contract...');
        await client.contracts.delete(organizationId, id);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, { deleted: true, id });
          return;
        }
        output(formatter, formatter.formatSuccess('Contract deleted.'));
      }
    );

  type WorkflowAction = 'activate' | 'suspend' | 'reactivate' | 'terminate';
  const workflows: { action: WorkflowAction; description: string }[] = [
    { action: 'activate', description: 'Activate a contract' },
    { action: 'suspend', description: 'Suspend a contract' },
    { action: 'reactivate', description: 'Reactivate a suspended contract' },
    { action: 'terminate', description: 'Terminate a contract' },
  ];

  for (const { action, description } of workflows) {
    contracts
      .command(action)
      .description(description)
      .argument('<id>', 'Contract ID')
      .option('-o, --organization <id>', 'Organization ID')
      .action(
        async (
          id: string,
          options: { organization?: string },
          command: Command
        ) => {
          const globalOptions = command.optsWithGlobals<GlobalOptions>();
          const formatter = createFormatter(globalOptions);
          const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
          const client = await getClient(globalOptions);
          const organizationId = resolveOrganizationId(options.organization);

          spinner.start(`${action.charAt(0).toUpperCase()}${action.slice(1)}ing contract...`);
          const contract = await client.contracts[action](organizationId, id);
          spinner.stop();

          if (globalOptions.json) {
            output(formatter, contract);
            return;
          }
          output(
            formatter,
            formatter.formatSuccess(`Contract ${action}d (status: ${contract.status || '-'}).`)
          );
        }
      );
  }
}
