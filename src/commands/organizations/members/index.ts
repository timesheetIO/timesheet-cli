import type { Command } from 'commander';
import inquirer from 'inquirer';
import { getClient } from '../../../sdk/index.js';
import { createFormatter, output, newline } from '../../../output/index.js';
import { createSpinner } from '../../../utils/index.js';
import { getConfig } from '../../../config/index.js';
import { resolveOrganizationId } from '../../_shared/organization.js';
import type { GlobalOptions, ColumnDef } from '../../../types/index.js';
import type {
  OrganizationMember,
  OrganizationMemberCreateRequest,
  OrganizationMemberListParams,
  OrganizationMemberUpdateRequest,
} from '@timesheet/sdk';

function permissionToString(p: OrganizationMember['permission']): string {
  if (!p) return '-';
  const flags = [
    p.admin ? 'admin' : null,
    p.invoicing ? 'invoicing' : null,
    p.billing ? 'billing' : null,
  ].filter(Boolean);
  return flags.length ? flags.join(',') : '-';
}

export function registerOrganizationsMembersCommands(parent: Command): void {
  const members = parent
    .command('members')
    .description('Organization member management');

  members
    .command('list')
    .description('List members of an organization')
    .option('-o, --organization <id>', 'Organization ID')
    .option('--include-deleted', 'Include deleted members')
    .option('-q, --search <query>', 'Free-text search')
    .option('-l, --limit <number>', 'Limit results', '20')
    .action(
      async (
        options: {
          organization?: string;
          includeDeleted?: boolean;
          search?: string;
          limit: string;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        const limit = parseInt(options.limit, 10) || getConfig('paginationLimit');
        const params: OrganizationMemberListParams = { limit };
        if (options.includeDeleted) params.deleted = true;
        if (options.search) params.search = options.search;

        spinner.start('Loading organization members...');
        const page = await client.organizations.listMembers(organizationId, params);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, page.items);
          return;
        }

        if (page.items.length === 0) {
          output(formatter, formatter.formatInfo('No members found.'));
          return;
        }

        const columns: ColumnDef<OrganizationMember>[] = [
          { key: 'id', header: 'Member ID', width: 36 },
          {
            key: 'displayName',
            header: 'Name',
            width: 24,
            format: (v, row) =>
              (v as string) ||
              `${row.firstname || ''} ${row.lastname || ''}`.trim() ||
              '-',
          },
          { key: 'email', header: 'Email', width: 30 },
          {
            key: 'permission',
            header: 'Roles',
            width: 24,
            format: (v) => permissionToString(v as OrganizationMember['permission']),
          },
          {
            key: 'hasActiveContract',
            header: 'Contract',
            width: 10,
            format: (v) => (v ? 'active' : 'none'),
          },
        ];

        output(formatter, formatter.formatTable(page.items, columns));
        newline();
        output(formatter, formatter.formatHint(`Showing ${page.items.length} members.`));
      }
    );

  members
    .command('show')
    .description('Show organization member details')
    .argument('<member-id>', 'Organization member (permission) ID')
    .option('-o, --organization <id>', 'Organization ID')
    .action(
      async (
        memberId: string,
        options: { organization?: string },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        spinner.start('Loading member...');
        const member = await client.organizations.getMember(organizationId, memberId);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, member);
          return;
        }

        const data: Record<string, string> = {
          ID: member.id,
          Email: member.email,
          Roles: permissionToString(member.permission),
        };
        if (member.displayName) data['Name'] = member.displayName;
        if (member.hasActiveContract !== undefined) {
          data['Active Contract'] = member.hasActiveContract ? 'Yes' : 'No';
        }
        if (member.teamAssignments?.length) {
          data['Teams'] = member.teamAssignments
            .map((t) => t.teamName || t.teamId || '')
            .filter(Boolean)
            .join(', ');
        }

        output(formatter, formatter.formatHeader('Organization Member'));
        newline();
        output(formatter, formatter.formatKeyValue(data));
      }
    );

  members
    .command('add')
    .description('Add (invite) a member to an organization')
    .requiredOption('-e, --email <email>', 'Member email')
    .option('-o, --organization <id>', 'Organization ID')
    .option('-f, --firstname <name>', 'First name')
    .option('-l, --lastname <name>', 'Last name')
    .option('--admin', 'Grant admin permission')
    .option('--invoicing', 'Grant invoicing permission')
    .option('--billing', 'Grant billing permission')
    .action(
      async (
        options: {
          organization?: string;
          email: string;
          firstname?: string;
          lastname?: string;
          admin?: boolean;
          invoicing?: boolean;
          billing?: boolean;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        const data: OrganizationMemberCreateRequest = {
          email: options.email,
          firstname: options.firstname,
          lastname: options.lastname,
          admin: options.admin,
          invoicing: options.invoicing,
          billing: options.billing,
        };

        spinner.start('Adding organization member...');
        const member = await client.organizations.addMember(organizationId, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, member);
          return;
        }
        output(formatter, formatter.formatSuccess('Organization member added!'));
        newline();
        output(
          formatter,
          formatter.formatKeyValue({
            ID: member.id,
            Email: member.email,
            Roles: permissionToString(member.permission),
          })
        );
      }
    );

  members
    .command('update')
    .description("Update an organization member's permissions")
    .argument('<member-id>', 'Organization member (permission) ID')
    .option('-o, --organization <id>', 'Organization ID')
    .option('--admin', 'Grant admin')
    .option('--no-admin', 'Revoke admin')
    .option('--invoicing', 'Grant invoicing')
    .option('--no-invoicing', 'Revoke invoicing')
    .option('--billing', 'Grant billing')
    .option('--no-billing', 'Revoke billing')
    .action(
      async (
        memberId: string,
        options: {
          organization?: string;
          admin?: boolean;
          invoicing?: boolean;
          billing?: boolean;
        },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        const data: OrganizationMemberUpdateRequest = {};
        if (options.admin !== undefined) data.admin = options.admin;
        if (options.invoicing !== undefined) data.invoicing = options.invoicing;
        if (options.billing !== undefined) data.billing = options.billing;

        if (Object.keys(data).length === 0) {
          output(formatter, formatter.formatWarning('No updates specified.'));
          return;
        }

        spinner.start('Updating member...');
        const member = await client.organizations.updateMember(organizationId, memberId, data);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, member);
          return;
        }
        output(formatter, formatter.formatSuccess('Member updated.'));
        newline();
        output(
          formatter,
          formatter.formatKeyValue({
            ID: member.id,
            Email: member.email,
            Roles: permissionToString(member.permission),
          })
        );
      }
    );

  members
    .command('remove')
    .description('Remove a member from an organization')
    .argument('<member-id>', 'Organization member (permission) ID')
    .option('-o, --organization <id>', 'Organization ID')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(
      async (
        memberId: string,
        options: { organization?: string; force?: boolean },
        command: Command
      ) => {
        const globalOptions = command.optsWithGlobals<GlobalOptions>();
        const formatter = createFormatter(globalOptions);
        const spinner = createSpinner(!globalOptions.quiet && !globalOptions.json);
        const client = await getClient(globalOptions);
        const organizationId = resolveOrganizationId(options.organization);

        if (
          !options.force &&
          getConfig('confirmDeletes') &&
          process.stdout.isTTY &&
          !globalOptions.json
        ) {
          const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Remove member ${memberId} from organization?`,
              default: false,
            },
          ]);
          if (!confirm) {
            output(formatter, formatter.formatInfo('Cancelled.'));
            return;
          }
        }

        spinner.start('Removing member...');
        await client.organizations.removeMember(organizationId, memberId);
        spinner.stop();

        if (globalOptions.json) {
          output(formatter, { removed: true, memberId });
          return;
        }
        output(formatter, formatter.formatSuccess('Organization member removed.'));
      }
    );
}
