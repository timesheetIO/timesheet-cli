import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { Command } from 'commander';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEMPLATE = {
  id: 'tpl-1',
  name: 'Monthly hours',
  report: 0,
  format: 'pdf',
  // How the API may return a template's ID lists
  projectIds: '["p1","p2"]',
  userIds: ['u1'],
  filter: 'billable',
  summarize: true,
  filename: 'hours',
  title: 'Hours report, Jane Smith',
};

const api = vi.hoisted(() => ({
  searchTemplates: vi.fn(async () => ({ items: [] as unknown[] })),
  getTemplate: vi.fn(async () => ({}) as Record<string, unknown>),
  createTemplate: vi.fn(async (data: Record<string, unknown>) => ({ id: 'tpl-new', ...data })),
  updateTemplate: vi.fn(async (id: string, data: Record<string, unknown>) => ({ id, name: 'x', ...data })),
  deleteTemplate: vi.fn(async () => undefined),
  generate: vi.fn(async () => ({ url: 'https://files.example.test/hours.pdf' })),
  send: vi.fn(async () => undefined),
  getReportTypes: vi.fn(async () => ({ items: [{ id: 4, name: 'Project Summary' }] })),
}));

vi.mock('../src/sdk/index.js', () => ({
  getClient: async () => ({ reports: { export: api } }),
}));

vi.mock('../src/config/index.js', () => ({
  getConfig: () => undefined,
}));

import { registerReportsCommands } from '../src/commands/reports/index.js';

/** Runs `timesheet --json reports templates ...` against the stubbed SDK client. */
async function templates(...args: string[]): Promise<void> {
  const program = new Command().option('--json', 'Output as JSON').exitOverride();
  registerReportsCommands(program);
  await program.parseAsync(['--json', 'reports', 'templates', ...args], { from: 'user' });
}

/** What the command sent as the request body, as it goes over the wire. */
const body = (mock: MockInstance, arg = 0): Record<string, unknown> =>
  JSON.parse(JSON.stringify((mock.mock.calls[0] as unknown[])[arg]));

describe('reports templates', () => {
  let log: MockInstance;
  let dir: string;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockClear());
    api.getTemplate.mockResolvedValue({ ...TEMPLATE });
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
    dir = mkdtempSync(join(tmpdir(), 'timesheet-cli-templates-'));
    fetchMock = vi.fn(async () => new Response('pdf-bytes', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    rmSync(dir, { recursive: true, force: true });
  });

  const printed = (): Record<string, unknown> => JSON.parse(log.mock.calls[0][0] as string);

  it('lists templates with a server-side search', async () => {
    api.searchTemplates.mockResolvedValueOnce({ items: [{ ...TEMPLATE }] });

    await templates('list', '-q', 'monthly', '-l', '5');

    expect(api.searchTemplates).toHaveBeenCalledWith({ search: 'monthly', limit: 5 });
    expect(printed()).toEqual([expect.objectContaining({ id: 'tpl-1', projectIds: ['p1', 'p2'] })]);
  });

  it('shows a template with its ID lists as arrays', async () => {
    await templates('show', 'tpl-1');

    expect(api.getTemplate).toHaveBeenCalledWith('tpl-1');
    expect(printed()).toMatchObject({ projectIds: ['p1', 'p2'], userIds: ['u1'], title: TEMPLATE.title });
  });

  it('creates a template with its settings and PDF title', async () => {
    await templates(
      'create', 'Monthly hours',
      '--report', 'Project Summary',
      '-f', 'pdf',
      '-p', 'p1,p2',
      '--filter', 'billable',
      '--summarize',
      '--filename', 'hours',
      '--title', 'Hours report, Jane Smith',
      '--email', 'billing@example.test'
    );

    expect(body(api.createTemplate)).toEqual({
      name: 'Monthly hours',
      report: 4,
      format: 'pdf',
      projectIds: ['p1', 'p2'],
      filter: 'billable',
      summarize: true,
      filename: 'hours',
      title: 'Hours report, Jane Smith',
      email: 'billing@example.test',
    });
  });

  it('updates only the given settings', async () => {
    await templates('update', 'tpl-1', '--title', 'New heading', '--no-summarize');

    expect(api.updateTemplate.mock.calls[0][0]).toBe('tpl-1');
    expect(body(api.updateTemplate, 1)).toEqual({ title: 'New heading', summarize: false });
  });

  it('clears the PDF title with --title "" and a filter with an empty list', async () => {
    await templates('update', 'tpl-1', '--title', '', '-p', '');

    expect(body(api.updateTemplate, 1)).toEqual({ title: '', projectIds: [] });
  });

  it('leaves the title alone when --title is left out', async () => {
    await templates('update', 'tpl-1', '-n', 'Renamed');

    expect(body(api.updateTemplate, 1)).toEqual({ name: 'Renamed' });
  });

  it('sends nothing when no setting is given', async () => {
    await templates('update', 'tpl-1');

    expect(api.updateTemplate).not.toHaveBeenCalled();
  });

  it('deletes a template', async () => {
    await templates('delete', 'tpl-1', '--force');

    expect(api.deleteTemplate).toHaveBeenCalledWith('tpl-1');
    expect(printed()).toEqual({ deleted: true, id: 'tpl-1' });
  });

  it("runs a template for a period and saves the file", async () => {
    const file = join(dir, 'october.pdf');
    await templates('run', 'tpl-1', '-s', '2026-10-01', '-e', '2026-10-31', '-o', file);

    expect(body(api.generate)).toEqual({
      report: 0,
      format: 'pdf',
      projectIds: ['p1', 'p2'],
      userIds: ['u1'],
      filter: 'billable',
      summarize: true,
      filename: 'hours',
      title: 'Hours report, Jane Smith',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });
    expect(readFileSync(file, 'utf8')).toBe('pdf-bytes');
    expect(printed()).toMatchObject({ file, url: 'https://files.example.test/hours.pdf' });
  });

  it('runs a template by email', async () => {
    await templates('run', 'tpl-1', '--last-month', '--email', 'billing@example.test');

    expect(api.generate).not.toHaveBeenCalled();
    expect(body(api.send)).toMatchObject({ email: 'billing@example.test', title: TEMPLATE.title });
  });
});
