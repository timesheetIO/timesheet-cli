import { Command } from 'commander';
import { registerAbsencesListCommand } from './list.js';
import { registerAbsencesShowCommand } from './show.js';
import { registerAbsencesCreateCommand } from './create.js';
import { registerAbsencesUpdateCommand } from './update.js';
import { registerAbsencesDeleteCommand } from './delete.js';
import { registerAbsencesWorkflowCommands } from './workflow.js';

export function registerAbsencesCommands(program: Command): void {
  const absences = program
    .command('absences')
    .alias('a')
    .description('Absence management commands');

  registerAbsencesListCommand(absences);
  registerAbsencesShowCommand(absences);
  registerAbsencesCreateCommand(absences);
  registerAbsencesUpdateCommand(absences);
  registerAbsencesDeleteCommand(absences);
  registerAbsencesWorkflowCommands(absences);
}
