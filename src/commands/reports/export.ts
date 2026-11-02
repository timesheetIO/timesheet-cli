import { type Command, Option } from 'commander';
import { existsSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { endOfMonth, format, isValid, parseISO, startOfMonth, subDays } from 'date-fns';
import type { ExportFormat, ExportParams, TimesheetClient } from '@timesheet/sdk';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline, type OutputFormatter } from '../../output/index.js';
import { CLIError, ExitCode, createSpinner, type Spinner } from '../../utils/index.js';
import { getConfig } from '../../config/index.js';
import type { ColumnDef, GlobalOptions } from '../../types/index.js';

/**
 * Adds `title`, the heading of a PDF export, which @timesheet/sdk 1.3 does not type yet. The SDK
 * sends the object to the API as given, so the field still reaches it.
 */
export type WithTitle<T> = T & { title?: string };

const FORMATS = ['xlsx', 'xlsx1904', 'csv', 'pdf'];
const TYPES = ['all', 'task', 'mileage', 'call'];
const FILTERS = ['all', 'billable', 'notBillable', 'paid', 'unpaid', 'billed', 'outstanding'];

/** The task data report, which exports one row per time entry. */
const DATA_REPORT = 0;

/** Options shared by `reports export` and the export templates. */
export interface ExportSettingsOptions {
  report?: string;
  format?: ExportFormat;
  project?: string[];
  team?: string[];
  user?: string[];
  tag?: string[];
  type?: string;
  filter?: string;
  splitTasks?: boolean;
  summarize?: boolean;
  filename?: string;
  title?: string;
}

export interface PeriodOptions {
  startDate?: string;
  endDate?: string;
  thisMonth?: boolean;
  lastMonth?: boolean;
}

export interface DeliveryOptions {
  output?: string;
  urlOnly?: boolean;
  email?: string;
  organization?: string;
}

/**
 * Collects IDs given comma-separated, repeated, or both. An empty value gives an empty list,
 * which clears that filter of a template.
 */
function collectIds(value: string, previous: string[] = []): string[] {
  return [
    ...previous,
    ...value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  ];
}

/** The export settings; `withDefaults` names what applies when an option is left out. */
export function addSettingsOptions(command: Command, withDefaults = true): Command {
  const fallback = (text: string): string => (withDefaults ? ` (default: ${text})` : '');
  return command
    .option(
      '-r, --report <report>',
      `Report type: an ID or name from "timesheet reports types"${fallback('0, the data report')}`
    )
    .addOption(new Option('-f, --format <format>', `File format${fallback('xlsx')}`).choices(FORMATS))
    .option('-p, --project <ids>', 'Only these projects (comma-separated IDs)', collectIds)
    .option('-t, --team <ids>', 'Only these teams (comma-separated IDs)', collectIds)
    .option('-u, --user <ids>', 'Only these members (comma-separated user IDs)', collectIds)
    .option('--tag <ids>', 'Only entries with these tags (comma-separated IDs)', collectIds)
    .addOption(new Option('--type <type>', `Entry type${fallback('all')}`).choices(TYPES))
    .addOption(new Option('--filter <status>', `Billing status${fallback('all')}`).choices(FILTERS))
    .option('--split-tasks', 'Split tasks at their breaks, one row per work segment')
    .option('--summarize', 'Add a row with the totals')
    .option('--filename <name>', `File name, without extension${fallback('timesheet')}`)
    .option('--title <title>', `Heading at the top of a PDF export${fallback('the report name')}`);
}

export function addPeriodOptions(command: Command): Command {
  return command
    .option('-s, --start-date <date>', 'Start date (YYYY-MM-DD, default: start of this month)')
    .option('-e, --end-date <date>', 'End date (YYYY-MM-DD, default: today)')
    .option('--this-month', 'This month up to today')
    .option('--last-month', 'Last month');
}

export function addDeliveryOptions(command: Command): Command {
  return command
    .option(
      '-o, --output <path>',
      'Save the file here: a file, or a directory, created when it ends in / (default: <filename>_<start>_<end>.<format> in the current directory)'
    )
    .option('--url-only', 'Print the download link instead of saving the file')
    .option('--email <address>', 'Email the export to this address instead of saving it')
    .option(
      '--organization <id>',
      'Organization of the HR reports (absences, overtime, leave balance; default: defaultOrganizationId)'
    );
}

