import type { CLIConfig } from '../types/index.js';

/**
 * Default configuration values
 */
export const defaultConfig: CLIConfig = {
  apiUrl: 'https://api.timesheet.io',
  reportsUrl: 'https://reports.timesheet.io',
  colors: true,
  dateFormat: 'yyyy-MM-dd',
  timeFormat: 'HH:mm',
  confirmDeletes: true,
  paginationLimit: 20,
};

/**
 * Configuration file schema for validation
 */
export const configSchema = {
  apiUrl: {
    type: 'string' as const,
    default: defaultConfig.apiUrl,
  },
  reportsUrl: {
    type: 'string' as const,
    default: defaultConfig.reportsUrl,
  },
  colors: {
    type: 'boolean' as const,
    default: defaultConfig.colors,
  },
  dateFormat: {
    type: 'string' as const,
    default: defaultConfig.dateFormat,
  },
  timeFormat: {
    type: 'string' as const,
    default: defaultConfig.timeFormat,
  },
  defaultProjectId: {
    type: 'string' as const,
  },
  defaultTeamId: {
    type: 'string' as const,
  },
  defaultOrganizationId: {
    type: 'string' as const,
  },
  confirmDeletes: {
    type: 'boolean' as const,
    default: defaultConfig.confirmDeletes,
  },
  paginationLimit: {
    type: 'number' as const,
    default: defaultConfig.paginationLimit,
    minimum: 1,
    maximum: 100,
  },
};
