/**
 * Tests for summarize handler
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSummarizeTask, type ObservationData } from '../handlers/summarize-handler.js';
import type { Agent, AgentResponse } from '../agents/types.js';
import type { SummarizeTaskPayload } from '@claude-mem/types';

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
      inputTokens: 200,
      outputTokens: 100,
      model: 'test-model',
      ...response,
    }),
  };
}

// Create a test payload
function createTestPayload(overrides?: Partial<SummarizeTaskPayload>): SummarizeTaskPayload {
  return {
    sessionId: 'test-session-123',
    project: 'test-project',
    userPrompt: 'Fix the authentication bug',
    observations: [],
    ...overrides,
  };
}

// Create test observations
function createTestObservations(): ObservationData[] {
  return [
    {
      title: 'Found auth bug in login.ts',
      text: 'The password comparison was using == instead of ===',
      type: 'bugfix',
    },
    {
      title: 'Fixed the comparison operator',
      text: 'Changed to use constant-time comparison function',
      type: 'change',
    },
    {
      title: 'Added tests for authentication',
      text: 'Created unit tests for the login function',
      type: 'feature',
    },
  ];
}

// Helper type for summary result
type SummaryResult = NonNullable<Awaited<ReturnType<typeof handleSummarizeTask>>>;

// Helper to assert result is defined and return typed result
function assertResult(result: SummaryResult | undefined): SummaryResult {
  expect(result).toBeDefined();
  return result!;
}

describe('handleSummarizeTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful summarization', () => {
    it('should extract summary from valid XML response', async () => {
      const mockAgent = createMockAgent({
        content: `
          <summary>
            <request>Fix authentication bug</request>
            <investigated>Login module, password comparison logic</investigated>
            <learned>Timing attacks are possible with simple comparison</learned>
            <completed>Fixed comparison, added tests</completed>
            <next_steps>Deploy to staging for testing</next_steps>
          </summary>
        `,
      });

      const rawResult = await handleSummarizeTask(
        mockAgent,
        createTestPayload(),
        createTestObservations()
      );
      const result = assertResult(rawResult);

      expect(result.request).toBe('Fix authentication bug');
      expect(result.investigated).toBe('Login module, password comparison logic');
      expect(result.learned).toBe('Timing attacks are possible with simple comparison');
      expect(result.completed).toBe('Fixed comparison, added tests');
      expect(result.nextSteps).toBe('Deploy to staging for testing');
      expect(result.tokens).toBe(300);
      expect(result.summaryId).toBe(0);
    });

    it('should handle nextsteps alternative tag name', async () => {
      const mockAgent = createMockAgent({
        content: `
          <summary>
            <request>Test</request>
            <nextsteps>Alternative next steps format</nextsteps>
          </summary>
        `,
      });

      const rawResult = await handleSummarizeTask(
        mockAgent,
        createTestPayload(),
        createTestObservations()
      );
      const result = assertResult(rawResult);

      expect(result.nextSteps).toBe('Alternative next steps format');
    });
  });

  describe('agent query parameters', () => {
    it('should pass correct parameters to agent', async () => {
      const mockAgent = createMockAgent({
        content: '<summary><request>Test</request></summary>',
      });

      await handleSummarizeTask(
        mockAgent,
        createTestPayload({ project: 'my-project' }),
        createTestObservations()
      );

      expect(mockAgent.query).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: 1024,
          temperature: 0.3,
        })
      );
    });

    it('should include observations in prompt', async () => {
      const mockAgent = createMockAgent({
        content: '<summary><request>Test</request></summary>',
      });

      const observations = createTestObservations();
      await handleSummarizeTask(mockAgent, createTestPayload(), observations);

      const call = (mockAgent.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.messages[0].content).toContain('Found auth bug in login.ts');
      expect(call.messages[0].content).toContain('Fixed the comparison operator');
    });

    it('should pass abort signal to agent', async () => {
      const mockAgent = createMockAgent({
        content: '<summary><request>Test</request></summary>',
      });
      const controller = new AbortController();

      await handleSummarizeTask(
        mockAgent,
        createTestPayload(),
        createTestObservations(),
        controller.signal
      );

      expect(mockAgent.query).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });
  });

  describe('empty observations', () => {
    it('should return early with empty result when no observations', async () => {
      const mockAgent = createMockAgent({
        content: '<summary><request>Test</request></summary>',
      });

      const rawResult = await handleSummarizeTask(mockAgent, createTestPayload(), []);
      const result = assertResult(rawResult);

      expect(result.request).toBe('No observations to summarize');
      expect(result.investigated).toBe('');
      expect(result.learned).toBe('');
      expect(result.completed).toBe('');
      expect(result.nextSteps).toBe('');
      expect(result.tokens).toBe(0);
      expect(mockAgent.query).not.toHaveBeenCalled();
    });
  });

  describe('cancellation', () => {
    it('should throw when signal is already aborted', async () => {
      const mockAgent = createMockAgent({
        content: '<summary><request>Test</request></summary>',
      });
      const controller = new AbortController();
      controller.abort();

      await expect(
        handleSummarizeTask(
          mockAgent,
          createTestPayload(),
          createTestObservations(),
          controller.signal
        )
      ).rejects.toThrow('Task cancelled');
    });

    it('should not call agent when cancelled', async () => {
      const mockAgent = createMockAgent({
        content: '<summary><request>Test</request></summary>',
      });
      const controller = new AbortController();
      controller.abort();

      try {
        await handleSummarizeTask(
          mockAgent,
          createTestPayload(),
          createTestObservations(),
          controller.signal
        );
      } catch {
        // Expected
      }

      expect(mockAgent.query).not.toHaveBeenCalled();
    });
  });

  describe('failed summary extraction', () => {
    it('should return fallback when no summary extracted', async () => {
      const mockAgent = createMockAgent({
        content: 'No valid XML here',
        inputTokens: 50,
        outputTokens: 25,
      });

      const rawResult = await handleSummarizeTask(
        mockAgent,
        createTestPayload(),
        createTestObservations()
      );
      const result = assertResult(rawResult);

      expect(result.request).toBe('Summary extraction failed');
      expect(result.investigated).toBe('');
      expect(result.learned).toBe('');
      expect(result.completed).toBe('');
      expect(result.nextSteps).toBe('');
      expect(result.tokens).toBe(75);
    });

    it('should return fallback for empty response', async () => {
      const mockAgent = createMockAgent({
        content: '',
      });

      const rawResult = await handleSummarizeTask(
        mockAgent,
        createTestPayload(),
        createTestObservations()
      );
      const result = assertResult(rawResult);

      expect(result.request).toBe('Summary extraction failed');
    });

    it('should return fallback for summary without any fields', async () => {
      const mockAgent = createMockAgent({
        content: '<summary></summary>',
      });

      const rawResult = await handleSummarizeTask(
        mockAgent,
        createTestPayload(),
        createTestObservations()
      );
      const result = assertResult(rawResult);

      expect(result.request).toBe('Summary extraction failed');
    });
  });

  describe('partial summary', () => {
    it('should handle summary with only some fields', async () => {
      const mockAgent = createMockAgent({
        content: `
          <summary>
            <request>User asked to fix bug</request>
            <completed>Bug was fixed</completed>
          </summary>
        `,
      });

      const rawResult = await handleSummarizeTask(
        mockAgent,
        createTestPayload(),
        createTestObservations()
      );
      const result = assertResult(rawResult);

      expect(result.request).toBe('User asked to fix bug');
      expect(result.completed).toBe('Bug was fixed');
      expect(result.investigated).toBe('');
      expect(result.learned).toBe('');
      expect(result.nextSteps).toBe('');
    });

    it('should handle summary with only next_steps', async () => {
      const mockAgent = createMockAgent({
        content: `
          <summary>
            <next_steps>Review and merge PR</next_steps>
          </summary>
        `,
      });

      const rawResult = await handleSummarizeTask(
        mockAgent,
        createTestPayload(),
        createTestObservations()
      );
      const result = assertResult(rawResult);

      expect(result.nextSteps).toBe('Review and merge PR');
      expect(result.request).toBe('');
    });
  });

  describe('error handling', () => {
    it('should propagate agent query errors', async () => {
      const mockAgent = createMockAgent({});
      (mockAgent.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

      await expect(
        handleSummarizeTask(
          mockAgent,
          createTestPayload(),
          createTestObservations()
        )
      ).rejects.toThrow('API error');
    });
  });

  describe('observation variety', () => {
    it('should handle observations with different types', async () => {
      const mockAgent = createMockAgent({
        content: '<summary><request>Test</request></summary>',
      });

      const observations: ObservationData[] = [
        { title: 'Bug found', text: 'Details', type: 'bugfix' },
        { title: 'New feature', text: 'Details', type: 'feature' },
        { title: 'Code refactored', text: 'Details', type: 'refactor' },
        { title: 'Decision made', text: 'Details', type: 'decision' },
        { title: 'Discovery', text: 'Details', type: 'discovery' },
      ];

      const result = await handleSummarizeTask(mockAgent, createTestPayload(), observations);

      expect(result).toBeDefined();
      expect(mockAgent.query).toHaveBeenCalled();

      // Verify all observations are included in prompt
      const call = (mockAgent.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.messages[0].content).toContain('Bug found');
      expect(call.messages[0].content).toContain('New feature');
      expect(call.messages[0].content).toContain('Code refactored');
    });

    it('should handle single observation', async () => {
      const mockAgent = createMockAgent({
        content: '<summary><request>Test</request></summary>',
      });

      const observations: ObservationData[] = [
        { title: 'Single observation', text: 'Only one', type: 'discovery' },
      ];

      const result = await handleSummarizeTask(mockAgent, createTestPayload(), observations);

      expect(result).toBeDefined();
      expect(mockAgent.query).toHaveBeenCalled();
    });

    it('should handle many observations', async () => {
      const mockAgent = createMockAgent({
        content: '<summary><request>Test</request></summary>',
      });

      const observations: ObservationData[] = Array.from({ length: 50 }, (_, i) => ({
        title: `Observation ${i + 1}`,
        text: `Details for observation ${i + 1}`,
        type: 'discovery',
      }));

      const result = await handleSummarizeTask(mockAgent, createTestPayload(), observations);

      expect(result).toBeDefined();
      expect(mockAgent.query).toHaveBeenCalled();
    });
  });

  describe('special characters', () => {
    it('should handle observations with special characters', async () => {
      const mockAgent = createMockAgent({
        content: '<summary><request>Test</request></summary>',
      });

      const observations: ObservationData[] = [
        {
          title: 'Bug with <script> tags',
          text: 'Found XSS vulnerability with <script>alert("xss")</script>',
          type: 'bugfix',
        },
        {
          title: 'Fixed & sanitized',
          text: 'Used proper escaping for < > & " characters',
          type: 'change',
        },
      ];

      const result = await handleSummarizeTask(mockAgent, createTestPayload(), observations);

      expect(result).toBeDefined();
      expect(mockAgent.query).toHaveBeenCalled();
    });

    it('should handle unicode in observations', async () => {
      const mockAgent = createMockAgent({
        content: '<summary><request>Test</request></summary>',
      });

      const observations: ObservationData[] = [
        {
          title: '国际化测试',
          text: 'Added support for 日本語, 한국어, and العربية',
          type: 'feature',
        },
      ];

      const result = await handleSummarizeTask(mockAgent, createTestPayload(), observations);

      expect(result).toBeDefined();
    });
  });
});
