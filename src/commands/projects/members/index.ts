import type { Command } from 'commander';
import { registerProjectMembersListCommand } from './list.js';
import { registerProjectMembersAddCommand } from './add.js';
import { registerProjectMembersUpdateCommand } from './update.js';
import { registerProjectMembersRemoveCommand } from './remove.js';

export function registerProjectsMembersCommands(parent: Command): void {
  const members = parent
    .command('members')
    .description('Project member management commands');

  registerProjectMembersListCommand(members);
  registerProjectMembersAddCommand(members);
  registerProjectMembersUpdateCommand(members);
  registerProjectMembersRemoveCommand(members);
}
