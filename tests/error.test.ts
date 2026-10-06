import { describe, expect, it } from 'vitest';
import { TimesheetApiError, TimesheetAuthError } from '@timesheet/sdk';
import { mapSdkError } from '../src/utils/error.js';
import { ExitCode } from '../src/types/index.js';

describe('mapSdkError', () => {
  it('asks for a login only when the session is gone (401)', () => {
    const error = mapSdkError(new TimesheetAuthError('Unauthorized'));
    expect(error.exitCode).toBe(ExitCode.AUTH_ERROR);
    expect(error.message).toContain('timesheet auth login');
  });

  it('says a refused permission (403) plainly, without suggesting a login', () => {
    const body = JSON.stringify({ error: 'InvalidPermissionException', message: 'Invalid Permission Exception' });
    const error = mapSdkError(new TimesheetApiError('Invalid Permission Exception', 403, body));
    expect(error.exitCode).toBe(ExitCode.API_ERROR);
    expect(error.message).toBe("You don't have permission to do this.");
  });

  it("keeps the backend's reason for a 403", () => {
    const body = JSON.stringify({ error: 'ForbiddenException', message: 'Business plan required.' });
    const error = mapSdkError(new TimesheetApiError('Business plan required.', 403, body));
    expect(error.message).toBe("You don't have permission to do this (Business plan required).");
  });
});
