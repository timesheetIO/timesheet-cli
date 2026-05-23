import type { Command } from 'commander';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import type { GlobalOptions } from '../../types/index.js';
import { resolveOrganizationId } from './helpers.js';

export function registerAbsencesWorkflowCommands(parent: Command): void {
  parent
    .command('approve')
    .description('Approve a pending absence')
    .argument('<id>', 'Absence ID')
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

        spinner.start('Approving absence...');
        const absence = await client.absences.approve(organizationId, id);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, absence);
          return;
        }
        output(formatter, formatter.formatSuccess(`Absence approved (status: ${absence.status || '-'}).`));
      }
    );

  parent
    .command('reject')
    .description('Reject a pending absence')
    .argument('<id>', 'Absence ID')
    .requiredOption('-r, --reason <text>', 'Rejection reason')
    .option('-o, --organization <id>', 'Organization ID')
    .action(
      async (
        id: string,
        options: { organization?: string; reason: string },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        spinner.start('Rejecting absence...');
        const absence = await client.absences.reject(organizationId, id, { reason: options.reason });
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, absence);
          return;
        }
        output(formatter, formatter.formatSuccess(`Absence rejected (status: ${absence.status || '-'}).`));
        newline();
        output(formatter, formatter.formatKeyValue({ Reason: options.reason }));
      }
    );

  parent
    .command('cancel')
    .description('Cancel an absence')
    .argument('<id>', 'Absence ID')
    .requiredOption('-r, --reason <text>', 'Cancellation reason')
    .option('-o, --organization <id>', 'Organization ID')
    .action(
      async (
        id: string,
        options: { organization?: string; reason: string },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        spinner.start('Cancelling absence...');
        const absence = await client.absences.cancel(organizationId, id, { reason: options.reason });
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, absence);
          return;
        }
        output(formatter, formatter.formatSuccess(`Absence cancelled (status: ${absence.status || '-'}).`));
      }
    );
}
