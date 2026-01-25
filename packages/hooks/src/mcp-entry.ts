/**
 * Claude-mem MCP Search Server
 *
 * MCP server that provides memory search tools.
 * Delegates to backend HTTP API for actual queries.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadSettings, initFileLogging, createLogger } from '@claude-mem/shared';
import { z } from 'zod';

// Version injected at build time
declare const __PLUGIN_VERSION__: string;
const version = typeof __PLUGIN_VERSION__ !== 'undefined' ? __PLUGIN_VERSION__ : '0.0.0-dev';

// Initialize file logging in dev/debug mode (Issue #252)
// MCP servers can't use console.log (reserved for protocol), so file logging is essential
const isDebugMode = process.env.CLAUDE_DEBUG === '1' ||
                    process.env.CLAUDE_MEM_DEBUG === '1' ||
                    process.env.NODE_ENV === 'development';

if (isDebugMode) {
  initFileLogging('mcp-search');
}

const logger = createLogger('mcp-search');

// CRITICAL: Redirect console to stderr for MCP protocol
const originalLog = console.log;
console.log = (...args: unknown[]) => {
  console.error('[MCP-LOG]', ...args);
};

/**
 * Backend configuration
 * Supports both local and remote backend via settings
 */
const settings = loadSettings();

let BACKEND_BASE_URL: string;
let AUTH_TOKEN: string;

if (settings.REMOTE_MODE && settings.REMOTE_URL) {
  // Remote mode: use configured remote URL
  BACKEND_BASE_URL = settings.REMOTE_URL;
  AUTH_TOKEN = settings.REMOTE_TOKEN || '';
} else {
  // Local mode: use localhost with optional env overrides
  const host = process.env.CLAUDE_MEM_BACKEND_HOST || settings.BACKEND_HOST || '127.0.0.1';
  const port = process.env.CLAUDE_MEM_BACKEND_PORT || settings.BACKEND_PORT || 37777;
  BACKEND_BASE_URL = `http://${host}:${port}`;
  AUTH_TOKEN = '';
}

/**
 * Call backend API
 */
