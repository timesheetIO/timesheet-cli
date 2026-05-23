/**
 * Global CLI options available on all commands
 */
export interface GlobalOptions {
  json?: boolean;
  color?: boolean;
  apiKey?: string;
  verbose?: boolean;
  quiet?: boolean;
}

/**
 * Output mode for CLI responses
 */
export type OutputMode = 'human' | 'pipe' | 'json';

/**
 * Exit codes for CLI operations
 */
export const ExitCode = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  USAGE_ERROR: 2,
  AUTH_ERROR: 3,
  API_ERROR: 4,
  RATE_LIMIT: 5,
  NETWORK_ERROR: 6,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/**
 * Column definition for table output
 */
export interface ColumnDef<T = unknown> {
  key: keyof T | string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: (value: unknown, row: T) => string;
}

/**
 * OAuth client credentials from dynamic registration
 */
export interface OAuthClientCredentials {
  clientId: string;
  clientSecret?: string;
  registeredAt: string;
  clientName: string;
}

/**
 * OAuth tokens stored in session
 */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  tokenType: string;
  scope?: string;
}

/**
 * OAuth server metadata from discovery
 */
export interface OAuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  revocation_endpoint?: string;
  introspection_endpoint?: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  grant_types_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  code_challenge_methods_supported?: string[];
}

/**
 * CLI configuration schema
 */
export interface CLIConfig {
  apiUrl: string;
  reportsUrl: string;
  colors: boolean;
  dateFormat: string;
  timeFormat: string;
  defaultProjectId?: string;
  defaultTeamId?: string;
  defaultOrganizationId?: string;
  confirmDeletes: boolean;
  paginationLimit: number;
}

/**
 * Result from OAuth callback server
 */
export interface OAuthCallbackResult {
  code: string;
  state: string;
}
