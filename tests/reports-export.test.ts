import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { Command } from 'commander';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { generate, send, getReportTypes } = vi.hoisted(() => ({
  generate: vi.fn(async () => ({ url: 'https://files.example.test/report.pdf' })),
  send: vi.fn(async () => undefined),
  getReportTypes: vi.fn(async () => ({
    items: [
      { id: 0, name: 'Data Report' },
      { id: 4, name: 'Project Summary' },
    ],
  })),
}));

vi.mock('../src/sdk/index.js', () => ({
  getClient: async () => ({ reports: { export: { generate, send, getReportTypes } } }),
}));

vi.mock('../src/config/index.js', () => ({
  getConfig: () => undefined,
}));

import { registerReportsCommands } from '../src/commands/reports/index.js';

/** Runs `timesheet --json reports export ...` against the stubbed SDK client. */
async function exportWith(...args: string[]): Promise<void> {
  const program = new Command().option('--json', 'Output as JSON').exitOverride();
  registerReportsCommands(program);
  await program.parseAsync(['--json', 'reports', 'export', ...args], { from: 'user' });
}

/** The export params the command handed to the SDK, as they go over the wire. */
function sentParams(mock: MockInstance = generate): Record<string, unknown> {
  return JSON.parse(JSON.stringify((mock.mock.calls[0] as unknown[])[0]));
}

const PERIOD = ['-s', '2026-10-01', '-e', '2026-10-31'];

