import type { Command } from 'commander';
import { registerAuthCommands } from './auth/index.js';
import { registerTimerCommands } from './timer/index.js';
import { registerProjectsCommands } from './projects/index.js';
import { registerTasksCommands } from './tasks/index.js';
import { registerTeamsCommands } from './teams/index.js';
import { registerTagsCommands } from './tags/index.js';
import { registerReportsCommands } from './reports/index.js';
import { registerProfileCommands } from './profile/index.js';
import { registerConfigCommands } from './config/index.js';
import { registerAbsencesCommands } from './absences/index.js';
import { registerAbsenceTypesCommands } from './absence-types/index.js';
import { registerContractsCommands } from './contracts/index.js';
import { registerOrganizationsCommands } from './organizations/index.js';
import { registerExpensesCommands } from './expenses/index.js';
import { registerNotesCommands } from './notes/index.js';
import { registerPausesCommands } from './pauses/index.js';
import { registerTodosCommands } from './todos/index.js';
import { registerRatesCommands } from './rates/index.js';
import { registerSkillCommands } from './skill/index.js';

/**
 * Register all CLI commands
 */
export function registerCommands(program: Command): void {
  registerAuthCommands(program);
  registerTimerCommands(program);
  registerProjectsCommands(program);
  registerTasksCommands(program);
  registerTeamsCommands(program);
  registerTagsCommands(program);
  registerReportsCommands(program);
  registerProfileCommands(program);
  registerConfigCommands(program);
  registerAbsencesCommands(program);
  registerAbsenceTypesCommands(program);
  registerContractsCommands(program);
  registerOrganizationsCommands(program);
  registerExpensesCommands(program);
  registerNotesCommands(program);
  registerPausesCommands(program);
  registerTodosCommands(program);
  registerRatesCommands(program);
  registerSkillCommands(program);
}
