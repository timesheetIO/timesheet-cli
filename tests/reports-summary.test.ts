import { afterAll, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const search = vi.hoisted(() => vi.fn(async () => ({ items: [] as unknown[] })));

vi.mock('../src/sdk/index.js', () => ({
  getClient: async () => ({ tasks: { search } }),
}));

vi.mock('../src/config/index.js', () => ({
  getConfig: () => undefined,
}));

import { registerReportsCommands } from '../src/commands/reports/index.js';

const zone = process.env['TZ'];

afterAll(() => {
  process.env['TZ'] = zone;
});

describe('reports summary', () => {
  it('keeps the given days for a user west of UTC', async () => {
    // new Date('2026-10-01') is UTC midnight: 30 September in New York.
    process.env['TZ'] = 'America/New_York';
    const program = new Command().option('--json', 'Output as JSON').exitOverride();
    registerReportsCommands(program);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await program.parseAsync(
        ['--json', 'reports', 'summary', '-s', '2026-10-01', '-e', '2026-10-31'],
        { from: 'user' }
      );
    } finally {
      log.mockRestore();
    }

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2026-10-01', endDate: '2026-10-31' })
    );
  });
});
