import type { Command } from 'commander';
import { format } from 'date-fns';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import type { GlobalOptions } from '../../types/index.js';
import { resolveOrganizationId } from './helpers.js';

export function registerAbsencesShowCommand(parent: Command): void {
  parent
    .command('show')
    .description('Show absence details')
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

        spinner.start('Loading absence...');
        const absence = await client.absences.get(organizationId, id);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, absence);
          return;
        }

        const data: Record<string, string> = {
          ID: absence.id,
          Type: absence.absenceType?.name || absence.absenceTypeId,
          Status: absence.status || '-',
          Start: format(new Date(absence.startDateTime), 'yyyy-MM-dd HH:mm'),
          End: format(new Date(absence.endDateTime), 'yyyy-MM-dd HH:mm'),
          'Full Day': absence.fullDay ? 'Yes' : 'No',
        };
        if (absence.totalDays) data['Total Days'] = absence.totalDays;
        if (absence.totalHours) data['Total Hours'] = absence.totalHours;
        if (absence.member?.displayName) data['Member'] = absence.member.displayName;
        if (absence.reason) data['Reason'] = absence.reason;
        if (absence.rejectionReason) data['Rejection Reason'] = absence.rejectionReason;
        if (absence.cancellationReason) data['Cancellation Reason'] = absence.cancellationReason;
        if (absence.documentationStatus) data['Documentation Status'] = absence.documentationStatus;
        if (absence.documentationDueDate) data['Documentation Due'] = absence.documentationDueDate;
        if (absence.fileName) data['Attachment'] = absence.fileName;

        output(formatter, formatter.formatHeader('Absence Details'));
        newline();
        output(formatter, formatter.formatKeyValue(data));
      }
    );
}
