import type { Command } from 'commander';
import inquirer from 'inquirer';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import { getConfig } from '../../config/index.js';
import type { GlobalOptions } from '../../types/index.js';
import { resolveOrganizationId } from './helpers.js';

export function registerAbsencesDeleteCommand(parent: Command): void {
  parent
    .command('delete')
    .description('Delete an absence')
    .argument('<id>', 'Absence ID')
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
            {
              type: 'confirm',
              name: 'confirm',
              message: `Delete absence ${id}?`,
              default: false,
            },
          ]);
          if (!confirm) {
            output(formatter, formatter.formatInfo('Deletion cancelled.'));
            return;
          }
        }

        spinner.start('Deleting absence...');
        await client.absences.delete(organizationId, id);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, { deleted: true, id });
          return;
        }

        output(formatter, formatter.formatSuccess('Absence deleted.'));
      }
    );
}
