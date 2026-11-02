import type { Command } from 'commander';
import inquirer from 'inquirer';
import type {
  ExportedField,
  ExportFormat,
  ExportParams,
  ExportTemplate,
  ExportTemplateCreateRequest,
  ExportTemplateUpdateRequest,
} from '@timesheet/sdk';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import { getConfig } from '../../config/index.js';
import type { ColumnDef, GlobalOptions } from '../../types/index.js';
import {
  type DeliveryOptions,
  type ExportSettingsOptions,
  type PeriodOptions,
  type WithTitle,
  addDeliveryOptions,
  addPeriodOptions,
  addSettingsOptions,
  checkDelivery,
  deliverExport,
  idList,
  organizationFor,
  resolvePeriod,
  resolveReport,
  settingsFromOptions,
} from './export.js';

type Template = WithTitle<ExportTemplate>;

/** A template with its ID lists as arrays, however the API returned them. */
function normalize(template: Template): Template {
  return {
    ...template,
    teamIds: idList(template.teamIds),
    projectIds: idList(template.projectIds),
    userIds: idList(template.userIds),
    tagIds: idList(template.tagIds),
    exportedFields: idList<ExportedField>(template.exportedFields),
  };
}

function templateDetails(template: Template): Record<string, unknown> {
  const details: Record<string, unknown> = {
    ID: template.id,
    Name: template.name,
    Report: template.report ?? 0,
    Format: template.format || 'xlsx',
  };
  const optional: Record<string, unknown> = {
    Type: template.type,
    Filter: template.filter,
    Projects: template.projectIds,
    Teams: template.teamIds,
    Members: template.userIds,
    Tags: template.tagIds,
    'Split tasks': template.splitTask || undefined,
    Summarize: template.summarize || undefined,
    Email: template.email,
    Filename: template.filename,
    'PDF title': template.title,
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)) {
      details[key] = value;
    }
  }
  return details;
}

