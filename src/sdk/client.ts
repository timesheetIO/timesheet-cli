import {type Authentication, TimesheetClient,} from '@timesheet/sdk';
import {getApiKey, getConfig, getOAuthClient} from '../config/index.js';
import {getTokens, isTokenExpired, refreshAccessToken} from '../auth';
import {CLIError, ExitCode} from '../utils';
import type {GlobalOptions} from '../types';

let clientInstance: TimesheetClient | null = null;
let currentAuthMethod: 'apikey' | 'oauth' | null = null;

/**
 * Custom authentication that handles token refresh for CLI
 */
class CLIAuth implements Authentication {
    private accessToken: string;
    private refreshToken?: string;

    constructor(accessToken: string, refreshToken?: string, _clientId?: string) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
    }

    applyAuth(config: { headers?: Record<string, string> }): void {
        if (!config.headers) {
            config.headers = {};
        }
        config.headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    needsRefresh(): boolean {
        // Check is handled externally before API calls
        return false;
    }

    async refresh(): Promise<void> {
        if (!this.refreshToken) {
            throw new CLIError(
                'Cannot refresh without refresh token',
                ExitCode.AUTH_ERROR
            );
        }

        const newTokens = await refreshAccessToken();
        this.accessToken = newTokens.accessToken;
        if (newTokens.refreshToken) {
            this.refreshToken = newTokens.refreshToken;
        }
    }

    async getAuthHeaders(): Promise<Record<string, string>> {
        return {
            Authorization: `Bearer ${this.accessToken}`,
        };
    }

    updateAccessToken(token: string): void {
        this.accessToken = token;
    }
}

/**
 * Get or create the SDK client instance
 */
export async function getClient(options?: GlobalOptions): Promise<TimesheetClient> {
    // Check for explicit API key in options
    const explicitApiKey = options?.apiKey;

    // Check environment variable
    const envApiKey = getApiKey();

    // Determine which API key to use
    const apiKey = explicitApiKey || envApiKey;

    // If we have a cached client and auth method matches, return it
    if (clientInstance) {
        if (apiKey && currentAuthMethod === 'apikey') {
            return clientInstance;
        }
        if (!apiKey && currentAuthMethod === 'oauth') {
            // Check if we need to refresh
            if (await isTokenExpired()) {
                await refreshAccessToken();
                clientInstance = null; // Force recreation with new token
            } else {
                return clientInstance;
            }
        }
    }

    const baseUrl = getConfig('apiUrl');
    // Exports, templates and report PDFs go to the reports service: without this they always hit production.
    const reportsBaseUrl = getConfig('reportsUrl');

    // Try API key authentication first
    if (apiKey) {
        clientInstance = new TimesheetClient({
            apiKey,
            baseUrl,
            reportsBaseUrl,
        });
        currentAuthMethod = 'apikey';
        return clientInstance;
    }

    // Try OAuth tokens
    const tokens = await getTokens();
    if (tokens) {
        // Check and refresh if needed
        if (await isTokenExpired()) {
            if (tokens.refreshToken) {
                const newTokens = await refreshAccessToken();
                const oauthClient = getOAuthClient();

                const auth = new CLIAuth(
                    newTokens.accessToken,
                    newTokens.refreshToken,
                    oauthClient?.clientId
                );

                clientInstance = new TimesheetClient({
                    authentication: auth,
                    baseUrl,
                    reportsBaseUrl,
                });
                currentAuthMethod = 'oauth';
                return clientInstance;
            }
            throw new CLIError(
                'Access token expired and no refresh token available. Please login again.',
                ExitCode.AUTH_ERROR
            );
        }

        const oauthClient = getOAuthClient();
        const auth = new CLIAuth(
            tokens.accessToken,
            tokens.refreshToken,
            oauthClient?.clientId
        );

        clientInstance = new TimesheetClient({
            authentication: auth,
            baseUrl,
            reportsBaseUrl,
        });
        currentAuthMethod = 'oauth';
        return clientInstance;
    }

    // No authentication available
    throw new CLIError(
        'Not authenticated. Please run "timesheet auth login" or set TIMESHEET_API_KEY.',
        ExitCode.AUTH_ERROR
    );
}

/**
 * Clear the cached client instance
 */
export function clearClient(): void {
    clientInstance = null;
    currentAuthMethod = null;
}

/**
 * Check if a client can be created (has credentials)
 */
export async function hasCredentials(options?: GlobalOptions): Promise<boolean> {
    // Check explicit API key
    if (options?.apiKey) {
        return true;
    }

    // Check environment variable
    if (getApiKey()) {
        return true;
    }

    // Check stored tokens
    const tokens = await getTokens();
    return tokens !== null;
}
