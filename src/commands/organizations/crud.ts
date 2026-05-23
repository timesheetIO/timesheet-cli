import type { Command } from 'commander';
import inquirer from 'inquirer';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import { getConfig } from '../../config/index.js';
import type { GlobalOptions } from '../../types/index.js';
import type { OrganizationUpdateRequest } from '@timesheet/sdk';

export function registerOrganizationsCrudCommands(parent: Command): void {
  parent
    .command('show')
    .description('Show organization details')
    .argument('<id>', 'Organization ID')
    .action(async (id: string, _options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Loading organization...');
      const org = await client.organizations.get(id);
      spinner.stop();

      if (globalOptions.json) {
        output(formatter, org);
        return;
      }

      const data: Record<string, string> = {
        ID: org.id,
        Name: org.name,
      };
      if (org.description) data['Description'] = org.description;
      if (org.aiChatEnabled !== undefined) data['AI Chat'] = org.aiChatEnabled ? 'Yes' : 'No';
      if (org.permission?.admin) data['Admin'] = 'Yes';
      if (org.permission?.invoicing) data['Invoicing'] = 'Yes';
      if (org.permission?.billing) data['Billing'] = 'Yes';

      output(formatter, formatter.formatHeader('Organization'));
      newline();
      output(formatter, formatter.formatKeyValue(data));
    });

  parent
    .command('create')
    .description('Create a new organization')
    .argument('<name>', 'Organization name')
    .option('-d, --description <text>', 'Description')
    .option('-c, --color <number>', 'Color code')
    .option('--ai-chat', 'Enable AI chat')
    .action(
      async (
        name: string,
        options: { description?: string; color?: string; aiChat?: boolean },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        spinner.start('Creating organization...');
        const org = await client.organizations.create({
          name,
          description: options.description,
          color: options.color ? parseInt(options.color, 10) : undefined,
          aiChatEnabled: options.aiChat,
        });
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, org);
          return;
        }
        output(formatter, formatter.formatSuccess('Organization created!'));
        newline();
        output(formatter, formatter.formatKeyValue({ ID: org.id, Name: org.name }));
        newline();
        output(
          formatter,
          formatter.formatHint(
            `Set as default: timesheet config set defaultOrganizationId ${org.id}`
          )
        );
      }
    );

  parent
    .command('update')
    .description('Update an organization')
    .argument('<id>', 'Organization ID')
    .option('-n, --name <name>', 'New name')
    .option('-d, --description <text>', 'Description')
    .option('-c, --color <number>', 'Color code')
    .option('--ai-chat', 'Enable AI chat')
    .option('--no-ai-chat', 'Disable AI chat')
    .action(
      async (
        id: string,
        options: { name?: string; description?: string; color?: string; aiChat?: boolean },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: OrganizationUpdateRequest = {};
        if (options.name) data.name = options.name;
        if (options.description !== undefined) data.description = options.description;
        if (options.color) data.color = parseInt(options.color, 10);
        if (options.aiChat !== undefined) data.aiChatEnabled = options.aiChat;

        if (Object.keys(data).length === 0) {
          output(formatter, formatter.formatWarning('No updates specified.'));
          return;
        }

        spinner.start('Updating organization...');
        const org = await client.organizations.update(id, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, org);
          return;
        }
        output(formatter, formatter.formatSuccess('Organization updated.'));
        newline();
        output(formatter, formatter.formatKeyValue({ ID: org.id, Name: org.name }));
      }
    );

  parent
    .command('delete')
    .description('Delete an organization')
    .argument('<id>', 'Organization ID')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(
      async (
        id: string,
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
          const org = await client.organizations.get(id);
          const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Delete organization "${org.name}"? This cannot be undone.`,
              default: false,
            },
          ]);
          if (!confirm) {
            output(formatter, formatter.formatInfo('Deletion cancelled.'));
            return;
          }
        }

        spinner.start('Deleting organization...');
        await client.organizations.delete(id);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, { deleted: true, id });
          return;
        }
        output(formatter, formatter.formatSuccess('Organization deleted.'));
      }
    );
}
