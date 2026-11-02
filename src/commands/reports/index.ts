import { Command } from 'commander';
import { format, parseISO } from 'date-fns';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner, formatDurationSeconds } from '../../utils/index.js';
import type { GlobalOptions } from '../../types/index.js';
import type { Task } from '@timesheet/sdk';
import { registerReportsExportCommands, resolvePeriod } from './export.js';
import { registerReportsTemplatesCommands } from './templates.js';

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
        // The period as local days: new Date('2026-10-01') is UTC midnight, the day before west of UTC.
        const period = resolvePeriod(options);
        const startDate = parseISO(period.startDate);
        const endDate = parseISO(period.endDate);
        const client = await getClient(globalOptions);

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

  registerReportsExportCommands(reports);
  registerReportsTemplatesCommands(reports);
}
