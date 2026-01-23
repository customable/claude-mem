#!/usr/bin/env node
/**
 * Claude-mem MCP Search Server
 *
 * MCP server that provides memory search tools.
 * Delegates to backend HTTP API for actual queries.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Version injected at build time
declare const __PLUGIN_VERSION__: string;
const version = typeof __PLUGIN_VERSION__ !== 'undefined' ? __PLUGIN_VERSION__ : '0.0.0-dev';

// CRITICAL: Redirect console to stderr for MCP protocol
const originalLog = console.log;
console.log = (...args: unknown[]) => {
  console.error('[MCP-LOG]', ...args);
};

/**
 * Backend configuration
 */
const BACKEND_HOST = process.env.CLAUDE_MEM_BACKEND_HOST || 'localhost';
const BACKEND_PORT = process.env.CLAUDE_MEM_BACKEND_PORT || '37777';
const BACKEND_BASE_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;

/**
 * Call backend API
 */
async function callBackendAPI(
  endpoint: string,
  params: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }

    const url = `${BACKEND_BASE_URL}${endpoint}?${searchParams}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as Record<string, unknown>;

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
 * Tool definitions
 */
const TOOLS = [
  {
    name: 'search',
    description: 'Search memory observations. Returns index with IDs for filtering.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query text' },
        limit: { type: 'number', description: 'Max results (default 20)' },
        type: { type: 'string', description: 'Filter by observation type' },
        project: { type: 'string', description: 'Filter by project' },
        dateStart: { type: 'string', description: 'Start date (ISO 8601)' },
        dateEnd: { type: 'string', description: 'End date (ISO 8601)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'timeline',
    description: 'Get context around an observation. Use after search to fetch details.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        anchor: { type: 'number', description: 'Observation ID to center on' },
        query: { type: 'string', description: 'Or search query to find anchor' },
        depth_before: { type: 'number', description: 'Observations before anchor' },
        depth_after: { type: 'number', description: 'Observations after anchor' },
        project: { type: 'string', description: 'Filter by project' },
      },
    },
  },
  {
    name: 'get_observations',
    description: 'Fetch full details for filtered observation IDs.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of observation IDs to fetch',
        },
        project: { type: 'string', description: 'Filter by project' },
      },
      required: ['ids'],
    },
  },
  {
    name: 'save_memory',
    description: 'Save a manual memory/observation for semantic search.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'Content to remember' },
        title: { type: 'string', description: 'Short title (optional)' },
        project: { type: 'string', description: 'Project name (optional)' },
      },
      required: ['text'],
    },
  },
];

/**
 * Create and run MCP server
 */
async function main(): Promise<void> {
  const server = new Server(
    {
      name: 'claude-mem-mcp-search',
      version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'search':
        return callBackendAPI('/api/search', args as Record<string, unknown>);

      case 'timeline':
        return callBackendAPI('/api/search/timeline', args as Record<string, unknown>);

      case 'get_observations':
        return callBackendAPI('/api/search/observations', args as Record<string, unknown>);

      case 'save_memory':
        // POST request for saving
        try {
          const response = await fetch(`${BACKEND_BASE_URL}/api/data/observations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

      default:
        return {
          content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  });

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
