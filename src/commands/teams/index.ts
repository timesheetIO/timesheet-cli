import { Command } from 'commander';
import { registerTeamsListCommand } from './list.js';
import { registerTeamsMembersCommands } from './members/index.js';

export function registerTeamsCommands(program: Command): void {
  const teams = program
    .command('teams')
    .description('Team management commands');

  registerTeamsListCommand(teams);
  registerTeamsMembersCommands(teams);
}
