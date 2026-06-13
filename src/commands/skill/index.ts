import { Command } from 'commander';
import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createFormatter, output, newline } from '../../output/index.js';
import { CLIError, ExitCode } from '../../utils/index.js';
import type { GlobalOptions } from '../../types/index.js';

type Target = 'claude' | 'clawdbot';

interface InstallOptions {
  claude?: boolean;
  clawdbot?: boolean;
  project?: boolean;
  path?: string;
  force?: boolean;
}

function findBundledSkillFile(): string {
  // dist/index.js -> ../skill/SKILL.md  (npm-installed layout)
  // src/commands/skill/index.ts -> ../../../skill/SKILL.md  (dev layout)
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '..', 'skill', 'SKILL.md'),
    resolve(here, '..', '..', 'skill', 'SKILL.md'),
    resolve(here, '..', '..', '..', 'skill', 'SKILL.md'),
    resolve(here, '..', '..', '..', '..', 'skill', 'SKILL.md'),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new CLIError(
      'Bundled SKILL.md not found. Reinstall @timesheet/cli or run `npm run build` from source.',
      ExitCode.GENERAL_ERROR
    );
  }
  return found;
}

function resolveTargetDir(options: InstallOptions): { target: Target; dir: string } {
  if (options.path) {
    const target: Target = options.clawdbot ? 'clawdbot' : 'claude';
    return { target, dir: resolve(options.path, 'timesheet') };
  }

  if (options.clawdbot) {
    return { target: 'clawdbot', dir: join(homedir(), '.clawdbot', 'skills', 'timesheet') };
  }

  if (options.project) {
    return { target: 'claude', dir: resolve(process.cwd(), '.claude', 'skills', 'timesheet') };
  }

  return { target: 'claude', dir: join(homedir(), '.claude', 'skills', 'timesheet') };
}

export function registerSkillCommands(program: Command): void {
  const skill = program
    .command('skill')
    .description('Manage the bundled timesheet skill for Claude Code, Clawdbot, and other agents');

  skill
    .command('install')
    .description('Install the bundled SKILL.md into an agent skills directory')
    .option('--claude', 'Install for Claude Code (default)')
    .option('--clawdbot', 'Install for Clawdbot (~/.clawdbot/skills/)')
    .option('--project', 'Install into ./.claude/skills/ in the current directory')
    .option('--path <dir>', 'Custom skills directory (a "timesheet" subdir is created)')
    .option('-f, --force', 'Overwrite an existing installation')
    .action(async (options: InstallOptions, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);

      const src = findBundledSkillFile();
      const { target, dir } = resolveTargetDir(options);
      const dest = join(dir, 'SKILL.md');

      if (existsSync(dest) && !options.force) {
        if (globalOptions.json) {
          output(formatter, { installed: false, reason: 'exists', path: dest, target });
          return;
        }
        output(formatter, formatter.formatWarning(`Already installed at ${dest}`));
        newline();
        output(formatter, formatter.formatHint('Pass --force to overwrite.'));
        process.exit(ExitCode.GENERAL_ERROR);
      }

      mkdirSync(dir, { recursive: true });
      copyFileSync(src, dest);

      if (globalOptions.json) {
        output(formatter, { installed: true, path: dest, target });
        return;
      }

      output(formatter, formatter.formatSuccess(`Skill installed at ${dest}`));
      newline();
      if (target === 'claude') {
        output(formatter, formatter.formatHint('Restart Claude Code or run /skills to discover it. Invoke with /timesheet.'));
      } else {
        output(formatter, formatter.formatHint('Restart Clawdbot to discover it.'));
      }
    });

  skill
    .command('path')
    .description('Print the resolved install path without writing anything')
    .option('--claude', 'Show path for Claude Code (default)')
    .option('--clawdbot', 'Show path for Clawdbot')
    .option('--project', 'Show path for project-local Claude Code install')
    .option('--path <dir>', 'Custom skills directory')
    .action(async (options: InstallOptions, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const { target, dir } = resolveTargetDir(options);
      const dest = join(dir, 'SKILL.md');

      if (globalOptions.json) {
        output(formatter, { target, path: dest, exists: existsSync(dest) });
        return;
      }
      output(formatter, dest);
    });

  skill
    .command('show')
    .description('Print the bundled SKILL.md to stdout')
    .action(async (_options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const src = findBundledSkillFile();
      const content = readFileSync(src, 'utf8');

      if (globalOptions.json) {
        output(formatter, { path: src, content });
        return;
      }
      output(formatter, content);
    });
}