export function registerReportsTemplatesCommands(reports: Command): void {
  const templates = reports
    .command('templates')
    .description('Saved export settings, to run for any period');

  templates
    .command('list')
    .description('List export templates')
    .option('-q, --search <query>', 'Free-text search')
    .option('-l, --limit <number>', 'Limit results', '20')
    .action(async (options: { search?: string; limit: string }, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Loading export templates...');
      const limit = parseInt(options.limit, 10) || getConfig('paginationLimit');
      const page = await client.reports.export.searchTemplates({ search: options.search, limit });
      spinner.stop();

      const items = page.items.map(normalize);
      if (globalOptions.json) {
        output(formatter, items);
        return;
      }

      if (items.length === 0) {
        output(formatter, formatter.formatInfo('No export templates found.'));
        newline();
        output(
          formatter,
          formatter.formatHint('Create one with: timesheet reports templates create "Monthly hours" -f pdf')
        );
        return;
      }

      const columns: ColumnDef<Template>[] = [
        { key: 'id', header: 'ID', width: 36 },
        { key: 'name', header: 'Name', width: 30 },
        { key: 'report', header: 'Report', width: 8, format: (v) => String(v ?? 0) },
        { key: 'format', header: 'Format', width: 10, format: (v) => (v as string) || 'xlsx' },
      ];
      output(formatter, formatter.formatTable(items, columns));
      newline();
      output(formatter, formatter.formatHint(`Showing ${items.length} templates.`));
    });

  templates
    .command('show')
    .alias('get')
    .description('Show an export template')
    .argument('<id>', 'Template ID')
    .action(async (id: string, _options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Loading export template...');
      const template = normalize(await client.reports.export.getTemplate(id));
      spinner.stop();

      if (globalOptions.json) {
        output(formatter, template);
        return;
      }
      output(formatter, formatter.formatHeader('Export template'));
      newline();
      output(formatter, formatter.formatKeyValue(templateDetails(template)));
    });

  const create = templates
    .command('create')
    .description('Save export settings as a template')
    .argument('<name>', 'Template name');
  addSettingsOptions(create);
  create
    .option('--email <address>', 'Email address saved with the template')
    .action(
      async (name: string, options: ExportSettingsOptions & { email?: string }, command: Command) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: WithTitle<ExportTemplateCreateRequest> = {
          name,
          report: await resolveReport(client, options.report),
          ...settingsFromOptions(options),
          email: options.email,
        };

        spinner.start('Creating export template...');
        const template = await client.reports.export.createTemplate(data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, template);
          return;
        }
        if (formatter.mode === 'pipe') {
          output(formatter, `created\t${template.id}\t${template.name}`);
          return;
        }
        output(formatter, formatter.formatSuccess('Export template created!'));
        newline();
        output(formatter, formatter.formatKeyValue(templateDetails(normalize(template))));
      }
    );

  const update = templates
    .command('update')
    .description('Change an export template; options you leave out stay as they are')
    .argument('<id>', 'Template ID')
    .option('-n, --name <name>', 'New name');
  addSettingsOptions(update, false);
  update
    .option('--no-split-tasks', 'One row per task again')
    .option('--no-summarize', 'Leave out the totals row')
    .option('--email <address>', 'Email address saved with the template')
    .addHelpText(
      'after',
      '\nAn empty value clears a setting, such as --title "" (the PDF shows the report name again) or --project "".'
    )
    .action(
      async (
        id: string,
        options: ExportSettingsOptions & { name?: string; email?: string },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        // Only what was given goes into the request: the API keeps every field left out
        const data = Object.fromEntries(
          Object.entries({
            name: options.name,
            report: await resolveReport(client, options.report),
            ...settingsFromOptions(options),
            email: options.email,
          }).filter(([, value]) => value !== undefined)
        ) as WithTitle<ExportTemplateUpdateRequest>;

        if (Object.keys(data).length === 0) {
          output(formatter, formatter.formatWarning('No updates specified.'));
          return;
        }

        spinner.start('Updating export template...');
        const template = await client.reports.export.updateTemplate(id, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, template);
          return;
        }
        output(formatter, formatter.formatSuccess('Export template updated.'));
        newline();
        output(formatter, formatter.formatKeyValue(templateDetails(normalize(template))));
      }
    );

  templates
    .command('delete')
    .description('Delete an export template')
    .argument('<id>', 'Template ID')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (id: string, options: { force?: boolean }, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      if (!options.force && getConfig('confirmDeletes') && process.stdout.isTTY && !globalOptions.json) {
        const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete export template ${id}?`,
            default: false,
          },
        ]);
        if (!confirm) {
          output(formatter, formatter.formatInfo('Deletion cancelled.'));
          return;
        }
      }

      spinner.start('Deleting export template...');
      await client.reports.export.deleteTemplate(id);
      spinner.stop();

      if (globalOptions.json) {
        output(formatter, { deleted: true, id });
        return;
      }
      if (formatter.mode === 'pipe') {
        output(formatter, `deleted\t${id}`);
        return;
      }
      output(formatter, formatter.formatSuccess('Export template deleted.'));
    });

  const run = templates
    .command('run')
    .description("Export a period with a template's settings")
    .argument('<id>', 'Template ID');
  addPeriodOptions(run);
  addDeliveryOptions(run);
  run.action(async (id: string, options: PeriodOptions & DeliveryOptions, command: Command) => {
    const globalOptions = command.optsWithGlobals<GlobalOptions>();
    const period = resolvePeriod(options);
    checkDelivery(options);

    const formatter = createFormatter(globalOptions);
    const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
    const client = await getClient(globalOptions);

    spinner.start('Loading export template...');
    const template = normalize(await client.reports.export.getTemplate(id));
    spinner.stop();

    // The from-template endpoint returns the file itself; the regular export returns a link,
    // which --url-only and --json can print
    const params: WithTitle<ExportParams> = {
      report: template.report ?? 0,
      format: (template.format || 'xlsx') as ExportFormat,
      teamIds: template.teamIds,
      projectIds: template.projectIds,
      userIds: template.userIds,
      tagIds: template.tagIds,
      type: template.type,
      filter: template.filter,
      splitTask: template.splitTask,
      summarize: template.summarize,
      filename: template.filename,
      title: template.title,
      exportedFields: template.exportedFields,
      ...period,
      organizationId: organizationFor(options),
    };

    await deliverExport({ client, formatter, spinner, json: !!globalOptions.json }, params, options);
  });
}
