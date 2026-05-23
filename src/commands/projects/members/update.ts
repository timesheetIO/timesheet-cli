import type { Command } from 'commander';
import { getClient } from '../../../sdk/index.js';
import { createFormatter, output, newline } from '../../../output/index.js';
import { createSpinner } from '../../../utils/index.js';
import type { GlobalOptions } from '../../../types/index.js';

export function registerProjectMembersUpdateCommand(parent: Command): void {
  parent
    .command('update')
    .description("Update a project member's role")
    .argument('<project-id>', 'Project ID')
    .argument('<member-id>', 'Project member ID')
    .requiredOption('-r, --role <role>', 'Permission role (owner, manager, member)')
    .action(
      async (
        projectId: string,
        memberId: string,
        options: { role: string },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        spinner.start('Updating project member...');
        const member = await client.projects.updateMember(projectId, memberId, {
          permission: { role: options.role },
        });
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, member);
          return;
        }

        output(formatter, formatter.formatSuccess('Project member updated.'));
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
