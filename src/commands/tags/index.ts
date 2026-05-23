import { Command } from 'commander';
import inquirer from 'inquirer';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import { getConfig } from '../../config/index.js';
import type { GlobalOptions, ColumnDef } from '../../types/index.js';
import type { Tag, TagUpdateRequest } from '@timesheet/sdk';

export function registerTagsCommands(program: Command): void {
  const tags = program.command('tags').description('Tag management commands');

  // List tags
  tags
    .command('list')
    .description('List all tags')
    .action(async (_options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Loading tags...');

      const page = await client.tags.list();

      spinner.stop();

      if (globalOptions.json) {
        output(formatter, page.items);
        return;
      }

      if (page.items.length === 0) {
        output(formatter, formatter.formatInfo('No tags found.'));
        newline();
        output(
          formatter,
          formatter.formatHint(
            'Create a tag with: timesheet tags create "Tag Name"'
          )
        );
        return;
      }

      const columns: ColumnDef<Tag>[] = [
        { key: 'id', header: 'ID', width: 36 },
        { key: 'name', header: 'Name', width: 30 },
        {
          key: 'color',
          header: 'Color',
          width: 10,
          format: (v) => (v as number)?.toString() || '-',
        },
      ];

      output(formatter, formatter.formatTable(page.items, columns));
      newline();
      output(
        formatter,
        formatter.formatHint(`Showing ${page.items.length} tags.`)
      );
    });

  // Create tag
  tags
    .command('create')
    .description('Create a new tag')
    .argument('<name>', 'Tag name')
    .option('-c, --color <number>', 'Color code (0-15)')
    .action(
      async (
        name: string,
        options: { color?: string },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        spinner.start('Creating tag...');

        const tag = await client.tags.create({
          name,
          color: options.color ? parseInt(options.color, 10) : undefined,
        });

        spinner.stop();

        if (globalOptions.json) {
          output(formatter, tag);
          return;
        }

        if (formatter.mode === 'pipe') {
          output(formatter, `created\t${tag.id}\t${tag.name}`);
          return;
        }

        output(formatter, formatter.formatSuccess('Tag created!'));
        newline();

        output(
          formatter,
          formatter.formatKeyValue({
            ID: tag.id,
            Name: tag.name,
          })
        );
      }
    );

  // Show tag
  tags
    .command('show')
    .description('Show tag details')
    .argument('<id>', 'Tag ID')
    .action(async (id: string, _options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Loading tag...');
      const tag = await client.tags.get(id);
      spinner.stop();

      if (globalOptions.json) {
        output(formatter, tag);
        return;
      }

      const data: Record<string, string> = {
        ID: tag.id,
        Name: tag.name,
        Status: tag.archived ? 'Archived' : 'Active',
      };
      if (tag.color !== undefined) data['Color'] = String(tag.color);
      if (tag.team?.id) data['Team'] = tag.team.name || tag.team.id;
      if (tag.totalTime !== undefined) data['Total Time (s)'] = String(tag.totalTime);

      output(formatter, formatter.formatHeader('Tag'));
      newline();
      output(formatter, formatter.formatKeyValue(data));
    });

  // Update tag
  tags
    .command('update')
    .description('Update a tag')
    .argument('<id>', 'Tag ID')
    .option('-n, --name <name>', 'New name')
    .option('-c, --color <number>', 'Color code (0-15)')
    .option('--archive', 'Archive the tag')
    .option('--unarchive', 'Unarchive the tag')
    .action(
      async (
        id: string,
        options: { name?: string; color?: string; archive?: boolean; unarchive?: boolean },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: TagUpdateRequest = {};
        if (options.name) data.name = options.name;
        if (options.color) data.color = parseInt(options.color, 10);
        if (options.archive) data.archived = true;
        if (options.unarchive) data.archived = false;

        if (Object.keys(data).length === 0) {
          output(formatter, formatter.formatWarning('No updates specified.'));
          return;
        }

        spinner.start('Updating tag...');
        const tag = await client.tags.update(id, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, tag);
          return;
        }
        output(formatter, formatter.formatSuccess('Tag updated.'));
        newline();
        output(
          formatter,
          formatter.formatKeyValue({
            ID: tag.id,
            Name: tag.name,
            Status: tag.archived ? 'Archived' : 'Active',
          })
        );
      }
    );

  // Delete tag
  tags
    .command('delete')
    .description('Delete a tag')
    .argument('<id>', 'Tag ID')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(
      async (id: string, options: { force?: boolean }, command: Command) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        // Confirm deletion unless forced
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
              message: `Are you sure you want to delete tag ${id}?`,
              default: false,
            },
          ]);

          if (!confirm) {
            output(formatter, formatter.formatInfo('Deletion cancelled.'));
            return;
          }
        }

        spinner.start('Deleting tag...');

        await client.tags.delete(id);

        spinner.stop();

        if (globalOptions.json) {
          output(formatter, { deleted: true, id });
          return;
        }

        if (formatter.mode === 'pipe') {
          output(formatter, `deleted\t${id}`);
          return;
        }

        output(formatter, formatter.formatSuccess('Tag deleted.'));
      }
    );
}
