import type { Command } from 'commander';
import inquirer from 'inquirer';
import { getClient } from '../../../sdk/index.js';
import { createFormatter, output } from '../../../output/index.js';
import { createSpinner } from '../../../utils/index.js';
import { getConfig } from '../../../config/index.js';
import type { GlobalOptions } from '../../../types/index.js';

export function registerProjectMembersRemoveCommand(parent: Command): void {
  parent
    .command('remove')
    .description('Remove a member from a project')
    .argument('<project-id>', 'Project ID')
    .argument('<member-id>', 'Project member ID')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(
      async (
        projectId: string,
        memberId: string,
        options: { force?: boolean },
        command: Command
      ) => {
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
            {
              type: 'confirm',
              name: 'confirm',
              message: `Remove member ${memberId} from project?`,
              default: false,
            },
          ]);
          if (!confirm) {
            output(formatter, formatter.formatInfo('Cancelled.'));
            return;
          }
        }

        spinner.start('Removing project member...');
        await client.projects.removeMember(projectId, memberId);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, { removed: true, projectId, memberId });
          return;
        }
        output(formatter, formatter.formatSuccess('Project member removed.'));
      }
    );
}
