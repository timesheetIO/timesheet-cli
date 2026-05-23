import type { Command } from 'commander';
import inquirer from 'inquirer';
import { getClient } from '../../../sdk/index.js';
import { createFormatter, output } from '../../../output/index.js';
import { createSpinner } from '../../../utils/index.js';
import { getConfig } from '../../../config/index.js';
import type { GlobalOptions } from '../../../types/index.js';

export function registerTeamMembersRemoveCommand(parent: Command): void {
  parent
    .command('remove')
    .description('Remove a member from a team')
    .argument('<team-id>', 'Team ID')
    .argument('<member-id>', 'Team member ID')
    .option('--invited', 'Permanently delete an invited (not-yet-activated) member')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(
      async (
        teamId: string,
        memberId: string,
        options: { invited?: boolean; force?: boolean },
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
              message: options.invited
                ? `Permanently delete invited member ${memberId}?`
                : `Remove member ${memberId} from team?`,
              default: false,
            },
          ]);
          if (!confirm) {
            output(formatter, formatter.formatInfo('Cancelled.'));
            return;
          }
        }

        spinner.start(options.invited ? 'Deleting invited member...' : 'Removing team member...');
        if (options.invited) {
          await client.teams.removeInvitedMember(teamId, memberId);
        } else {
          await client.teams.removeMember(teamId, memberId);
        }
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, { removed: true, teamId, memberId });
          return;
        }
        output(formatter, formatter.formatSuccess('Team member removed.'));
      }
    );
}
