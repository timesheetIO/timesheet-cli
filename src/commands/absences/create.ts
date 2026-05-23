import type { Command } from 'commander';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import type { GlobalOptions } from '../../types/index.js';
import { resolveOrganizationId } from './helpers.js';

export function registerAbsencesCreateCommand(parent: Command): void {
  parent
    .command('create')
    .description('Create a new absence')
    .requiredOption('-c, --contract <id>', 'Contract ID')
    .requiredOption('-t, --type <id>', 'Absence type ID')
    .requiredOption('-s, --start <datetime>', 'Start (YYYY-MM-DD or ISO)')
    .requiredOption('-e, --end <datetime>', 'End (YYYY-MM-DD or ISO)')
    .option('-o, --organization <id>', 'Organization ID')
    .option('--full-day', 'Full-day absence')
    .option('-r, --reason <text>', 'Reason')
    .option('--documentation-url <url>', 'Documentation URL')
    .option('--file-name <name>', 'Attachment filename')
    .option('--file-uri <uri>', 'Attachment URI')
    .action(
      async (
        options: {
          organization?: string;
          contract: string;
          type: string;
          start: string;
          end: string;
          fullDay?: boolean;
          reason?: string;
          documentationUrl?: string;
          fileName?: string;
          fileUri?: string;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        spinner.start('Creating absence...');

        const absence = await client.absences.create(organizationId, {
          contractId: options.contract,
          absenceTypeId: options.type,
          startDateTime: options.start,
          endDateTime: options.end,
          fullDay: options.fullDay,
          reason: options.reason,
          documentationUrl: options.documentationUrl,
          fileName: options.fileName,
          fileUri: options.fileUri,
        });

        spinner.stop();

        if (globalOptions.json) {
          output(formatter, absence);
          return;
        }

        if (formatter.mode === 'pipe') {
          output(formatter, `created\t${absence.id}\t${absence.status || ''}`);
          return;
        }

        output(formatter, formatter.formatSuccess('Absence created!'));
        newline();
        output(
          formatter,
          formatter.formatKeyValue({
            ID: absence.id,
            Status: absence.status || '-',
            Start: absence.startDateTime,
            End: absence.endDateTime,
          })
        );
      }
    );
}
