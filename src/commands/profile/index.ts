import { Command } from 'commander';
import { getClient } from '../../sdk/index.js';
import { createFormatter, output, newline } from '../../output/index.js';
import { createSpinner } from '../../utils/index.js';
import type { GlobalOptions } from '../../types/index.js';
import type { ProfileUpdateRequest, SettingsUpdateRequest } from '@timesheet/sdk';

export function registerProfileCommands(program: Command): void {
  const profile = program
    .command('profile')
    .description('Profile and settings commands');

  // Show profile
  profile
    .command('show')
    .description('Show user profile')
    .action(async (_options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Loading profile...');

      const userProfile = await client.profile.getProfile();

      spinner.stop();

      if (globalOptions.json) {
        output(formatter, userProfile);
        return;
      }

      if (formatter.mode === 'pipe') {
        output(
          formatter,
          `${userProfile.email}\t${userProfile.firstname || ''}\t${userProfile.lastname || ''}`
        );
        return;
      }

      output(formatter, formatter.formatHeader('User Profile'));
      newline();

      const data: Record<string, string> = {};

      if (userProfile.email) {
        data['Email'] = userProfile.email;
      }

      if (userProfile.firstname || userProfile.lastname) {
        data['Name'] = `${userProfile.firstname || ''} ${userProfile.lastname || ''}`.trim();
      }

      output(formatter, formatter.formatKeyValue(data));
    });

  // Update profile
  profile
    .command('update')
    .description('Update profile fields')
    .option('-f, --firstname <name>', 'First name')
    .option('-l, --lastname <name>', 'Last name')
    .option('-e, --email <email>', 'Email')
    .option('--image-url <url>', 'Image URL')
    .option('--newsletter', 'Subscribe to newsletter')
    .option('--no-newsletter', 'Unsubscribe from newsletter')
    .action(
      async (
        options: {
          firstname?: string;
          lastname?: string;
          email?: string;
          imageUrl?: string;
          newsletter?: boolean;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: ProfileUpdateRequest = {};
        if (options.firstname !== undefined) data.firstname = options.firstname;
        if (options.lastname !== undefined) data.lastname = options.lastname;
        if (options.email !== undefined) data.email = options.email;
        if (options.imageUrl !== undefined) data.imageUrl = options.imageUrl;
        if (options.newsletter !== undefined) data.newsletter = options.newsletter;

        if (Object.keys(data).length === 0) {
          output(formatter, formatter.formatWarning('No updates specified.'));
          return;
        }

        spinner.start('Updating profile...');
        const updated = await client.profile.updateProfile(data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, updated);
          return;
        }
        output(formatter, formatter.formatSuccess('Profile updated.'));
        newline();
        const summary: Record<string, string> = {};
        if (updated.email) summary['Email'] = updated.email;
        if (updated.firstname || updated.lastname) {
          summary['Name'] = `${updated.firstname || ''} ${updated.lastname || ''}`.trim();
        }
        output(formatter, formatter.formatKeyValue(summary));
      }
    );

  // Show/update settings
  profile
    .command('settings')
    .description('Show or update settings')
    .action(async (_options: object, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalOptions>();
      const formatter = createFormatter(globalOptions);
      const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
      const client = await getClient(globalOptions);

      spinner.start('Loading settings...');

      const settings = await client.settings.get();

      spinner.stop();

      if (globalOptions.json) {
        output(formatter, settings);
        return;
      }

      output(formatter, formatter.formatHeader('Settings'));
      newline();

      const data: Record<string, string> = {};

      if (settings.theme) {
        data['Theme'] = settings.theme;
      }

      if (settings.timezone) {
        data['Timezone'] = settings.timezone;
      }

      if (settings.language) {
        data['Language'] = settings.language;
      }

      if (settings.currency) {
        data['Currency'] = settings.currency;
      }

      if (settings.dateFormat) {
        data['Date Format'] = settings.dateFormat;
      }

      if (settings.timeFormat) {
        data['Time Format'] = settings.timeFormat;
      }

      if (settings.firstDay !== undefined) {
        const days = [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ];
        data['Week Starts'] = days[settings.firstDay] || 'Monday';
      }

      output(formatter, formatter.formatKeyValue(data));
    });

  // Update settings
  profile
    .command('settings-update')
    .description('Update user settings')
    .option('--theme <theme>', 'Theme (light, dark, system)')
    .option('--language <code>', 'Language code (e.g. en, de)')
    .option('--timezone <tz>', 'Timezone (e.g. Europe/Berlin)')
    .option('--currency <code>', 'Currency code')
    .option('--date-format <fmt>', 'Date format')
    .option('--time-format <fmt>', 'Time format')
    .option('--duration-format <fmt>', 'Duration format')
    .option('--first-day <day>', 'First day of week (0=Sunday)')
    .option('--default-task-duration <minutes>', 'Default task duration (minutes)')
    .option('--default-break-duration <minutes>', 'Default break duration (minutes)')
    .action(
      async (
        options: {
          theme?: string;
          language?: string;
          timezone?: string;
          currency?: string;
          dateFormat?: string;
          timeFormat?: string;
          durationFormat?: string;
          firstDay?: string;
          defaultTaskDuration?: string;
          defaultBreakDuration?: string;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);

        const data: SettingsUpdateRequest = {};
        if (options.theme === 'light' || options.theme === 'dark' || options.theme === 'system') {
          data.theme = options.theme;
        }
        if (options.language) data.language = options.language;
        if (options.timezone) data.timezone = options.timezone;
        if (options.currency) data.currency = options.currency;
        if (options.dateFormat) data.dateFormat = options.dateFormat;
        if (options.timeFormat) data.timeFormat = options.timeFormat;
        if (options.durationFormat) data.durationFormat = options.durationFormat;
        if (options.firstDay) data.firstDay = parseInt(options.firstDay, 10);
        if (options.defaultTaskDuration) {
          data.defaultTaskDuration = parseInt(options.defaultTaskDuration, 10);
        }
        if (options.defaultBreakDuration) {
          data.defaultBreakDuration = parseInt(options.defaultBreakDuration, 10);
        }

        if (Object.keys(data).length === 0) {
          output(formatter, formatter.formatWarning('No updates specified.'));
          return;
        }

        spinner.start('Updating settings...');
        const updated = await client.settings.update(data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, updated);
          return;
        }
        output(formatter, formatter.formatSuccess('Settings updated.'));
      }
    );
}
