#!/usr/bin/env node
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const repoRoot = resolve(pkgRoot, '..', '..');

const src = resolve(repoRoot, 'tools/skills/timesheet-plugin/skills/timesheet/SKILL.md');
const destDir = resolve(pkgRoot, 'skill');
const dest = resolve(destDir, 'SKILL.md');

if (!existsSync(src)) {
  console.error(`sync-skill: canonical SKILL.md not found at ${src}`);
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`sync-skill: copied ${src} -> ${dest}`);
