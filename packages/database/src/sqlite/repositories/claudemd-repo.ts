/**
 * SQLite CLAUDE.md Repository
 *
 * Stores generated CLAUDE.md content per project.
 */

import type { Database, SQLQueryBindings } from 'bun:sqlite';

type BindingValue = SQLQueryBindings;

/**
 * CLAUDE.md record from database
 */
export interface ClaudeMdRecord {
  id: number;
  project: string;
  content: string;
  content_session_id: string;
  memory_session_id: string | null;
  working_directory: string | null;
  generated_at: number;
  tokens: number;
}

/**
 * Input for creating/updating CLAUDE.md records
 */
export interface UpsertClaudeMdInput {
  project: string;
  content: string;
  contentSessionId: string;
  memorySessionId?: string;
  workingDirectory?: string;
  tokens?: number;
}

/**
 * SQLite implementation of CLAUDE.md Repository
 */
export class SQLiteClaudeMdRepository {
  constructor(private db: Database) {}

  /**
   * Insert or update CLAUDE.md content for a project/session
   */
  async upsert(input: UpsertClaudeMdInput): Promise<ClaudeMdRecord> {
    const now = Date.now();

    // Try to insert, on conflict update
    this.db
      .query<void, BindingValue[]>(`
        INSERT INTO project_claudemd (
          project, content, content_session_id, memory_session_id,
          working_directory, generated_at, tokens
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project, content_session_id) DO UPDATE SET
          content = excluded.content,
          memory_session_id = excluded.memory_session_id,
          working_directory = excluded.working_directory,
          generated_at = excluded.generated_at,
          tokens = excluded.tokens
      `)
      .run(
        input.project,
        input.content,
        input.contentSessionId,
        input.memorySessionId || null,
        input.workingDirectory || null,
        now,
        input.tokens || 0
      );

    return (await this.getByProject(input.project))!;
  }

  /**
   * Get latest CLAUDE.md content for a project
   */
  async getByProject(project: string): Promise<ClaudeMdRecord | null> {
    return (
      this.db
        .query<ClaudeMdRecord, [string]>(
          `
        SELECT * FROM project_claudemd
        WHERE project = ?
        ORDER BY generated_at DESC
        LIMIT 1
      `
        )
        .get(project) || null
    );
  }

  /**
   * Get CLAUDE.md content by project and session
   */
  async getByProjectAndSession(
    project: string,
    contentSessionId: string
  ): Promise<ClaudeMdRecord | null> {
    return (
      this.db
        .query<ClaudeMdRecord, [string, string]>(
          `
        SELECT * FROM project_claudemd
        WHERE project = ? AND content_session_id = ?
      `
        )
        .get(project, contentSessionId) || null
    );
  }

  /**
   * List all CLAUDE.md records for a project
   */
  async listByProject(project: string, limit = 10): Promise<ClaudeMdRecord[]> {
    return this.db
      .query<ClaudeMdRecord, [string, number]>(
        `
        SELECT * FROM project_claudemd
        WHERE project = ?
        ORDER BY generated_at DESC
        LIMIT ?
      `
      )
      .all(project, limit);
  }

  /**
   * Delete CLAUDE.md record by ID
   */
  async delete(id: number): Promise<boolean> {
    const result = this.db
      .query('DELETE FROM project_claudemd WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  /**
   * Delete all CLAUDE.md records for a project
   */
  async deleteByProject(project: string): Promise<number> {
    const result = this.db
      .query('DELETE FROM project_claudemd WHERE project = ?')
      .run(project);
    return result.changes;
  }

  /**
   * Get all distinct projects with CLAUDE.md content
   */
  async getDistinctProjects(): Promise<string[]> {
    const results = this.db
      .query<{ project: string }, []>(
        'SELECT DISTINCT project FROM project_claudemd ORDER BY project'
      )
      .all();
    return results.map((r) => r.project);
  }
}
