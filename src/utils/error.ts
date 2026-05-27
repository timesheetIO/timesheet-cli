import {
  TimesheetApiError,
  TimesheetAuthError,
  TimesheetRateLimitError,
} from '@timesheet/sdk';
import { ExitCode, type ExitCodeValue } from '../types/index.js';

/**
 * CLI-specific error with exit code
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public readonly exitCode: ExitCodeValue = ExitCode.GENERAL_ERROR,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

/**
 * Build a human-readable message from a backend tier-gate 402 response body.
 * Body shape: { error, required, current }.
 */
function formatTierErrorMessage(responseBody: string | undefined): string {
  let payload: { error?: string; required?: string; current?: string } = {};
  if (responseBody) {
    try {
      payload = JSON.parse(responseBody);
    } catch {
      // Fall through with empty payload
    }
  }

  const required = payload.required ? capitalize(payload.required) : null;
  const current = payload.current ? capitalize(payload.current) : null;

  switch (payload.error) {
    case 'no_subscription':
      return 'This command requires an active subscription.';
    case 'subscription_expired':
      return current
        ? `Your ${current} subscription has expired.`
        : 'Your subscription has expired.';
    case 'tier_insufficient':
      if (required && current) {
        return `This command requires ${required}. You are on ${current}.`;
      }
      return required
        ? `This command requires ${required}.`
        : 'This command requires a higher subscription tier.';
    default:
      return 'This command requires a higher subscription tier.';
  }
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/**
 * Map SDK errors to CLI errors with appropriate exit codes
 */
export function mapSdkError(error: unknown): CLIError {
  if (error instanceof CLIError) {
    return error;
  }

  if (error instanceof TimesheetAuthError) {
    return new CLIError(
      'Authentication failed. Please run "timesheet auth login" to authenticate.',
      ExitCode.AUTH_ERROR,
      error
    );
  }

  if (error instanceof TimesheetRateLimitError) {
    const retryAfter = error.getRetryAfterDate();
    const message = retryAfter
      ? `Rate limit exceeded. Please try again after ${retryAfter.toLocaleTimeString()}.`
      : 'Rate limit exceeded. Please try again later.';
    return new CLIError(message, ExitCode.RATE_LIMIT, error);
  }

  if (error instanceof TimesheetApiError && error.statusCode === 402) {
    return new CLIError(formatTierErrorMessage(error.responseBody), ExitCode.TIER_ERROR, error);
  }

  if (error instanceof TimesheetApiError) {
    return new CLIError(
      error.message || 'API error occurred',
      ExitCode.API_ERROR,
      error
    );
  }

  if (error instanceof Error) {
    // Check for network errors
    if (
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('network')
    ) {
      return new CLIError(
        'Network error. Please check your internet connection.',
        ExitCode.NETWORK_ERROR,
        error
      );
    }

    return new CLIError(error.message, ExitCode.GENERAL_ERROR, error);
  }

  return new CLIError(
    'An unexpected error occurred',
    ExitCode.GENERAL_ERROR,
    error instanceof Error ? error : undefined
  );
}

/**
 * Handle error and exit process
 */
export function handleError(error: unknown, quiet = false): never {
  const cliError = mapSdkError(error);

  if (!quiet) {
    console.error(`Error: ${cliError.message}`);

    if (cliError.exitCode === ExitCode.AUTH_ERROR) {
      console.error('\nTo authenticate, run:');
      console.error('  timesheet auth login');
      console.error('\nOr set an API key:');
      console.error('  export TIMESHEET_API_KEY=your-api-key');
    }

    if (cliError.exitCode === ExitCode.TIER_ERROR) {
      console.error('\nUpgrade your subscription:');
      console.error('  https://timesheet.io/subscription/edit');
    }
  }

  process.exit(cliError.exitCode);
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error);
    }
  };
}
