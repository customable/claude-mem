/**
 * Legacy Database Importer (Issue #198)
 *
 * Imports data from thedotmack/claude-mem to customable/claude-mem.
 */

import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { createLogger, loadSettings } from '@claude-mem/shared';
import { mikroOrm } from '@claude-mem/database';
import type { CreateSessionInput, CreateObservationInput } from '@claude-mem/types';
import { mapLegacyType } from './type-mapper.js';
import { createBackup, type BackupResult } from './backup.js';
import { analyzeLegacyDatabase, type AnalysisResult } from './analyzer.js';

const { MikroOrmDatabase } = mikroOrm;

const logger = createLogger('migrate:importer');

/**
 * Conflict resolution strategy
 */
export type ConflictStrategy = 'skip' | 'overwrite';

/**
 * Import options
 */
export interface ImportOptions {
  /** Source database path */
  sourcePath: string;
  /** Target database path (optional - uses default if not specified) */
  targetPath?: string;
  /** Skip backup creation */
  noBackup?: boolean;
  /** Conflict resolution strategy */
  conflict?: ConflictStrategy;
  /** Dry run - analyze only, don't import */
  dryRun?: boolean;
  /** Only import from specific projects */
  projects?: string[];
}

/**
 * Import statistics
 */
export interface ImportStats {
  sessionsImported: number;
  sessionsSkipped: number;
  memoriesImported: number;
  memoriesSkipped: number;
  memoriesFailed: number;
  projectsCreated: string[];
  typeMappings: Record<string, number>;
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  error?: string;
  analysis: AnalysisResult;
  backup?: BackupResult;
  stats?: ImportStats;
  dryRun: boolean;
}

/**
 * Legacy memory record from source database
 */
interface LegacyMemory {
  id: number;
  session_id: string | null;
  content: string | null;
  type: string | null;
  metadata: string | null;
  created_at: string | null;
}

/**
 * Legacy session record from source database
 */
interface LegacySession {
  id: string;
  project: string | null;
  started_at: string | null;
}

/**
 * Import data from a legacy claude-mem database
 */
