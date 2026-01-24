/**
 * MikroORM User Prompt Repository
 */

import type { SqlEntityManager } from '@mikro-orm/knex';
import type {
  IUserPromptRepository,
  CreateUserPromptInput,
  UserPromptRecord,
} from '@claude-mem/types';
import { UserPrompt } from '../../entities/UserPrompt.js';

/**
 * Convert UserPrompt entity to UserPromptRecord
 */
function toRecord(entity: UserPrompt): UserPromptRecord {
  return {
    id: entity.id,
    content_session_id: entity.content_session_id,
    prompt_number: entity.prompt_number,
    prompt_text: entity.prompt_text,
    created_at: entity.created_at,
    created_at_epoch: entity.created_at_epoch,
    is_urgent: entity.is_urgent,
  };
}

export class MikroOrmUserPromptRepository implements IUserPromptRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async create(input: CreateUserPromptInput): Promise<UserPromptRecord> {
    const now = new Date();

    // Check if exists for upsert behavior
    const existing = await this.em.findOne(UserPrompt, {
      content_session_id: input.contentSessionId,
      prompt_number: input.promptNumber,
    });

    if (existing) {
      // Update existing
      existing.prompt_text = input.promptText;
      existing.created_at = now.toISOString();
      existing.created_at_epoch = now.getTime();
      if (input.isUrgent !== undefined) {
        existing.is_urgent = input.isUrgent;
      }
      await this.em.flush();
      return toRecord(existing);
    }

    // Create new
    const entity = this.em.create(UserPrompt, {
      content_session_id: input.contentSessionId,
      prompt_number: input.promptNumber,
      prompt_text: input.promptText,
      created_at: now.toISOString(),
      created_at_epoch: now.getTime(),
      is_urgent: input.isUrgent ?? false,
    });

    this.em.persist(entity);
    await this.em.flush();
    return toRecord(entity);
  }

  async getBySessionId(contentSessionId: string): Promise<UserPromptRecord[]> {
    const entities = await this.em.find(
      UserPrompt,
      { content_session_id: contentSessionId },
      { orderBy: { prompt_number: 'ASC' } }
    );
    return entities.map(toRecord);
  }

  async getLatestForSession(contentSessionId: string): Promise<UserPromptRecord | null> {
    const entity = await this.em.findOne(
      UserPrompt,
      { content_session_id: contentSessionId },
      { orderBy: { prompt_number: 'DESC' } }
    );
    return entity ? toRecord(entity) : null;
  }

  async getFirstForSession(contentSessionId: string): Promise<UserPromptRecord | null> {
    const entity = await this.em.findOne(
      UserPrompt,
      { content_session_id: contentSessionId },
      { orderBy: { prompt_number: 'ASC' } }
    );
    return entity ? toRecord(entity) : null;
  }

  async getFirstPromptsForSessions(contentSessionIds: string[]): Promise<Map<string, string>> {
    if (contentSessionIds.length === 0) return new Map();

    const entities = await this.em.find(
      UserPrompt,
      {
        content_session_id: { $in: contentSessionIds },
        prompt_number: 1,
      }
    );

    const result = new Map<string, string>();
    for (const entity of entities) {
      result.set(entity.content_session_id, entity.prompt_text);
    }
    return result;
  }

  async countForSession(contentSessionId: string): Promise<number> {
    return this.em.count(UserPrompt, { content_session_id: contentSessionId });
  }
}
