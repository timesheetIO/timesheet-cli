import { getConfig } from '../../config/index.js';
import { CLIError, ExitCode } from '../../utils/index.js';

export function resolveOrganizationId(option?: string): string {
  const orgId = option || getConfig('defaultOrganizationId');
  if (!orgId) {
    throw new CLIError(
      'Organization ID is required. Pass --organization <id> or set defaultOrganizationId via "timesheet config set defaultOrganizationId <id>".',
      ExitCode.USAGE_ERROR
    );
  }
  return orgId;
}
