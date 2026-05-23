import { Command } from 'commander';
import { registerOrganizationsListCommand } from './list.js';
import { registerOrganizationsCrudCommands } from './crud.js';
import { registerOrganizationsMembersCommands } from './members/index.js';

export function registerOrganizationsCommands(program: Command): void {
  const organizations = program
    .command('organizations')
    .alias('orgs')
    .description('Organization management commands');

  registerOrganizationsListCommand(organizations);
  registerOrganizationsCrudCommands(organizations);
  registerOrganizationsMembersCommands(organizations);
}
