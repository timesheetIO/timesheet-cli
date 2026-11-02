import { describe, expect, it, vi } from 'vitest';

const created = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock('@timesheet/sdk', () => ({
  TimesheetClient: class {
    constructor(options: Record<string, unknown>) {
      created.push(options);
    }
  },
}));

vi.mock('../src/config/index.js', () => ({
  getApiKey: () => 'ts_test.key',
  getOAuthClient: () => undefined,
  getConfig: (key: string) =>
    ({ apiUrl: 'https://test-api.timesheet.io', reportsUrl: 'https://test-reports.timesheet.io' })[key],
}));

vi.mock('../src/auth', () => ({
  getTokens: async () => null,
  isTokenExpired: async () => false,
  refreshAccessToken: async () => ({ accessToken: 'x' }),
}));

import { getClient } from '../src/sdk/client.js';

describe('getClient', () => {
  it('sends API and reports calls to the configured services', async () => {
    await getClient();

    // Without reportsBaseUrl the SDK sent exports to production whatever reportsUrl said.
    expect(created).toEqual([
      expect.objectContaining({
        apiKey: 'ts_test.key',
        baseUrl: 'https://test-api.timesheet.io',
        reportsBaseUrl: 'https://test-reports.timesheet.io',
      }),
    ]);
  });
});
