/**
 * Legacy Database Analyzer (Issue #198)
 *
 * Analyzes thedotmack/claude-mem SQLite databases to understand
 * schema structure and data before migration.
 */

import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { createLogger } from '@claude-mem/shared';
import { isKnownLegacyType } from './type-mapper.js';

const logger = createLogger('migrate:analyzer');

/**
 * Column info from PRAGMA table_info
 */
export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

/**
 * Table analysis result
 */
export interface TableAnalysis {
  name: string;
  rowCount: number;
  columns: ColumnInfo[];
}

/**
 * Type distribution in memories table
 */
export interface TypeDistribution {
  type: string;
  count: number;
  isKnown: boolean;
}

/**
 * Complete analysis result
 */
export interface AnalysisResult {
  success: boolean;
  dbPath: string;
  error?: string;
  tables: TableAnalysis[];
  projects: string[];
  typeDistribution: TypeDistribution[];
  totalMemories: number;
  totalSessions: number;
  dateRange?: {
    earliest: string;
    latest: string;
  };
}

/**
 * Analyze a legacy claude-mem database
 */
export function analyzeLegacyDatabase(dbPath: string): AnalysisResult {
  if (!existsSync(dbPath)) {
    return {
      success: false,
      dbPath,
      error: `Database file not found: ${dbPath}`,
      tables: [],
      projects: [],
      typeDistribution: [],
      totalMemories: 0,
      totalSessions: 0,
    };
  }

  let db: Database.Database | null = null;

  try {
    db = new Database(dbPath, { readonly: true });
    logger.info(`Opened database: ${dbPath}`);

    // Get all tables
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];

    const tableAnalyses: TableAnalysis[] = [];

    for (const { name } of tables) {
      const columns = db.prepare(`PRAGMA table_info(${name})`).all() as ColumnInfo[];
      const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${name}`).get() as { count: number };

      tableAnalyses.push({
        name,
        rowCount: countResult.count,
        columns,
      });
    }

    // Get projects
    let projects: string[] = [];
    const hasSessionsTable = tableAnalyses.some((t) => t.name === 'sessions');

    if (hasSessionsTable) {
      try {
        const projectRows = db.prepare('SELECT DISTINCT project FROM sessions WHERE project IS NOT NULL').all() as {
          project: string;
        }[];
        projects = projectRows.map((r) => r.project).filter(Boolean);
      } catch {
        logger.warn('Could not extract projects from sessions table');
      }
    }

    // Get type distribution from memories
    let typeDistribution: TypeDistribution[] = [];
    let totalMemories = 0;
    const hasMemoriesTable = tableAnalyses.some((t) => t.name === 'memories');

    if (hasMemoriesTable) {
      try {
        const typeRows = db
          .prepare('SELECT type, COUNT(*) as count FROM memories GROUP BY type ORDER BY count DESC')
          .all() as { type: string | null; count: number }[];

        typeDistribution = typeRows.map((r) => ({
          type: r.type ?? 'null',
          count: r.count,
          isKnown: r.type ? isKnownLegacyType(r.type) : false,
        }));

        totalMemories = typeDistribution.reduce((sum, t) => sum + t.count, 0);
      } catch {
        logger.warn('Could not extract type distribution from memories table');
      }
    }

    // Get total sessions
    let totalSessions = 0;
    if (hasSessionsTable) {
      const sessionsTable = tableAnalyses.find((t) => t.name === 'sessions');
      totalSessions = sessionsTable?.rowCount ?? 0;
    }

    // Get date range
    let dateRange: { earliest: string; latest: string } | undefined;
    if (hasMemoriesTable) {
      try {
        const dateResult = db
          .prepare('SELECT MIN(created_at) as earliest, MAX(created_at) as latest FROM memories')
          .get() as { earliest: string | null; latest: string | null };

        if (dateResult.earliest && dateResult.latest) {
          dateRange = {
            earliest: dateResult.earliest,
            latest: dateResult.latest,
          };
        }
      } catch {
        logger.warn('Could not extract date range');
      }
    }

    return {
      success: true,
      dbPath,
      tables: tableAnalyses,
      projects,
      typeDistribution,
      totalMemories,
      totalSessions,
      dateRange,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Analysis failed: ${message}`);

    return {
      success: false,
      dbPath,
      error: message,
      tables: [],
      projects: [],
      typeDistribution: [],
      totalMemories: 0,
      totalSessions: 0,
    };
  } finally {
    db?.close();
  }
}

/**
 * Format analysis result for console output
 */
export function formatAnalysisReport(result: AnalysisResult): string {
  if (!result.success) {
    return `Error: ${result.error}`;
  }

  const lines: string[] = [
    '='.repeat(60),
    'Legacy Database Analysis Report',
    '='.repeat(60),
    '',
    `Database: ${result.dbPath}`,
    '',
    '--- Tables ---',
  ];

  for (const table of result.tables) {
    lines.push(`  ${table.name}: ${table.rowCount} rows`);
    for (const col of table.columns) {
      const pk = col.pk ? ' (PK)' : '';
      const nn = col.notnull ? ' NOT NULL' : '';
      lines.push(`    - ${col.name}: ${col.type}${pk}${nn}`);
    }
  }

  lines.push('', '--- Summary ---');
  lines.push(`  Total memories: ${result.totalMemories}`);
  lines.push(`  Total sessions: ${result.totalSessions}`);
  lines.push(`  Projects: ${result.projects.length > 0 ? result.projects.join(', ') : '(none)'}`);

  if (result.dateRange) {
    lines.push(`  Date range: ${result.dateRange.earliest} to ${result.dateRange.latest}`);
  }

  if (result.typeDistribution.length > 0) {
    lines.push('', '--- Type Distribution ---');
    for (const t of result.typeDistribution) {
      const status = t.isKnown ? '✓' : '?';
      lines.push(`  ${status} ${t.type}: ${t.count}`);
    }

    const unknownTypes = result.typeDistribution.filter((t) => !t.isKnown);
    if (unknownTypes.length > 0) {
      lines.push('', `  Note: ${unknownTypes.length} unknown type(s) will be mapped to 'note'`);
    }
  }

  lines.push('', '='.repeat(60));

  return lines.join('\n');
}
