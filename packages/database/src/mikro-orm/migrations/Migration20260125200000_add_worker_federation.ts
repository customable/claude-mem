import { Migration } from '@mikro-orm/migrations';

/**
 * Migration: Add worker federation tables (Issue #263)
 *
 * Creates tables for:
 * - worker_tokens: Token-based worker authentication
 * - worker_registrations: Track worker instances using tokens
 * - hubs: Registry of worker hubs (built-in and external)
 */
export class Migration20260125200000_add_worker_federation extends Migration {

  override async up(): Promise<void> {
    // Worker tokens table
    this.addSql(`
      create table \`worker_tokens\` (
        \`id\` text not null primary key,
        \`name\` text not null,
        \`token_hash\` text not null,
        \`token_prefix\` text not null,
        \`scope\` text not null default 'instance',
        \`hub_id\` text null,
        \`project_filter\` text null,
        \`capabilities\` text null,
        \`labels\` text null,
        \`created_at\` text not null,
        \`expires_at\` text null,
        \`last_used_at\` text null,
        \`revoked_at\` text null
      );
    `);

    this.addSql(`create index \`worker_tokens_name_index\` on \`worker_tokens\` (\`name\`);`);
    this.addSql(`create index \`worker_tokens_scope_index\` on \`worker_tokens\` (\`scope\`);`);
    this.addSql(`create index \`worker_tokens_hub_id_index\` on \`worker_tokens\` (\`hub_id\`);`);
    this.addSql(`create index \`worker_tokens_revoked_at_index\` on \`worker_tokens\` (\`revoked_at\`);`);

    // Worker registrations table
    this.addSql(`
      create table \`worker_registrations\` (
        \`id\` text not null primary key,
        \`token_id\` text not null,
        \`system_id\` text not null,
        \`hostname\` text null,
        \`worker_id\` text null,
        \`labels\` text null,
        \`capabilities\` text null,
        \`metadata\` text null,
        \`status\` text not null default 'offline',
        \`connected_at\` text not null,
        \`disconnected_at\` text null,
        \`last_heartbeat\` text null,
        constraint \`worker_registrations_token_id_foreign\` foreign key (\`token_id\`) references \`worker_tokens\` (\`id\`) on update cascade on delete cascade
      );
    `);

    this.addSql(`create index \`worker_registrations_system_id_index\` on \`worker_registrations\` (\`system_id\`);`);
    this.addSql(`create index \`worker_registrations_status_index\` on \`worker_registrations\` (\`status\`);`);
    this.addSql(`create index \`worker_registrations_token_id_status_index\` on \`worker_registrations\` (\`token_id\`, \`status\`);`);

    // Hubs table
    this.addSql(`
      create table \`hubs\` (
        \`id\` text not null primary key,
        \`name\` text not null,
        \`type\` text not null default 'builtin',
        \`endpoint\` text null,
        \`priority\` integer not null default 50,
        \`weight\` integer not null default 100,
        \`region\` text null,
        \`labels\` text null,
        \`capabilities\` text null,
        \`status\` text not null default 'healthy',
        \`connected_workers\` integer not null default 0,
        \`active_workers\` integer not null default 0,
        \`avg_latency_ms\` integer null,
        \`created_at\` text not null,
        \`last_heartbeat\` text null
      );
    `);

    this.addSql(`create index \`hubs_name_index\` on \`hubs\` (\`name\`);`);
    this.addSql(`create index \`hubs_type_index\` on \`hubs\` (\`type\`);`);
    this.addSql(`create index \`hubs_status_index\` on \`hubs\` (\`status\`);`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists \`worker_registrations\`;`);
    this.addSql(`drop table if exists \`worker_tokens\`;`);
    this.addSql(`drop table if exists \`hubs\`;`);
  }

}
