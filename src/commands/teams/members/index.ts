import type { Command } from 'commander';
import { registerTeamMembersListCommand } from './list.js';
import { registerTeamMembersAddCommand } from './add.js';
import { registerTeamMembersUpdateCommand } from './update.js';
import { registerTeamMembersRemoveCommand } from './remove.js';
import { registerTeamMembersStatusCommand } from './status.js';

export function registerTeamsMembersCommands(parent: Command): void {
  const members = parent
    .command('members')
    .description('Team member management commands');

  registerTeamMembersListCommand(members);
  registerTeamMembersAddCommand(members);
  registerTeamMembersUpdateCommand(members);
  registerTeamMembersRemoveCommand(members);
  registerTeamMembersStatusCommand(members);
}