async function callBackendAPI(
  endpoint: string,
  params: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const startTime = Date.now();

  // Log API call in debug mode (Issue #252)
  if (isDebugMode) {
    logger.debug(`MCP API call: ${endpoint}`, { params });
  }

  try {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }

    const url = `${BACKEND_BASE_URL}${endpoint}?${searchParams}`;
    const headers: Record<string, string> = {};
    if (AUTH_TOKEN) {
      headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`Backend API error (${response.status}): ${errorText}`);
      if (isDebugMode) {
        logger.error(`MCP API error: ${endpoint}`, { status: response.status, errorText });
      }
      throw error;
    }

    const data = await response.json() as Record<string, unknown>;

    // Log success in debug mode
    if (isDebugMode) {
      logger.debug(`MCP API success: ${endpoint}`, { durationMs: Date.now() - startTime });
    }

    // Format response
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(data, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `Error: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Create and run MCP server
 */
async function main(): Promise<void> {
  const server = new McpServer({
    name: 'claude-mem-mcp-search',
    version,
  });

  // Register search tool
  server.registerTool(
    'search',
    {
      description: 'Search memory observations. Returns index with IDs for filtering.',
      inputSchema: {
        query: z.string().describe('Search query text'),
        limit: z.number().optional().describe('Max results (default 20)'),
        type: z.string().optional().describe('Filter by observation type'),
        project: z.string().optional().describe('Filter by project'),
        dateStart: z.string().optional().describe('Start date (ISO 8601)'),
        dateEnd: z.string().optional().describe('End date (ISO 8601)'),
      },
    },
    async (args) => callBackendAPI('/api/search', args as Record<string, unknown>)
  );

  // Register timeline tool
  server.registerTool(
    'timeline',
    {
      description: 'Get context around an observation. Use after search to fetch details.',
      inputSchema: {
        anchor: z.number().optional().describe('Observation ID to center on'),
        query: z.string().optional().describe('Or search query to find anchor'),
        depth_before: z.number().optional().describe('Observations before anchor'),
        depth_after: z.number().optional().describe('Observations after anchor'),
        project: z.string().optional().describe('Filter by project'),
      },
    },
    async (args) => callBackendAPI('/api/search/timeline', args as Record<string, unknown>)
  );

  // Register get_observations tool
  server.registerTool(
    'get_observations',
    {
      description: 'Fetch full details for filtered observation IDs.',
      inputSchema: {
        ids: z.array(z.number()).describe('Array of observation IDs to fetch'),
        project: z.string().optional().describe('Filter by project'),
      },
    },
    async (args) => callBackendAPI('/api/search/observations', args as Record<string, unknown>)
  );

  // Register save_memory tool
  server.registerTool(
    'save_memory',
    {
      description: 'Save important information to persistent memory for semantic search.',
      inputSchema: {
        text: z.string().describe('Content to remember'),
        title: z.string().optional().describe('Short title (optional)'),
        project: z.string().optional().describe('Project name (optional)'),
        type: z.enum(['decision', 'discovery', 'note', 'bookmark']).optional()
          .describe('Memory type: decision (architectural choice), discovery (learning), note (general), bookmark (important moment)'),
      },
    },
    async (args) => {
      try {
        const postHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (AUTH_TOKEN) {
          postHeaders['Authorization'] = `Bearer ${AUTH_TOKEN}`;
        }
        const response = await fetch(`${BACKEND_BASE_URL}/api/data/observations`, {
          method: 'POST',
          headers: postHeaders,
          body: JSON.stringify(args),
        });
        const data = await response.json();
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );

  // Register search_documents tool
  server.registerTool(
    'search_documents',
    {
      description: 'Search cached documentation from Context7 and WebFetch. Use this to recall previously fetched library docs without re-querying external sources.',
      inputSchema: {
        query: z.string().describe('Search query for documentation content'),
        project: z.string().optional().describe('Filter by project (optional)'),
        type: z.string().optional().describe('Filter by document type: library-docs, api-docs, etc. (optional)'),
        limit: z.number().optional().describe('Max results (default 10)'),
      },
    },
    async (args) => {
      const params = args as Record<string, unknown>;
      // Map 'query' to 'q' for backend API
      const backendParams: Record<string, unknown> = {
        q: params.query,
        project: params.project,
        type: params.type,
        limit: params.limit ?? 10,
      };
      return callBackendAPI('/api/data/documents/search', backendParams);
    }
  );

  // Register recall_archived tool (Endless Mode - Issue #109)
  server.registerTool(
    'recall_archived',
    {
      description: 'Recall full tool outputs that were compressed in Endless Mode. Use this when you need the complete original output from a tool that was summarized.',
      inputSchema: {
        query: z.string().optional().describe('Search query to find archived outputs'),
        observationId: z.number().optional().describe('Observation ID to recall full output for'),
        sessionId: z.string().optional().describe('Filter by session ID'),
        project: z.string().optional().describe('Filter by project'),
        toolName: z.string().optional().describe('Filter by tool name (e.g., Read, Grep, Bash)'),
        limit: z.number().optional().describe('Max results (default 5)'),
      },
    },
    async (args) => {
      const params = args as Record<string, unknown>;

      // If observationId is provided, get the specific archived output
      if (params.observationId) {
        return callBackendAPI(`/api/data/archived-outputs/by-observation/${params.observationId}`, {});
      }

      // Otherwise, search archived outputs
      if (!params.query) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Error: Either "query" or "observationId" is required'
          }],
          isError: true,
        };
      }

      const backendParams: Record<string, unknown> = {
        q: params.query,
        sessionId: params.sessionId,
        project: params.project,
        toolName: params.toolName,
        limit: params.limit ?? 5,
      };
      return callBackendAPI('/api/data/archived-outputs/search', backendParams);
    }
  );

  // Register archived_stats tool (Endless Mode - Issue #109)
  server.registerTool(
    'archived_stats',
    {
      description: 'Get statistics about archived tool outputs and compression efficiency.',
      inputSchema: {},
    },
    async () => callBackendAPI('/api/data/archived-outputs/stats', {})
  );

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`claude-mem MCP server v${version} started`);
}

// Run
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
