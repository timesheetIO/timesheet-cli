import type { Command } from 'commander';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import type { GlobalOptions } from '../../types/index.js';
import type { AbsenceUpdateRequest } from '@timesheet/sdk';
import { resolveOrganizationId } from './helpers.js';

export function registerAbsencesUpdateCommand(parent: Command): void {
  parent
    .command('update')
    .description('Update an absence')
    .argument('<id>', 'Absence ID')
    .option('-o, --organization <id>', 'Organization ID')
    .option('-s, --start <datetime>', 'Start (YYYY-MM-DD or ISO)')
    .option('-e, --end <datetime>', 'End (YYYY-MM-DD or ISO)')
    .option('--full-day', 'Mark as full-day')
    .option('--no-full-day', 'Mark as partial-day')
    .option('-r, --reason <text>', 'Reason')
    .option('--documentation-url <url>', 'Documentation URL')
    .option('--file-name <name>', 'Attachment filename')
    .option('--file-uri <uri>', 'Attachment URI')
    .action(
      async (
        id: string,
        options: {
          organization?: string;
          start?: string;
          end?: string;
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

        const data: AbsenceUpdateRequest = {};
        if (options.start) data.startDateTime = options.start;
        if (options.end) data.endDateTime = options.end;
        if (options.fullDay !== undefined) data.fullDay = options.fullDay;
        if (options.reason !== undefined) data.reason = options.reason;
        if (options.documentationUrl !== undefined) data.documentationUrl = options.documentationUrl;
        if (options.fileName !== undefined) data.fileName = options.fileName;
        if (options.fileUri !== undefined) data.fileUri = options.fileUri;

        if (Object.keys(data).length === 0) {
          output(formatter, formatter.formatWarning('No updates specified.'));
          return;
        }

        spinner.start('Updating absence...');
        const absence = await client.absences.update(organizationId, id, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, absence);
          return;
        }

        output(formatter, formatter.formatSuccess('Absence updated.'));
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
