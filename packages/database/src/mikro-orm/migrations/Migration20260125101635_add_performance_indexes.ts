import { Migration } from '@mikro-orm/migrations';

export class Migration20260125101635_add_performance_indexes extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create index \`observations_working_directory_index\` on \`observations\` (\`working_directory\`);`);
    this.addSql(`create index \`observations_project_created_at_epoch_index\` on \`observations\` (\`project\`, \`created_at_epoch\`);`);

    this.addSql(`create index \`documents_project_source_index\` on \`documents\` (\`project\`, \`source\`);`);

    this.addSql(`create index \`sessions_project_started_at_epoch_index\` on \`sessions\` (\`project\`, \`started_at_epoch\`);`);

    this.addSql(`create index \`tasks_required_capability_status_priority_index\` on \`tasks\` (\`required_capability\`, \`status\`, \`priority\`);`);
    this.addSql(`create index \`tasks_assigned_worker_id_status_index\` on \`tasks\` (\`assigned_worker_id\`, \`status\`);`);
  }

}