export async function importLegacyDatabase(options: ImportOptions): Promise<ImportResult> {
  const { sourcePath, noBackup, conflict = 'skip', dryRun = false, projects } = options;

  // Analyze source database
  logger.info(`Analyzing source database: ${sourcePath}`);
  const analysis = analyzeLegacyDatabase(sourcePath);

  if (!analysis.success) {
    return {
      success: false,
      error: analysis.error,
      analysis,
      dryRun,
    };
  }

  logger.info(`Found ${analysis.totalMemories} memories, ${analysis.totalSessions} sessions`);

  // Dry run - return analysis only
  if (dryRun) {
    logger.info('Dry run complete - no changes made');
    return {
      success: true,
      analysis,
      dryRun: true,
      stats: {
        sessionsImported: 0,
        sessionsSkipped: 0,
        memoriesImported: 0,
        memoriesSkipped: 0,
        memoriesFailed: 0,
        projectsCreated: [],
        typeMappings: {},
      },
    };
  }

  // Create backup of target database
  let backup: BackupResult | undefined;
  const settings = loadSettings();
  const targetDbPath = options.targetPath || settings.DATABASE_PATH;

  if (!noBackup && targetDbPath && existsSync(targetDbPath)) {
    logger.info('Creating backup of target database...');
    backup = createBackup(targetDbPath);
    if (!backup.success) {
      return {
        success: false,
        error: `Backup failed: ${backup.error}`,
        analysis,
        backup,
        dryRun,
      };
    }
    logger.info(`Backup created: ${backup.backupPath}`);
  }

  // Initialize target database
  let db: InstanceType<typeof MikroOrmDatabase> | null = null;
  let sourceDb: Database.Database | null = null;

  try {
    logger.info('Initializing target database...');
    db = new MikroOrmDatabase({
      type: 'sqlite',
      dbPath: targetDbPath,
    });
    await db.initialize();

    const uow = db.unitOfWork;

    // Open source database
    sourceDb = new Database(sourcePath, { readonly: true });

    const stats: ImportStats = {
      sessionsImported: 0,
      sessionsSkipped: 0,
      memoriesImported: 0,
      memoriesSkipped: 0,
      memoriesFailed: 0,
      projectsCreated: [],
      typeMappings: {},
    };

    // Import sessions first (for foreign key references)
    const hasSessionsTable = analysis.tables.some((t) => t.name === 'sessions');
    const sessionIdMap = new Map<string, string>(); // legacy ID -> new memory_session_id

    if (hasSessionsTable) {
      logger.info('Importing sessions...');
      const sessions = sourceDb.prepare('SELECT * FROM sessions').all() as LegacySession[];

      for (const session of sessions) {
        // Filter by project if specified
        if (projects && projects.length > 0) {
          if (!session.project || !projects.includes(session.project)) {
            stats.sessionsSkipped++;
            continue;
          }
        }

        // Generate new memory_session_id (use original ID as base)
        const memorySessionId = `legacy-${session.id}`;
        const projectName = session.project || 'legacy-import';

        // Check if session already exists
        const existingSession = await uow.sessions.findByMemorySessionId(memorySessionId);
        if (existingSession) {
          if (conflict === 'skip') {
            stats.sessionsSkipped++;
            sessionIdMap.set(session.id, memorySessionId);
            continue;
          }
          // overwrite: delete existing session (cascades to observations)
          await uow.sessions.delete(existingSession.id);
        }

        // Create new session
        const sessionInput: CreateSessionInput = {
          contentSessionId: `legacy-${session.id}`,
          memorySessionId,
          project: projectName,
        };

        await uow.sessions.create(sessionInput);
        sessionIdMap.set(session.id, memorySessionId);
        stats.sessionsImported++;

        // Track project
        if (!stats.projectsCreated.includes(projectName)) {
          stats.projectsCreated.push(projectName);
        }
      }

      logger.info(`Sessions: ${stats.sessionsImported} imported, ${stats.sessionsSkipped} skipped`);
    }

    // Import memories as observations
    const hasMemoriesTable = analysis.tables.some((t) => t.name === 'memories');

    if (hasMemoriesTable) {
      logger.info('Importing memories as observations...');
      const memories = sourceDb.prepare('SELECT * FROM memories').all() as LegacyMemory[];

      for (const memory of memories) {
        try {
          // Get session info for project
          let memorySessionId = memory.session_id ? sessionIdMap.get(memory.session_id) : null;
          let project = 'legacy-import';

          if (memory.session_id && !memorySessionId) {
            // Session not imported (filtered by project) - try to get project from metadata
            const sessionRow = sourceDb.prepare('SELECT project FROM sessions WHERE id = ?').get(memory.session_id) as
              | LegacySession
              | undefined;
            project = sessionRow?.project || 'legacy-import';

            // Check project filter
            if (projects && projects.length > 0 && !projects.includes(project)) {
              stats.memoriesSkipped++;
              continue;
            }

            // Create placeholder session ID
            memorySessionId = `legacy-orphan-${memory.id}`;
          }

          // Map type
          const observationType = mapLegacyType(memory.type);
          stats.typeMappings[memory.type || 'null'] = (stats.typeMappings[memory.type || 'null'] || 0) + 1;

          // Parse metadata
          let metadata: Record<string, unknown> = {};
          if (memory.metadata) {
            try {
              metadata = JSON.parse(memory.metadata);
            } catch {
              // Invalid JSON - store as raw string
              metadata = { raw: memory.metadata };
            }
          }

          // Extract title from content or metadata
          const title = (metadata.title as string) || extractTitle(memory.content);

          // Create observation
          const observationInput: CreateObservationInput = {
            memorySessionId: memorySessionId || `legacy-orphan-${memory.id}`,
            project,
            text: memory.content || undefined,
            type: observationType,
            title,
            narrative: `Imported from legacy claude-mem. Original type: ${memory.type || 'unknown'}`,
          };

          await uow.observations.create(observationInput);
          stats.memoriesImported++;

          // Log progress periodically
          if (stats.memoriesImported % 100 === 0) {
            logger.debug(`Imported ${stats.memoriesImported} memories...`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn(`Failed to import memory ${memory.id}: ${message}`);
          stats.memoriesFailed++;
        }
      }

      logger.info(
        `Memories: ${stats.memoriesImported} imported, ${stats.memoriesSkipped} skipped, ${stats.memoriesFailed} failed`
      );
    }

    return {
      success: true,
      analysis,
      backup,
      stats,
      dryRun,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Import failed: ${message}`);

    return {
      success: false,
      error: message,
      analysis,
      backup,
      dryRun,
    };
  } finally {
    sourceDb?.close();
    await db?.close();
  }
}

/**
 * Extract a title from content (first line or truncated)
 */
function extractTitle(content: string | null): string {
  if (!content) {
    return 'Untitled';
  }

  // Get first line
  const firstLine = content.split('\n')[0].trim();

  // Remove markdown headers
  const cleaned = firstLine.replace(/^#+\s*/, '');

  // Truncate if too long
  if (cleaned.length > 100) {
    return cleaned.substring(0, 97) + '...';
  }

  return cleaned || 'Untitled';
}

/**
 * Format import result for console output
 */
export function formatImportReport(result: ImportResult): string {
  const lines: string[] = ['='.repeat(60), 'Import Report', '='.repeat(60), ''];

  if (!result.success) {
    lines.push(`Error: ${result.error}`);
    return lines.join('\n');
  }

  if (result.dryRun) {
    lines.push('*** DRY RUN - No changes made ***');
    lines.push('');
  }

  lines.push(`Source: ${result.analysis.dbPath}`);
  lines.push(`Total records in source: ${result.analysis.totalMemories} memories, ${result.analysis.totalSessions} sessions`);

  if (result.backup?.success) {
    lines.push(`Backup: ${result.backup.backupPath}`);
  }

  if (result.stats) {
    lines.push('', '--- Import Statistics ---');
    lines.push(`  Sessions imported: ${result.stats.sessionsImported}`);
    lines.push(`  Sessions skipped: ${result.stats.sessionsSkipped}`);
    lines.push(`  Memories imported: ${result.stats.memoriesImported}`);
    lines.push(`  Memories skipped: ${result.stats.memoriesSkipped}`);
    lines.push(`  Memories failed: ${result.stats.memoriesFailed}`);

    if (result.stats.projectsCreated.length > 0) {
      lines.push(`  Projects: ${result.stats.projectsCreated.join(', ')}`);
    }

    if (Object.keys(result.stats.typeMappings).length > 0) {
      lines.push('', '--- Type Mappings ---');
      for (const [type, count] of Object.entries(result.stats.typeMappings)) {
        const mapped = mapLegacyType(type);
        lines.push(`  ${type} → ${mapped}: ${count}`);
      }
    }
  }

  lines.push('', '='.repeat(60));

  return lines.join('\n');
}
