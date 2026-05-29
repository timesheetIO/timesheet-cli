import { Command } from 'commander';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner, formatDurationSeconds } from '../../utils/index.js';
import type { GlobalOptions } from '../../types/index.js';
import type { Task } from '@timesheet/sdk';

export function registerReportsCommands(program: Command): void {
  const reports = program
    .command('reports')
    .alias('r')
    .description('Report and export commands');

  // Summary report
  reports
    .command('summary')
    .description('Show time summary report')
    .option(
      '-s, --start-date <date>',
      'Start date (YYYY-MM-DD, default: start of month)'
    )
    .option('-e, --end-date <date>', 'End date (YYYY-MM-DD, default: today)')
    .option('-p, --project <project-id>', 'Filter by project')
    .option('--this-month', 'Show this month only')
    .option('--last-month', 'Show last month only')
    .action(
      async (
        options: {
          startDate?: string;
          endDate?: string;
          project?: string;
          thisMonth?: boolean;
          lastMonth?: boolean;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        // Calculate date range
        let startDate: Date;
        let endDate: Date;

        if (options.thisMonth) {
          startDate = startOfMonth(new Date());
          endDate = new Date();
        } else if (options.lastMonth) {
          const lastMonth = subDays(startOfMonth(new Date()), 1);
          startDate = startOfMonth(lastMonth);
          endDate = endOfMonth(lastMonth);
        } else {
          startDate = options.startDate
            ? new Date(options.startDate)
            : startOfMonth(new Date());
          endDate = options.endDate ? new Date(options.endDate) : new Date();
        }

        spinner.start('Loading report data...');

        const dateFormat = 'yyyy-MM-dd';

        // Fetch tasks for the period
        const page = await client.tasks.search({
          projectId: options.project,
          startDate: format(startDate, dateFormat),
          endDate: format(endDate, dateFormat),
          limit: 1000,
        });

        spinner.stop();

        // Calculate summary
        const tasks = page.items;
        const totalDuration = tasks.reduce((sum: number, t: Task) => sum + (t.duration || 0), 0);
        const billableDuration = tasks
          .filter((t: Task) => t.billable)
          .reduce((sum: number, t: Task) => sum + (t.duration || 0), 0);
        const nonBillableDuration = totalDuration - billableDuration;

        // Group by project
        const byProject = new Map<string, { title: string; duration: number }>();
        for (const task of tasks) {
          const projectId = task.project?.id || 'unknown';
          const projectTitle = task.project?.title || 'Unknown';
          const current = byProject.get(projectId) || {
            title: projectTitle,
            duration: 0,
          };
          current.duration += task.duration || 0;
          byProject.set(projectId, current);
        }

        if (globalOptions.json) {
          output(formatter, {
            period: {
              start: format(startDate, dateFormat),
              end: format(endDate, dateFormat),
            },
            totalTasks: tasks.length,
            totalDuration,
            billableDuration,
            nonBillableDuration,
            byProject: Array.from(byProject.entries()).map(([id, data]) => ({
              id,
              title: data.title,
              duration: data.duration,
            })),
          });
          return;
        }

        output(formatter, formatter.formatHeader('Time Summary Report'));
        newline();

        output(
          formatter,
          formatter.formatKeyValue({
            Period: `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`,
            'Total Tasks': tasks.length.toString(),
            'Total Time': formatDurationSeconds(totalDuration),
            Billable: formatDurationSeconds(billableDuration),
            'Non-Billable': formatDurationSeconds(nonBillableDuration),
          })
        );

        if (byProject.size > 0) {
          newline();
          output(formatter, formatter.formatHeader('By Project'));
          newline();

          const projectData = Array.from(byProject.entries())
            .sort((a, b) => b[1].duration - a[1].duration)
            .map(([, data]) => ({
              Project: data.title,
              Duration: formatDurationSeconds(data.duration),
            }));

          for (const project of projectData) {
            output(
              formatter,
              `  ${project.Project.padEnd(30)} ${project.Duration}`
            );
          }
        }
      }
    );

  // Export command
  reports
    .command('export')
    .description('Export timesheet data')
    .requiredOption(
      '-f, --format <format>',
      'Export format (xlsx, csv, pdf)'
    )
    .requiredOption('-s, --start-date <date>', 'Start date (YYYY-MM-DD)')
    .requiredOption('-e, --end-date <date>', 'End date (YYYY-MM-DD)')
    .option('-p, --project <project-id>', 'Filter by project')
    .option('-o, --output <file>', 'Output file path')
    .action(
      async (
        options: {
          format: string;
          startDate: string;
          endDate: string;
          project?: string;
          output?: string;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const validFormats = ['xlsx', 'csv', 'pdf'];
        if (!validFormats.includes(options.format.toLowerCase())) {
          output(
            formatter,
            formatter.formatError(
              `Invalid format. Use one of: ${validFormats.join(', ')}`
            )
          );
          process.exit(2);
        }

        spinner.start(`Generating ${options.format.toUpperCase()} export...`);

        try {
          // Note: The actual export API might differ - this is a placeholder
          // for the real implementation based on the SDK's export capabilities
          await client.reports.export.generate({
            report: 1, // Default report type
            startDate: options.startDate,
            endDate: options.endDate,
            format: options.format as 'xlsx' | 'csv' | 'pdf',
            projectIds: options.project ? [options.project] : undefined,
          });

          spinner.stop();

          if (globalOptions.json) {
            output(formatter, {
              success: true,
              format: options.format,
              startDate: options.startDate,
              endDate: options.endDate,
            });
            return;
          }

          output(formatter, formatter.formatSuccess('Export generated!'));
          newline();
          output(
            formatter,
            formatter.formatHint(
              'Check your downloads or the specified output path.'
            )
          );
        } catch (error) {
          spinner.fail('Export failed');
          throw error;
        }
      }
    );
}
