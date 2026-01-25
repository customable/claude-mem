/**
 * Tests for observation handler
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleObservationTask, type ObservationResult } from '../handlers/observation-handler.js';
import type { Agent, AgentResponse } from '../agents/types.js';
import type { ObservationTaskPayload } from '@claude-mem/types';

// Mock the logger
vi.mock('@claude-mem/shared', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Create a mock agent
function createMockAgent(response: Partial<AgentResponse>): Agent {
  return {
    name: 'test-agent',
    isAvailable: () => true,
    query: vi.fn().mockResolvedValue({
      content: '',
      inputTokens: 100,
      outputTokens: 50,
      model: 'test-model',
      ...response,
    }),
  };
}

// Create a test payload
function createTestPayload(overrides?: Partial<ObservationTaskPayload>): ObservationTaskPayload {
  return {
    sessionId: 'test-session-123',
    project: 'test-project',
    toolName: 'Read',
    toolInput: '{"file_path": "/test/file.ts"}',
    toolOutput: 'export function test() { return true; }',
    ...overrides,
  };
}

// Helper to assert result is defined and return typed result
function assertResult(result: ObservationResult | undefined): ObservationResult {
  expect(result).toBeDefined();
  return result!;
}

describe('handleObservationTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful extraction', () => {
    it('should extract observation from valid XML response', async () => {
      const mockAgent = createMockAgent({
        content: `
          <observation>
            <type>discovery</type>
            <title>Test function found</title>
            <text>Found a test function that returns true</text>
          </observation>
        `,
      });

      const rawResult = await handleObservationTask(mockAgent, createTestPayload());
      const result = assertResult(rawResult);

      expect(result.title).toBe('Test function found');
      expect(result.text).toBe('Found a test function that returns true');
      expect(result.type).toBe('discovery');
      expect(result.tokens).toBe(150);
      expect(result.observationId).toBe(0);
    });

    it('should extract optional fields', async () => {
      const mockAgent = createMockAgent({
        content: `
          <observation>
            <type>change</type>
            <title>Function modified</title>
            <text>Updated the function logic</text>
            <subtitle>Minor refactor</subtitle>
            <narrative>The function was simplified for better readability</narrative>
            <files_read>/src/utils.ts, /src/index.ts</files_read>
            <files_modified>/src/utils.ts</files_modified>
            <facts>Function returns boolean, No side effects</facts>
            <concepts>pure function, immutability</concepts>
          </observation>
        `,
      });

      const rawResult = await handleObservationTask(mockAgent, createTestPayload());
      const result = assertResult(rawResult);

      expect(result.title).toBe('Function modified');
      expect(result.subtitle).toBe('Minor refactor');
      expect(result.narrative).toBe('The function was simplified for better readability');
      expect(result.filesRead).toEqual(['/src/utils.ts', '/src/index.ts']);
      expect(result.filesModified).toEqual(['/src/utils.ts']);
      expect(result.facts).toEqual(['Function returns boolean', 'No side effects']);
      expect(result.concepts).toEqual(['pure function', 'immutability']);
    });

    it('should handle different observation types', async () => {
      const types = ['bugfix', 'feature', 'refactor', 'change', 'discovery', 'decision'];

      for (const type of types) {
        const mockAgent = createMockAgent({
          content: `
            <observation>
              <type>${type}</type>
              <title>Test</title>
              <text>Test text</text>
            </observation>
          `,
        });

        const rawResult = await handleObservationTask(mockAgent, createTestPayload());
        const result = assertResult(rawResult);
        expect(result.type).toBe(type);
      }
    });

    it('should take only the first observation when multiple are present', async () => {
      const mockAgent = createMockAgent({
        content: `
          <observations>
            <observation>
              <type>discovery</type>
              <title>First observation</title>
              <text>First text</text>
            </observation>
            <observation>
              <type>change</type>
              <title>Second observation</title>
              <text>Second text</text>
            </observation>
          </observations>
        `,
      });

      const rawResult = await handleObservationTask(mockAgent, createTestPayload());
      const result = assertResult(rawResult);

      expect(result.title).toBe('First observation');
      expect(result.text).toBe('First text');
    });
  });

  describe('agent query parameters', () => {
    it('should pass correct parameters to agent', async () => {
      const mockAgent = createMockAgent({
        content: '<observation><title>Test</title><text>Text</text></observation>',
      });

      await handleObservationTask(mockAgent, createTestPayload({
        project: 'my-project',
        sessionId: 'session-456',
        toolName: 'Write',
        promptNumber: 5,
      }));

      expect(mockAgent.query).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: 2048,
          temperature: 0.3,
          messages: [
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Project: my-project'),
            }),
          ],
        })
      );

      const call = (mockAgent.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.messages[0].content).toContain('Session: session-456');
      expect(call.messages[0].content).toContain('Tool: Write');
      expect(call.messages[0].content).toContain('Prompt Number: 5');
    });

    it('should include tool input and output in prompt', async () => {
      const mockAgent = createMockAgent({
        content: '<observation><title>Test</title><text>Text</text></observation>',
      });

      await handleObservationTask(mockAgent, createTestPayload({
        toolInput: '{"path": "/test.ts"}',
        toolOutput: 'File content here',
      }));

      const call = (mockAgent.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.messages[0].content).toContain('Input:');
      expect(call.messages[0].content).toContain('{"path": "/test.ts"}');
      expect(call.messages[0].content).toContain('Output:');
      expect(call.messages[0].content).toContain('File content here');
    });

    it('should pass abort signal to agent', async () => {
      const mockAgent = createMockAgent({
        content: '<observation><title>Test</title><text>Text</text></observation>',
      });
      const controller = new AbortController();

      await handleObservationTask(mockAgent, createTestPayload(), controller.signal);

      expect(mockAgent.query).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });
  });

  describe('cancellation', () => {
    it('should throw when signal is already aborted', async () => {
      const mockAgent = createMockAgent({
        content: '<observation><title>Test</title><text>Text</text></observation>',
      });
      const controller = new AbortController();
      controller.abort();

      await expect(
        handleObservationTask(mockAgent, createTestPayload(), controller.signal)
      ).rejects.toThrow('Task cancelled');
    });

    it('should not call agent when cancelled', async () => {
      const mockAgent = createMockAgent({
        content: '<observation><title>Test</title><text>Text</text></observation>',
      });
      const controller = new AbortController();
      controller.abort();

      try {
        await handleObservationTask(mockAgent, createTestPayload(), controller.signal);
      } catch {
        // Expected
      }

      expect(mockAgent.query).not.toHaveBeenCalled();
    });
  });

  describe('empty/missing observations', () => {
    it('should return fallback when no observation extracted', async () => {
      const mockAgent = createMockAgent({
        content: 'No valid XML here',
        inputTokens: 50,
        outputTokens: 25,
      });

      const rawResult = await handleObservationTask(mockAgent, createTestPayload());
      const result = assertResult(rawResult);

      expect(result.title).toBe('No observation extracted');
      expect(result.text).toBe('');
      expect(result.type).toBe('discovery');
      expect(result.tokens).toBe(75);
    });

    it('should return fallback for empty response', async () => {
      const mockAgent = createMockAgent({
        content: '',
      });

      const rawResult = await handleObservationTask(mockAgent, createTestPayload());
      const result = assertResult(rawResult);

      expect(result.title).toBe('No observation extracted');
    });

    it('should return fallback for observation without title or text', async () => {
      const mockAgent = createMockAgent({
        content: '<observation><type>discovery</type></observation>',
      });

      const rawResult = await handleObservationTask(mockAgent, createTestPayload());
      const result = assertResult(rawResult);

      expect(result.title).toBe('No observation extracted');
    });
  });

  describe('text truncation', () => {
    it('should truncate very long tool input', async () => {
      const mockAgent = createMockAgent({
        content: '<observation><title>Test</title><text>Text</text></observation>',
      });

      const longInput = 'x'.repeat(10000);
      await handleObservationTask(mockAgent, createTestPayload({
        toolInput: longInput,
      }));

      const call = (mockAgent.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.messages[0].content).toContain('[... truncated ...]');
      expect(call.messages[0].content.length).toBeLessThan(longInput.length + 1000);
    });

    it('should truncate very long tool output', async () => {
      const mockAgent = createMockAgent({
        content: '<observation><title>Test</title><text>Text</text></observation>',
      });

      const longOutput = 'y'.repeat(20000);
      await handleObservationTask(mockAgent, createTestPayload({
        toolOutput: longOutput,
      }));

      const call = (mockAgent.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.messages[0].content).toContain('[... truncated ...]');
    });

    it('should not truncate short text', async () => {
      const mockAgent = createMockAgent({
        content: '<observation><title>Test</title><text>Text</text></observation>',
      });

      const shortInput = 'short input';
      await handleObservationTask(mockAgent, createTestPayload({
        toolInput: shortInput,
      }));

      const call = (mockAgent.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.messages[0].content).toContain(shortInput);
      expect(call.messages[0].content).not.toContain('[... truncated ...]');
    });
  });

  describe('error handling', () => {
    it('should propagate agent query errors', async () => {
      const mockAgent = createMockAgent({});
      (mockAgent.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

      await expect(
        handleObservationTask(mockAgent, createTestPayload())
      ).rejects.toThrow('API error');
    });
  });

  describe('edge cases', () => {
    it('should handle unknown observation type', async () => {
      const mockAgent = createMockAgent({
        content: `
          <observation>
            <type>unknown-type</type>
            <title>Test</title>
            <text>Text</text>
          </observation>
        `,
      });

      const rawResult = await handleObservationTask(mockAgent, createTestPayload());
      const result = assertResult(rawResult);

      // Unknown types default to 'discovery'
      expect(result.type).toBe('discovery');
    });

    it('should handle observation with only title', async () => {
      const mockAgent = createMockAgent({
        content: `
          <observation>
            <title>Only title</title>
          </observation>
        `,
      });

      const rawResult = await handleObservationTask(mockAgent, createTestPayload());
      const result = assertResult(rawResult);

      expect(result.title).toBe('Only title');
      expect(result.text).toBe('');
    });

    it('should handle observation with only text', async () => {
      const mockAgent = createMockAgent({
        content: `
          <observation>
            <text>Only text content</text>
          </observation>
        `,
      });

      const rawResult = await handleObservationTask(mockAgent, createTestPayload());
      const result = assertResult(rawResult);

      expect(result.title).toBe('Untitled observation');
      expect(result.text).toBe('Only text content');
    });

    it('should not include empty arrays for optional fields', async () => {
      const mockAgent = createMockAgent({
        content: `
          <observation>
            <type>discovery</type>
            <title>Test</title>
            <text>Text</text>
            <files_read></files_read>
          </observation>
        `,
      });

      const rawResult = await handleObservationTask(mockAgent, createTestPayload());
      const result = assertResult(rawResult);

      expect(result.filesRead).toBeUndefined();
      expect(result.filesModified).toBeUndefined();
      expect(result.facts).toBeUndefined();
      expect(result.concepts).toBeUndefined();
    });
  });
});
