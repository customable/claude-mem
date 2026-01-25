import { Migration } from '@mikro-orm/migrations';

export class Migration20260125094906_initial_schema extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`achievements\` (\`id\` integer not null primary key autoincrement, \`achievement_id\` text not null, \`unlocked_at_epoch\` integer null, \`progress\` real not null default 0, \`metadata\` text null);`);
    this.addSql(`create unique index \`achievements_achievement_id_unique\` on \`achievements\` (\`achievement_id\`);`);
    this.addSql(`create index \`achievements_unlocked_at_epoch_index\` on \`achievements\` (\`unlocked_at_epoch\`);`);

    this.addSql(`create table \`claudemd\` (\`id\` integer not null primary key autoincrement, \`project\` text not null, \`content\` text not null, \`content_session_id\` text not null, \`memory_session_id\` text null, \`working_directory\` text null, \`generated_at\` integer not null, \`tokens\` integer not null default 0);`);
    this.addSql(`create index \`claudemd_project_index\` on \`claudemd\` (\`project\`);`);
    this.addSql(`create index \`claudemd_generated_at_index\` on \`claudemd\` (\`generated_at\`);`);
    this.addSql(`create unique index \`claudemd_project_content_session_id_unique\` on \`claudemd\` (\`project\`, \`content_session_id\`);`);

    this.addSql(`create table \`code_snippets\` (\`id\` integer not null primary key autoincrement, \`observation_id\` integer not null, \`memory_session_id\` text not null, \`project\` text not null, \`language\` text null, \`code\` text not null, \`file_path\` text null, \`line_start\` integer null, \`line_end\` integer null, \`context\` text null, \`created_at_epoch\` integer not null);`);
    this.addSql(`create index \`code_snippets_observation_id_index\` on \`code_snippets\` (\`observation_id\`);`);
    this.addSql(`create index \`code_snippets_memory_session_id_index\` on \`code_snippets\` (\`memory_session_id\`);`);
    this.addSql(`create index \`code_snippets_project_index\` on \`code_snippets\` (\`project\`);`);
    this.addSql(`create index \`code_snippets_language_index\` on \`code_snippets\` (\`language\`);`);
    this.addSql(`create index \`code_snippets_file_path_index\` on \`code_snippets\` (\`file_path\`);`);

    this.addSql(`create table \`daily_stats\` (\`id\` integer not null primary key autoincrement, \`date\` text not null, \`observation_count\` integer not null default 0, \`session_count\` integer not null default 0, \`project_count\` integer not null default 0, \`decision_count\` integer not null default 0, \`error_count\` integer not null default 0, \`bug_fix_count\` integer not null default 0, \`discovery_count\` integer not null default 0, \`tokens_used\` integer not null default 0, \`technologies\` text null, \`projects\` text null, \`created_at_epoch\` integer not null);`);
    this.addSql(`create index \`daily_stats_date_index\` on \`daily_stats\` (\`date\`);`);

    this.addSql(`create table \`documents\` (\`id\` integer not null primary key autoincrement, \`project\` text not null, \`source\` text not null, \`source_tool\` text not null, \`title\` text null, \`content\` text not null, \`content_hash\` text not null, \`type\` text not null default 'library-docs', \`metadata\` text null, \`memory_session_id\` text null, \`observation_id\` integer null, \`access_count\` integer not null default 1, \`last_accessed_epoch\` integer not null, \`created_at\` text not null, \`created_at_epoch\` integer not null);`);
    this.addSql(`create index \`documents_project_index\` on \`documents\` (\`project\`);`);
    this.addSql(`create index \`documents_source_index\` on \`documents\` (\`source\`);`);
    this.addSql(`create index \`documents_source_tool_index\` on \`documents\` (\`source_tool\`);`);
    this.addSql(`create index \`documents_content_hash_index\` on \`documents\` (\`content_hash\`);`);
    this.addSql(`create unique index \`documents_content_hash_unique\` on \`documents\` (\`content_hash\`);`);
    this.addSql(`create index \`documents_type_index\` on \`documents\` (\`type\`);`);
    this.addSql(`create index \`documents_last_accessed_epoch_index\` on \`documents\` (\`last_accessed_epoch\`);`);
    this.addSql(`create index \`documents_created_at_epoch_index\` on \`documents\` (\`created_at_epoch\`);`);

    this.addSql(`create table \`observations\` (\`id\` integer not null primary key autoincrement, \`memory_session_id\` text not null, \`project\` text not null, \`text\` text null, \`type\` text not null default 'discovery', \`title\` text null, \`subtitle\` text null, \`narrative\` text null, \`concept\` text null, \`concepts\` text null, \`facts\` text null, \`source_files\` text null, \`files_read\` text null, \`files_modified\` text null, \`git_branch\` text null, \`working_directory\` text null, \`repo_path\` text null, \`prompt_number\` integer null, \`discovery_tokens\` integer null, \`created_at\` text not null, \`created_at_epoch\` integer not null, \`decision_category\` text null, \`superseded_by\` integer null, \`supersedes\` integer null, \`superseded_at\` text null, \`memory_tier\` text null default 'working', \`tier_changed_at\` text null, \`access_count\` integer null default 0, \`last_accessed_at\` text null, \`last_accessed_at_epoch\` integer null, \`consolidation_score\` integer null, \`pinned\` integer null default false, \`importance_boost\` integer null default 0);`);
    this.addSql(`create index \`observations_memory_session_id_index\` on \`observations\` (\`memory_session_id\`);`);
    this.addSql(`create index \`observations_project_index\` on \`observations\` (\`project\`);`);
    this.addSql(`create index \`observations_type_index\` on \`observations\` (\`type\`);`);
    this.addSql(`create index \`observations_repo_path_index\` on \`observations\` (\`repo_path\`);`);
    this.addSql(`create index \`observations_created_at_epoch_index\` on \`observations\` (\`created_at_epoch\`);`);
    this.addSql(`create index \`observations_memory_tier_index\` on \`observations\` (\`memory_tier\`);`);
    this.addSql(`create index \`observations_last_accessed_at_epoch_index\` on \`observations\` (\`last_accessed_at_epoch\`);`);
    this.addSql(`create index \`observations_pinned_index\` on \`observations\` (\`pinned\`);`);

    this.addSql(`create table \`observation_links\` (\`id\` integer not null primary key autoincrement, \`source_id\` integer not null, \`target_id\` integer not null, \`link_type\` text not null default 'related', \`description\` text null, \`created_at\` text not null, \`created_at_epoch\` integer not null);`);
    this.addSql(`create index \`observation_links_source_id_index\` on \`observation_links\` (\`source_id\`);`);
    this.addSql(`create index \`observation_links_target_id_index\` on \`observation_links\` (\`target_id\`);`);
    this.addSql(`create index \`observation_links_link_type_index\` on \`observation_links\` (\`link_type\`);`);

    this.addSql(`create table \`observation_templates\` (\`id\` integer not null primary key autoincrement, \`name\` text not null, \`description\` text null, \`type\` text not null, \`project\` text null, \`fields\` text not null, \`is_default\` integer not null default false, \`is_system\` integer not null default false, \`created_at\` text not null, \`created_at_epoch\` integer not null, \`updated_at\` text null, \`updated_at_epoch\` integer null);`);
    this.addSql(`create index \`observation_templates_name_index\` on \`observation_templates\` (\`name\`);`);
    this.addSql(`create index \`observation_templates_type_index\` on \`observation_templates\` (\`type\`);`);
    this.addSql(`create index \`observation_templates_project_index\` on \`observation_templates\` (\`project\`);`);

    this.addSql(`create table \`project_settings\` (\`id\` integer not null primary key autoincrement, \`project\` text not null, \`display_name\` text null, \`description\` text null, \`settings\` text not null default '{}', \`metadata\` text not null default '{}', \`observation_count\` integer not null default 0, \`session_count\` integer not null default 0, \`last_activity_epoch\` integer null, \`created_at\` text not null, \`created_at_epoch\` integer not null, \`updated_at\` text null, \`updated_at_epoch\` integer null);`);
    this.addSql(`create index \`project_settings_project_index\` on \`project_settings\` (\`project\`);`);
    this.addSql(`create unique index \`project_settings_project_unique\` on \`project_settings\` (\`project\`);`);
    this.addSql(`create index \`project_settings_last_activity_epoch_index\` on \`project_settings\` (\`last_activity_epoch\`);`);

    this.addSql(`create table \`raw_messages\` (\`id\` integer not null primary key autoincrement, \`session_id\` text not null, \`project\` text not null, \`prompt_number\` integer null, \`role\` text not null, \`content\` text not null, \`tool_calls\` text null, \`tool_name\` text null, \`tool_input\` text null, \`tool_output\` text null, \`processed\` integer not null default false, \`processed_at\` text null, \`processed_at_epoch\` integer null, \`observation_id\` integer null, \`created_at\` text not null, \`created_at_epoch\` integer not null);`);
    this.addSql(`create index \`raw_messages_session_id_index\` on \`raw_messages\` (\`session_id\`);`);
    this.addSql(`create index \`raw_messages_project_index\` on \`raw_messages\` (\`project\`);`);
    this.addSql(`create index \`raw_messages_processed_index\` on \`raw_messages\` (\`processed\`);`);
    this.addSql(`create index \`raw_messages_created_at_epoch_index\` on \`raw_messages\` (\`created_at_epoch\`);`);

    this.addSql(`create table \`sessions\` (\`id\` integer not null primary key autoincrement, \`content_session_id\` text not null, \`memory_session_id\` text null, \`project\` text not null, \`user_prompt\` text null, \`working_directory\` text null, \`repo_path\` text null, \`is_worktree\` integer null default false, \`branch\` text null, \`started_at\` text not null, \`started_at_epoch\` integer not null, \`completed_at\` text null, \`completed_at_epoch\` integer null, \`status\` text not null default 'active', \`worker_port\` integer null, \`prompt_counter\` integer not null default 0);`);
    this.addSql(`create unique index \`sessions_content_session_id_unique\` on \`sessions\` (\`content_session_id\`);`);
    this.addSql(`create index \`sessions_memory_session_id_index\` on \`sessions\` (\`memory_session_id\`);`);
    this.addSql(`create index \`sessions_project_index\` on \`sessions\` (\`project\`);`);
    this.addSql(`create index \`sessions_repo_path_index\` on \`sessions\` (\`repo_path\`);`);
    this.addSql(`create index \`sessions_started_at_epoch_index\` on \`sessions\` (\`started_at_epoch\`);`);
    this.addSql(`create index \`sessions_status_index\` on \`sessions\` (\`status\`);`);

    this.addSql(`create table \`summaries\` (\`id\` integer not null primary key autoincrement, \`memory_session_id\` text not null, \`project\` text not null, \`request\` text null, \`investigated\` text null, \`learned\` text null, \`completed\` text null, \`next_steps\` text null, \`prompt_number\` integer null, \`discovery_tokens\` integer null, \`created_at\` text not null, \`created_at_epoch\` integer not null);`);
    this.addSql(`create index \`summaries_memory_session_id_index\` on \`summaries\` (\`memory_session_id\`);`);
    this.addSql(`create index \`summaries_project_index\` on \`summaries\` (\`project\`);`);
    this.addSql(`create index \`summaries_created_at_epoch_index\` on \`summaries\` (\`created_at_epoch\`);`);

    this.addSql(`create table \`tasks\` (\`id\` text not null, \`type\` text not null, \`status\` text not null default 'pending', \`required_capability\` text not null, \`fallback_capabilities\` text null, \`priority\` integer not null default 0, \`payload\` text not null, \`result\` text null, \`error\` text null, \`retry_count\` integer not null default 0, \`max_retries\` integer not null default 3, \`assigned_worker_id\` text null, \`created_at\` integer not null, \`assigned_at\` integer null, \`completed_at\` integer null, \`retry_after\` integer null, primary key (\`id\`));`);
    this.addSql(`create index \`tasks_type_index\` on \`tasks\` (\`type\`);`);
    this.addSql(`create index \`tasks_status_index\` on \`tasks\` (\`status\`);`);
    this.addSql(`create index \`tasks_required_capability_index\` on \`tasks\` (\`required_capability\`);`);
    this.addSql(`create index \`tasks_assigned_worker_id_index\` on \`tasks\` (\`assigned_worker_id\`);`);
    this.addSql(`create index \`tasks_retry_after_index\` on \`tasks\` (\`retry_after\`);`);

    this.addSql(`create table \`technology_usage\` (\`id\` integer not null primary key autoincrement, \`name\` text not null, \`category\` text null, \`first_seen_epoch\` integer not null, \`last_used_epoch\` integer not null, \`observation_count\` integer not null default 0, \`project\` text null);`);
    this.addSql(`create index \`technology_usage_name_index\` on \`technology_usage\` (\`name\`);`);
    this.addSql(`create index \`technology_usage_observation_count_index\` on \`technology_usage\` (\`observation_count\`);`);
    this.addSql(`create index \`technology_usage_project_index\` on \`technology_usage\` (\`project\`);`);
    this.addSql(`create unique index \`technology_usage_name_project_unique\` on \`technology_usage\` (\`name\`, \`project\`);`);

    this.addSql(`create table \`prompts\` (\`id\` integer not null primary key autoincrement, \`content_session_id\` text not null, \`prompt_number\` integer not null, \`prompt_text\` text not null, \`created_at\` text not null, \`created_at_epoch\` integer not null, \`is_urgent\` integer not null default false);`);
    this.addSql(`create index \`prompts_content_session_id_index\` on \`prompts\` (\`content_session_id\`);`);
    this.addSql(`create index \`prompts_created_at_epoch_index\` on \`prompts\` (\`created_at_epoch\`);`);
    this.addSql(`create index \`prompts_is_urgent_index\` on \`prompts\` (\`is_urgent\`);`);
    this.addSql(`create unique index \`prompts_content_session_id_prompt_number_unique\` on \`prompts\` (\`content_session_id\`, \`prompt_number\`);`);
  }

}