const ymd = (date: Date): string => format(date, 'yyyy-MM-dd');

/** The export's period as YYYY-MM-DD dates; without options, this month up to today. */
export function resolvePeriod(
  options: PeriodOptions,
  today = new Date()
): { startDate: string; endDate: string } {
  const named = [options.thisMonth, options.lastMonth].filter(Boolean).length;
  if (named > 1 || (named === 1 && (options.startDate || options.endDate))) {
    throw new CLIError(
      'Use one period: --this-month, --last-month, or --start-date and --end-date.',
      ExitCode.USAGE_ERROR
    );
  }

  if (options.lastMonth) {
    const lastMonth = subDays(startOfMonth(today), 1);
    return { startDate: ymd(startOfMonth(lastMonth)), endDate: ymd(endOfMonth(lastMonth)) };
  }

  const startDate = options.startDate ?? ymd(startOfMonth(today));
  const endDate = options.endDate ?? ymd(today);
  for (const date of [startDate, endDate]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isValid(parseISO(date))) {
      throw new CLIError(`Invalid date "${date}". Use YYYY-MM-DD.`, ExitCode.USAGE_ERROR);
    }
  }
  if (startDate > endDate) {
    throw new CLIError('The start date is after the end date.', ExitCode.USAGE_ERROR);
  }
  return { startDate, endDate };
}

/** A report ID, or the ID of the report type with that name (the names follow the account's language). */
export async function resolveReport(
  client: TimesheetClient,
  value: string | undefined
): Promise<number | undefined> {
  if (value === undefined) {
    return undefined;
  }
  if (/^\d+$/.test(value.trim())) {
    return Number(value);
  }
  const { items } = await client.reports.export.getReportTypes();
  const match = items.find((type) => type.name?.toLowerCase() === value.trim().toLowerCase());
  if (!match) {
    throw new CLIError(
      `Unknown report "${value}". Use one of: ${items.map((type) => `${type.id} (${type.name})`).join(', ')}.`,
      ExitCode.USAGE_ERROR
    );
  }
  return match.id;
}

/** Export templates may return their ID lists as JSON strings; accept both forms. */
export function idList<T = string>(value: unknown): T[] | undefined {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value === 'string' && value.length > 0) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** The settings options as they go into export params or a template. Unset options stay undefined. */
export function settingsFromOptions(options: ExportSettingsOptions) {
  return {
    format: options.format,
    projectIds: options.project,
    teamIds: options.team,
    userIds: options.user,
    tagIds: options.tag,
    type: options.type,
    filter: options.filter,
    splitTask: options.splitTasks,
    summarize: options.summarize,
    filename: options.filename,
    title: options.title,
  };
}

/** Refuses delivery options that exclude each other, before anything is requested. */
export function checkDelivery(delivery: DeliveryOptions): void {
  if (delivery.email && (delivery.output || delivery.urlOnly)) {
    throw new CLIError(
      '--email sends the export instead of saving it: leave out --output and --url-only.',
      ExitCode.USAGE_ERROR
    );
  }
  if (delivery.urlOnly && delivery.output) {
    throw new CLIError('--url-only saves no file: leave out --output.', ExitCode.USAGE_ERROR);
  }
}

/** The organization for HR reports: --organization, else the configured default. */
export function organizationFor(delivery: DeliveryOptions): string | undefined {
  return delivery.organization || getConfig('defaultOrganizationId') || undefined;
}

/** The default file name: <filename>_<start>_<end>.<extension>, safe for any file system. */
export function defaultFileName(params: ExportParams): string {
  const base = (params.filename || 'timesheet').replace(/[^\p{L}\p{N}._-]+/gu, '_');
  const extension = !params.format || params.format === 'xlsx1904' ? 'xlsx' : params.format;
  return `${base}_${params.startDate}_${params.endDate}.${extension}`;
}

/** Where to save the file: -o as a file, or as a directory when it is one or ends in a slash. */
async function outputPath(option: string | undefined, fileName: string): Promise<string> {
  if (!option) {
    return resolve(fileName);
  }
  if (/[\\/]$/.test(option) || (existsSync(option) && statSync(option).isDirectory())) {
    await mkdir(option, { recursive: true });
    return resolve(option, fileName);
  }
  return resolve(option);
}

