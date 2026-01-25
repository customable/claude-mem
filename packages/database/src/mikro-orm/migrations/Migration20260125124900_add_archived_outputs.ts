import { Migration } from '@mikro-orm/migrations';

/**
 * Migration: Add archived_outputs table for Endless Mode (Issue #109)
 *
 * Stores full tool outputs for later recall while compressed
 * observations are used in the context window.
 */
export class Migration20260125124900_add_archived_outputs extends Migration {

  override async up(): Promise<void> {
    this.addSql(`
      create table \`archived_outputs\` (
        \`id\` integer not null primary key autoincrement,
        \`memory_session_id\` text not null,
        \`project\` text not null,
        \`tool_name\` text not null,
        \`tool_input\` text not null,
        \`tool_output\` text not null,
        \`compressed_observation_id\` integer null,
        \`compression_status\` text not null default 'pending',
        \`token_count\` integer null,
        \`compressed_token_count\` integer null,
        \`error_message\` text null,
        \`created_at\` text not null,
        \`created_at_epoch\` integer not null,
        \`compressed_at\` text null,
        \`compressed_at_epoch\` integer null
      );
    `);

    // Indexes for common queries
    this.addSql(`create index \`archived_outputs_memory_session_id_index\` on \`archived_outputs\` (\`memory_session_id\`);`);
    this.addSql(`create index \`archived_outputs_project_index\` on \`archived_outputs\` (\`project\`);`);
    this.addSql(`create index \`archived_outputs_compression_status_index\` on \`archived_outputs\` (\`compression_status\`);`);
    this.addSql(`create index \`archived_outputs_compressed_observation_id_index\` on \`archived_outputs\` (\`compressed_observation_id\`);`);
    this.addSql(`create index \`archived_outputs_created_at_epoch_index\` on \`archived_outputs\` (\`created_at_epoch\`);`);
    this.addSql(`create index \`archived_outputs_project_created_at_epoch_index\` on \`archived_outputs\` (\`project\`, \`created_at_epoch\`);`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists \`archived_outputs\`;`);
  }

}
