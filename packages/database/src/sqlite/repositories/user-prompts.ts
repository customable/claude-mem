/**
 * SQLite User Prompt Repository Implementation
 */

import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type {
  IUserPromptRepository,
  CreateUserPromptInput,
  UserPromptRecord,
} from '@claude-mem/types';

type BindingValue = SQLQueryBindings;

/**
 * SQLite implementation of IUserPromptRepository
 */
export class SQLiteUserPromptRepository implements IUserPromptRepository {
  constructor(private db: Database) {}

  async create(input: CreateUserPromptInput): Promise<UserPromptRecord> {
    const now = new Date();
    const epoch = now.getTime();

    const result = this.db
      .query<{ id: number }, BindingValue[]>(`
        INSERT INTO user_prompts (content_session_id, prompt_number, prompt_text, created_at, created_at_epoch)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(content_session_id, prompt_number) DO UPDATE SET
          prompt_text = excluded.prompt_text,
          created_at = excluded.created_at,
          created_at_epoch = excluded.created_at_epoch
        RETURNING id
      `)
      .get(
        input.contentSessionId,
        input.promptNumber,
        input.promptText,
        now.toISOString(),
        epoch
      );

    return this.db
      .query<UserPromptRecord, [number]>('SELECT * FROM user_prompts WHERE id = ?')
      .get(result!.id)!;
  }

  async getBySessionId(contentSessionId: string): Promise<UserPromptRecord[]> {
    return this.db
      .query<UserPromptRecord, [string]>(`
        SELECT * FROM user_prompts
        WHERE content_session_id = ?
        ORDER BY prompt_number ASC
      `)
      .all(contentSessionId);
  }

  async getLatestForSession(contentSessionId: string): Promise<UserPromptRecord | null> {
    return this.db
      .query<UserPromptRecord, [string]>(`
        SELECT * FROM user_prompts
        WHERE content_session_id = ?
        ORDER BY prompt_number DESC
        LIMIT 1
      `)
      .get(contentSessionId) || null;
  }

  async countForSession(contentSessionId: string): Promise<number> {
    const result = this.db
      .query<{ count: number }, [string]>(
        'SELECT COUNT(*) as count FROM user_prompts WHERE content_session_id = ?'
      )
      .get(contentSessionId);
    return result?.count || 0;
  }
}
