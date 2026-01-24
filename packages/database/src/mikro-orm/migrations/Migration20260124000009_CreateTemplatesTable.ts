/**
 * Migration: Create observation_templates table
 *
 * Enables custom templates for creating observations with predefined fields.
 */

import { Migration } from '@mikro-orm/migrations';

export class Migration20260124000009_CreateTemplatesTable extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS observation_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        project TEXT,
        fields TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        is_system INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        updated_at TEXT,
        updated_at_epoch INTEGER
      );
    `);

    // Index for fast lookups
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_templates_name ON observation_templates(name);
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_templates_type ON observation_templates(type);
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_templates_project ON observation_templates(project);
    `);

    // Unique constraint for name per project (null project = global)
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_unique_name
      ON observation_templates(name, COALESCE(project, '__global__'));
    `);

    // Insert default system templates
    const now = new Date().toISOString();
    const nowEpoch = Date.now();

    this.addSql(`
      INSERT INTO observation_templates (name, description, type, fields, is_default, is_system, created_at, created_at_epoch)
      VALUES
        ('Bug Fix', 'Template for documenting bug fixes', 'bugfix',
         '${JSON.stringify({ title: '', description: '', rootCause: '', solution: '', filesModified: [] })}',
         1, 1, '${now}', ${nowEpoch}),
        ('Feature', 'Template for new feature implementations', 'feature',
         '${JSON.stringify({ title: '', description: '', acceptance: '', implementation: '', filesModified: [] })}',
         1, 1, '${now}', ${nowEpoch}),
        ('Decision', 'Template for architectural decisions', 'decision',
         '${JSON.stringify({ title: '', context: '', options: [], decision: '', rationale: '', consequences: '' })}',
         1, 1, '${now}', ${nowEpoch}),
        ('Discovery', 'Template for learning discoveries', 'discovery',
         '${JSON.stringify({ title: '', topic: '', keyInsights: [], references: [], nextSteps: [] })}',
         1, 1, '${now}', ${nowEpoch}),
        ('Note', 'Simple note template', 'note',
         '${JSON.stringify({ title: '', content: '', tags: [] })}',
         1, 1, '${now}', ${nowEpoch});
    `);
  }

  async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS observation_templates;');
  }
}