describe('reports export', () => {
  let dir: string;
  let log: MockInstance;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    generate.mockClear();
    send.mockClear();
    getReportTypes.mockClear();
    dir = mkdtempSync(join(tmpdir(), 'timesheet-cli-export-'));
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
    fetchMock = vi.fn(async () => new Response('file-bytes', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    rmSync(dir, { recursive: true, force: true });
  });

  const printed = (): Record<string, unknown> => JSON.parse(log.mock.calls[0][0] as string);

  it('sends the PDF heading with the export', async () => {
    await exportWith('-f', 'pdf', ...PERIOD, '--title', 'Hours report, Jane Smith', '-o', dir);

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'pdf',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        title: 'Hours report, Jane Smith',
      })
    );
  });

  it('leaves the title out without --title, so the report name is used', async () => {
    await exportWith('-f', 'pdf', ...PERIOD, '-o', dir);

    expect(sentParams()).not.toHaveProperty('title');
  });

  it('exports the task data report as xlsx by default', async () => {
    await exportWith(...PERIOD, '-o', dir);

    expect(sentParams()).toMatchObject({ report: 0, format: 'xlsx' });
    expect(getReportTypes).not.toHaveBeenCalled();
  });

  it('hands the report, filters and options to the SDK', async () => {
    await exportWith(
      ...PERIOD,
      '-r', '4',
      '-f', 'csv',
      '-p', 'p1,p2',
      '-p', 'p3',
      '-t', 'team1',
      '-u', 'u1,u2',
      '--tag', 'tag1',
      '--type', 'task',
      '--filter', 'billable',
      '--split-tasks',
      '--summarize',
      '--filename', 'october',
      '-o', dir
    );

    expect(sentParams()).toEqual({
      report: 4,
      format: 'csv',
      projectIds: ['p1', 'p2', 'p3'],
      teamIds: ['team1'],
      userIds: ['u1', 'u2'],
      tagIds: ['tag1'],
      type: 'task',
      filter: 'billable',
      splitTask: true,
      summarize: true,
      filename: 'october',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });
  });

  it('looks a report up by name', async () => {
    await exportWith(...PERIOD, '--report', 'project summary', '-o', dir);

    expect(sentParams()).toMatchObject({ report: 4 });
  });

  it('refuses a report name that does not exist', async () => {
    await expect(exportWith(...PERIOD, '--report', 'Nope')).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('4 (Project Summary)'),
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it('takes --last-month as the previous calendar month', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 2, 15, 12));
    try {
      await exportWith('--last-month', '-o', dir);
    } finally {
      vi.useRealTimers();
    }

    expect(sentParams()).toMatchObject({ startDate: '2026-02-01', endDate: '2026-02-28' });
  });

  it('refuses two periods at once and invalid dates', async () => {
    await expect(exportWith('--this-month', '-s', '2026-10-01')).rejects.toMatchObject({ exitCode: 2 });
    await expect(exportWith('-s', '2026-02-30')).rejects.toMatchObject({ exitCode: 2 });
    await expect(exportWith('-s', '2026-10-31', '-e', '2026-10-01')).rejects.toMatchObject({ exitCode: 2 });
    expect(generate).not.toHaveBeenCalled();
  });

  it('downloads the file to -o and prints the file and the link', async () => {
    const file = join(dir, 'out.pdf');
    await exportWith('-f', 'pdf', ...PERIOD, '-o', file);

    expect(fetchMock).toHaveBeenCalledWith('https://files.example.test/report.pdf', { redirect: 'manual' });
    expect(readFileSync(file, 'utf8')).toBe('file-bytes');
    expect(printed()).toEqual({
      file,
      url: 'https://files.example.test/report.pdf',
      report: 0,
      format: 'pdf',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });
  });

  it('names the file after the filename, period and format when -o is a directory', async () => {
    await exportWith('-f', 'xlsx1904', ...PERIOD, '--filename', 'Stunden März/Q4', '-o', dir);

    const file = join(dir, 'Stunden_März_Q4_2026-10-01_2026-10-31.xlsx');
    expect(readFileSync(file, 'utf8')).toBe('file-bytes');
    expect(printed()).toMatchObject({ file });
  });

  it('creates a directory given with a trailing slash and saves into it', async () => {
    await exportWith(...PERIOD, '-o', `${join(dir, 'exports')}/`);

    expect(readFileSync(join(dir, 'exports', 'timesheet_2026-10-01_2026-10-31.xlsx'), 'utf8')).toBe('file-bytes');
  });

  it('refuses a download link that is not https', async () => {
    generate.mockResolvedValueOnce({ url: 'http://files.example.test/report.pdf' });

    await expect(exportWith(...PERIOD, '-o', dir)).rejects.toMatchObject({
      exitCode: 4,
      message: expect.stringContaining('non-https'),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('follows https redirects but not one to http', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/moved.pdf' } }))
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: 'http://files.example.test/plain.pdf' } })
      );

    await expect(exportWith(...PERIOD, '-o', dir)).rejects.toMatchObject({ exitCode: 4 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://files.example.test/moved.pdf');
  });

  it('reports a failed download', async () => {
    fetchMock.mockResolvedValueOnce(new Response('expired', { status: 403 }));

    await expect(exportWith(...PERIOD, '-o', dir)).rejects.toMatchObject({
      exitCode: 4,
      message: expect.stringContaining('HTTP 403'),
    });
  });

  it('prints the link without downloading with --url-only', async () => {
    await exportWith(...PERIOD, '--url-only');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(printed()).toMatchObject({ url: 'https://files.example.test/report.pdf' });
  });

  it('emails the export with --email instead of downloading it', async () => {
    await exportWith('-f', 'pdf', ...PERIOD, '--email', 'billing@example.test', '--title', 'October');

    expect(generate).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sentParams(send)).toMatchObject({
      email: 'billing@example.test',
      report: 0,
      format: 'pdf',
      title: 'October',
      startDate: '2026-10-01',
    });
    expect(printed()).toMatchObject({ sent: true, email: 'billing@example.test' });
  });

  it('refuses --email together with --output', async () => {
    await expect(exportWith(...PERIOD, '--email', 'a@example.test', '-o', dir)).rejects.toMatchObject({
      exitCode: 2,
    });
    expect(send).not.toHaveBeenCalled();
  });
});