const MAX_REDIRECTS = 5;

/** Saves the export behind a download link to a file. Follows https links only, also on redirects. */
export async function downloadFile(url: string, path: string): Promise<void> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { protocol } = new URL(current);
    if (protocol !== 'https:') {
      throw new CLIError(
        `Refusing to download the export from a non-https link (${protocol}).`,
        ExitCode.API_ERROR
      );
    }
    const response = await fetch(current, { redirect: 'manual' });
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) {
      throw new CLIError(`Downloading the export failed (HTTP ${response.status}).`, ExitCode.API_ERROR);
    }
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
    return;
  }
  throw new CLIError('Downloading the export failed: too many redirects.', ExitCode.API_ERROR);
}

interface ExportContext {
  client: TimesheetClient;
  formatter: OutputFormatter;
  spinner: Spinner;
  json: boolean;
}

/** Sends the export by email, prints its link, or saves the file, as the delivery options say. */
export async function deliverExport(
  { client, formatter, spinner, json }: ExportContext,
  params: WithTitle<ExportParams>,
  delivery: DeliveryOptions
): Promise<void> {
  const summary = {
    report: params.report,
    format: params.format ?? 'xlsx',
    startDate: params.startDate,
    endDate: params.endDate,
  };

  try {
    if (delivery.email) {
      spinner.start('Sending export...');
      await client.reports.export.send({ ...params, email: delivery.email } as ExportParams);
      spinner.stop();

      if (json) {
        output(formatter, { sent: true, email: delivery.email, ...summary });
      } else if (formatter.mode === 'pipe') {
        output(formatter, `sent\t${delivery.email}`);
      } else {
        output(formatter, formatter.formatSuccess(`Export sent to ${delivery.email}.`));
      }
      return;
    }

    spinner.start(`Generating ${summary.format.toUpperCase()} export...`);
    const { url } = await client.reports.export.generate(params);

    if (delivery.urlOnly) {
      spinner.stop();
      output(formatter, json ? { url, ...summary } : url);
      return;
    }

    const file = await outputPath(delivery.output, defaultFileName(params));
    spinner.update('Downloading export...');
    await downloadFile(url, file);
    spinner.stop();

    if (json) {
      output(formatter, { file, url, ...summary });
    } else if (formatter.mode === 'pipe') {
      output(formatter, file);
    } else {
      output(formatter, formatter.formatSuccess(`Export saved to ${file}`));
    }
  } catch (error) {
    spinner.fail('Export failed');
    throw error;
  }
}

/** `reports export` and `reports types`. */
export function registerReportsExportCommands(reports: Command): void {
  const exportCommand = reports
    .command('export')
    .description('Export time entries as an Excel, CSV or PDF file');
  addSettingsOptions(exportCommand);
  addPeriodOptions(exportCommand);
  addDeliveryOptions(exportCommand);
  exportCommand.action(
    async (
      options: ExportSettingsOptions & PeriodOptions & DeliveryOptions,
      command: Command
    ) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const period = resolvePeriod(options);
      checkDelivery(options);

      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      const params: WithTitle<ExportParams> = {
        ...settingsFromOptions(options),
        report: (await resolveReport(client, options.report)) ?? DATA_REPORT,
        format: options.format ?? 'xlsx',
        ...period,
        organizationId: organizationFor(options),
      };

      await deliverExport(
        { client, formatter, spinner, json: !!globalOptions.json },
        params,
        options
      );
    }
  );

  reports
    .command('types')
    .description('List the report types an export can use')
    .action(async (_options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Loading report types...');
      const { items } = await client.reports.export.getReportTypes();
      spinner.stop();

      if (globalOptions.json) {
        output(formatter, items);
        return;
      }

      const columns: ColumnDef<(typeof items)[number]>[] = [
        { key: 'id', header: 'ID', width: 6 },
        { key: 'name', header: 'Name', width: 40 },
      ];
      output(formatter, formatter.formatTable(items, columns));
      newline();
      output(
        formatter,
        formatter.formatHint('Export one with: timesheet reports export --report <id> --last-month')
      );
    });
}
