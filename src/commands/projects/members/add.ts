import type { Command } from 'commander';
import { getClient } from '../../../sdk/index.js';
import { createFormatter, output, newline } from '../../../output/index.js';
import { createSpinner } from '../../../utils/index.js';
import { CLIError, ExitCode } from '../../../utils/index.js';
import type { GlobalOptions } from '../../../types/index.js';
import type { ProjectMemberCreateRequest } from '@timesheet/sdk';

export function registerProjectMembersAddCommand(parent: Command): void {
  parent
    .command('add')
    .description('Add a member to a project')
    .argument('<project-id>', 'Project ID')
    .option('-e, --email <email>', 'Member email')
    .option('-u, --user <id>', 'User ID (existing team user)')
    .option('-r, --role <role>', 'Permission role (owner, manager, member)')
    .action(
      async (
        projectId: string,
        options: { email?: string; user?: string; role?: string },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        if (!options.email && !options.user) {
          throw new CLIError(
            'Either --email or --user must be specified.',
            ExitCode.USAGE_ERROR
          );
        }

        const data: ProjectMemberCreateRequest = {};
        if (options.email) data.email = options.email;
        if (options.user) data.userId = options.user;
        if (options.role) data.permission = { role: options.role };

        spinner.start('Adding project member...');
        const member = await client.projects.addMember(projectId, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, member);
          return;
        }
        if (formatter.mode === 'pipe') {
          output(formatter, `added\t${member.id}\t${member.email}`);
          return;
        }

        output(formatter, formatter.formatSuccess('Project member added!'));
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
