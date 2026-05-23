import type { Command } from 'commander';
import { getClient } from '../../../sdk/index.js';
import { createFormatter, output, newline } from '../../../output/index.js';
import { createSpinner } from '../../../utils/index.js';
import type { GlobalOptions } from '../../../types/index.js';
import type { TeamMemberCreateRequest, TeamPermission } from '@timesheet/sdk';

function buildPermission(role?: string): TeamPermission | undefined {
  if (!role) return undefined;
  return { role };
}

export function registerTeamMembersAddCommand(parent: Command): void {
  parent
    .command('add')
    .description('Add (invite) a member to a team')
    .argument('<team-id>', 'Team ID')
    .requiredOption('-e, --email <email>', 'Member email')
    .option('-f, --firstname <name>', 'First name')
    .option('-l, --lastname <name>', 'Last name')
    .option('--employee-id <id>', 'Employee ID')
    .option(
      '-r, --role <role>',
      'Permission role (owner, manager, member)'
    )
    .action(
      async (
        teamId: string,
        options: {
          email: string;
          firstname?: string;
          lastname?: string;
          employeeId?: string;
          role?: string;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: TeamMemberCreateRequest = {
          email: options.email,
          firstname: options.firstname,
          lastname: options.lastname,
          employeeId: options.employeeId,
          permission: buildPermission(options.role),
        };

        spinner.start('Adding team member...');
        const member = await client.teams.addMember(teamId, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, member);
          return;
        }
        if (formatter.mode === 'pipe') {
          output(formatter, `added\t${member.id}\t${member.email}`);
          return;
        }

        output(formatter, formatter.formatSuccess('Team member added!'));
        newline();
        output(
          formatter,
          formatter.formatKeyValue({
            ID: member.id,
            Email: member.email,
            Role: member.permission?.role || '-',
            Status: member.invited ? 'invited' : 'active',
          })
        );
      }
    );
}
