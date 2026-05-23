import type { Command } from 'commander';
import { getClient } from '../../../sdk/index.js';
import { createFormatter, output, newline } from '../../../output/index.js';
import { createSpinner } from '../../../utils/index.js';
import type { GlobalOptions } from '../../../types/index.js';
import type { TeamMemberUpdateRequest } from '@timesheet/sdk';

export function registerTeamMembersUpdateCommand(parent: Command): void {
  parent
    .command('update')
    .description("Update a team member's profile or permissions")
    .argument('<team-id>', 'Team ID')
    .argument('<member-id>', 'Team member ID')
    .option('-f, --firstname <name>', 'First name')
    .option('-l, --lastname <name>', 'Last name')
    .option('--employee-id <id>', 'Employee ID')
    .option('-r, --role <role>', 'Permission role (owner, manager, member)')
    .option('--activate', 'Activate a deactivated member')
    .option('--auto-join-projects', 'Enable auto-join to projects')
    .option('--no-auto-join-projects', 'Disable auto-join to projects')
    .action(
      async (
        teamId: string,
        memberId: string,
        options: {
          firstname?: string;
          lastname?: string;
          employeeId?: string;
          role?: string;
          activate?: boolean;
          autoJoinProjects?: boolean;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: TeamMemberUpdateRequest = {};
        if (options.firstname !== undefined) data.firstname = options.firstname;
        if (options.lastname !== undefined) data.lastname = options.lastname;
        if (options.employeeId !== undefined) data.employeeId = options.employeeId;
        if (options.role) data.permission = { role: options.role };
        if (options.activate) data.activate = true;
        if (options.autoJoinProjects !== undefined) data.autoJoinProjects = options.autoJoinProjects;

        if (Object.keys(data).length === 0) {
          output(formatter, formatter.formatWarning('No updates specified.'));
          return;
        }

        spinner.start('Updating team member...');
        const member = await client.teams.updateMember(teamId, memberId, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, member);
          return;
        }

        output(formatter, formatter.formatSuccess('Team member updated.'));
        newline();
        output(
          formatter,
          formatter.formatKeyValue({
            ID: member.id,
            Email: member.email,
            Role: member.permission?.role || '-',
          })
        );
      }
    );
}
