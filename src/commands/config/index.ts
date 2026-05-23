import { Command } from 'commander';
import {
  getAllConfig,
  setConfig,
  getConfigDir,
  defaultConfig,
  configSchema,
} from '../../config/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import type { GlobalOptions, CLIConfig } from '../../types/index.js';

export function registerConfigCommands(program: Command): void {
  const config = program
    .command('config')
    .description('CLI configuration commands');

  // Show configuration
  config
    .command('show')
    .description('Show current configuration')
    .action(async (_options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);

      const currentConfig = getAllConfig();

      if (globalOptions.json) {
        output(formatter, {
          configDir: getConfigDir(),
          config: currentConfig,
        });
        return;
      }

      output(formatter, formatter.formatHeader('CLI Configuration'));
      newline();

      output(
        formatter,
        formatter.formatKeyValue({
          'Config Directory': getConfigDir(),
        })
      );
      newline();

      const configData: Record<string, string> = {};
      for (const [key, value] of Object.entries(currentConfig)) {
        configData[key] = String(value);
      }

      output(formatter, formatter.formatKeyValue(configData));
      newline();
      output(
        formatter,
        formatter.formatHint(
          'Set a value with: timesheet config set <key> <value>'
        )
      );
    });

  // Set configuration value
  config
    .command('set')
    .description('Set a configuration value')
    .argument('<key>', 'Configuration key')
    .argument('<value>', 'Configuration value')
    .action(
      async (key: string, value: string, _options: object, command: Command) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);

        // Validate key
        const validKeys = Object.keys(configSchema) as (keyof CLIConfig)[];
        if (!validKeys.includes(key as keyof CLIConfig)) {
          output(
            formatter,
            formatter.formatError(`Invalid configuration key: ${key}`)
          );
          newline();
          output(
            formatter,
            formatter.formatHint(`Valid keys: ${validKeys.join(', ')}`)
          );
          process.exit(2);
        }

        // Parse value based on type
        const typedKey = key as keyof CLIConfig;
        let parsedValue: CLIConfig[keyof CLIConfig];

        const schemaType = configSchema[typedKey]?.type;
        const defaultValue = defaultConfig[typedKey];
        if (schemaType === 'boolean' || typeof defaultValue === 'boolean') {
          parsedValue = value === 'true' || value === '1';
        } else if (schemaType === 'number' || typeof defaultValue === 'number') {
          parsedValue = parseInt(value, 10);
          if (isNaN(parsedValue as number)) {
            output(
              formatter,
              formatter.formatError(`Invalid number value: ${value}`)
            );
            process.exit(2);
          }
        } else {
          parsedValue = value;
        }

        setConfig(typedKey, parsedValue);

        if (globalOptions.json) {
          output(formatter, { key, value: parsedValue });
          return;
        }

        output(
          formatter,
          formatter.formatSuccess(`Configuration updated: ${key} = ${parsedValue}`)
        );
      }
    );

  // Reset configuration
  config
    .command('reset')
    .description('Reset configuration to defaults')
    .option('-f, --force', 'Skip confirmation')
    .action(async (_options: { force?: boolean }, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);

      // Note: Could add confirmation prompt here

      // Reset by setting all to defaults
      for (const [key, value] of Object.entries(defaultConfig)) {
        setConfig(key as keyof CLIConfig, value);
      }

      if (globalOptions.json) {
        output(formatter, { reset: true, config: defaultConfig });
        return;
      }

      output(
        formatter,
        formatter.formatSuccess('Configuration reset to defaults.')
      );
    });
}
