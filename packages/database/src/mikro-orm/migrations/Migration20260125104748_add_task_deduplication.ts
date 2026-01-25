import { Migration } from '@mikro-orm/migrations';

export class Migration20260125104748_add_task_deduplication extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table \`tasks\` add column \`deduplication_key\` text null;`);
    this.addSql(`create index \`tasks_deduplication_key_index\` on \`tasks\` (\`deduplication_key\`);`);
  }

}
