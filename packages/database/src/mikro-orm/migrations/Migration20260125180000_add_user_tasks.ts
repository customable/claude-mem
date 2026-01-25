import { Migration } from '@mikro-orm/migrations';

/**
 * Migration: Add user_tasks table for CLI task tracking (Issue #260)
 *
 * Tracks user-facing tasks from CLI tools (Claude Code TaskCreate/TaskUpdate,
 * Cursor, Aider, etc.). This is separate from the worker Task entity.
 * The WebUI is read-only - all mutations come from CLI hooks.
 */
export class Migration20260125180000_add_user_tasks extends Migration {

  override async up(): Promise<void> {
    this.addSql(`
      create table \`user_tasks\` (
        \`id\` integer not null primary key autoincrement,
        \`external_id\` text null,
        \`title\` text not null,
        \`description\` text null,
        \`active_form\` text null,
        \`status\` text not null default 'pending',
        \`priority\` text null,
        \`project\` text not null,
        \`session_id\` text null,
        \`parent_task_id\` integer null,
        \`source\` text not null default 'claude-code',
        \`source_metadata\` text null,
        \`owner\` text null,
        \`working_directory\` text null,
        \`git_branch\` text null,
        \`affected_files\` text null,
        \`blocked_by\` text null,
        \`blocks\` text null,
        \`due_at_epoch\` integer null,
        \`created_at_epoch\` integer not null,
        \`updated_at_epoch\` integer not null,
        \`completed_at_epoch\` integer null,
        \`cost_tokens\` integer null,
        \`cost_usd\` real null
      );
    `);

    // Indexes for common queries
    this.addSql(`create index \`user_tasks_external_id_index\` on \`user_tasks\` (\`external_id\`);`);
    this.addSql(`create index \`user_tasks_status_index\` on \`user_tasks\` (\`status\`);`);
    this.addSql(`create index \`user_tasks_project_index\` on \`user_tasks\` (\`project\`);`);
    this.addSql(`create index \`user_tasks_session_id_index\` on \`user_tasks\` (\`session_id\`);`);
    this.addSql(`create index \`user_tasks_parent_task_id_index\` on \`user_tasks\` (\`parent_task_id\`);`);
    this.addSql(`create index \`user_tasks_created_at_epoch_index\` on \`user_tasks\` (\`created_at_epoch\`);`);
    // Composite indexes for efficient queries
    this.addSql(`create index \`user_tasks_project_status_index\` on \`user_tasks\` (\`project\`, \`status\`);`);
    this.addSql(`create index \`user_tasks_session_id_created_at_epoch_index\` on \`user_tasks\` (\`session_id\`, \`created_at_epoch\`);`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists \`user_tasks\`;`);
  }

}
