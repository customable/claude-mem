/**
 * Tests for XML Parser utilities
 */
import { describe, it, expect } from 'vitest';
import {
  parseObservations,
  parseSummary,
  parseSessionId,
  parseAgentResponse,
} from '../handlers/xml-parser.js';

describe('XML Parser', () => {
  describe('parseObservations', () => {
    it('should parse single observation', () => {
      const xml = `
        <observation>
          <type>discovery</type>
          <title>Found auth module</title>
          <text>The authentication is handled in src/auth.ts</text>
        </observation>
      `;

      const observations = parseObservations(xml);
      expect(observations).toHaveLength(1);
      expect(observations[0].type).toBe('discovery');
      expect(observations[0].title).toBe('Found auth module');
      expect(observations[0].text).toBe('The authentication is handled in src/auth.ts');
    });

    it('should parse multiple observations', () => {
      const xml = `
        <observations>
          <observation>
            <type>bugfix</type>
            <title>Fixed null check</title>
            <text>Added null check</text>
          </observation>
          <observation>
            <type>feature</type>
            <title>Added caching</title>
            <text>Implemented LRU cache</text>
          </observation>
        </observations>
      `;

      const observations = parseObservations(xml);
      expect(observations).toHaveLength(2);
      expect(observations[0].type).toBe('bugfix');
      expect(observations[0].title).toBe('Fixed null check');
      expect(observations[1].type).toBe('feature');
      expect(observations[1].title).toBe('Added caching');
    });

    it('should parse observations without wrapper', () => {
      const xml = `
        <observation>
          <type>change</type>
          <title>Updated config</title>
          <text>Changed port</text>
        </observation>
        <observation>
          <type>refactor</type>
          <title>Extracted method</title>
          <text>Moved to separate file</text>
        </observation>
      `;

      const observations = parseObservations(xml);
      expect(observations).toHaveLength(2);
    });

    it('should parse optional fields', () => {
      const xml = `
        <observation>
          <type>decision</type>
          <title>Chose PostgreSQL</title>
          <text>Selected PostgreSQL for persistence</text>
          <subtitle>Database selection</subtitle>
          <narrative>After evaluating options...</narrative>
          <facts>
            PostgreSQL supports JSONB
            Has good indexing
          </facts>
          <concepts>
            database, persistence, JSON
          </concepts>
          <files_read>
            src/db.ts
            config/database.yml
          </files_read>
          <files_modified>
            src/connection.ts
          </files_modified>
        </observation>
      `;

      const observations = parseObservations(xml);
      expect(observations).toHaveLength(1);

      const obs = observations[0];
      expect(obs.subtitle).toBe('Database selection');
      expect(obs.narrative).toBe('After evaluating options...');
      expect(obs.facts).toContain('PostgreSQL supports JSONB');
      expect(obs.facts).toContain('Has good indexing');
      expect(obs.concepts).toContain('database');
      expect(obs.concepts).toContain('persistence');
      expect(obs.filesRead).toContain('src/db.ts');
      expect(obs.filesRead).toContain('config/database.yml');
      expect(obs.filesModified).toContain('src/connection.ts');
    });

    it('should normalize invalid types to discovery', () => {
      const xml = `
        <observation>
          <type>unknown-type</type>
          <title>Test</title>
          <text>Test text</text>
        </observation>
      `;

      const observations = parseObservations(xml);
      expect(observations[0].type).toBe('discovery');
    });

    it('should default to discovery when type is missing', () => {
      const xml = `
        <observation>
          <title>Test</title>
          <text>Test text</text>
        </observation>
      `;

      const observations = parseObservations(xml);
      expect(observations[0].type).toBe('discovery');
    });

    it('should use default title when missing', () => {
      const xml = `
        <observation>
          <type>feature</type>
          <text>Some feature implementation</text>
        </observation>
      `;

      const observations = parseObservations(xml);
      expect(observations[0].title).toBe('Untitled observation');
      expect(observations[0].text).toBe('Some feature implementation');
    });

    it('should skip observations without title and text', () => {
      const xml = `
        <observation>
          <type>bugfix</type>
        </observation>
      `;

      const observations = parseObservations(xml);
      expect(observations).toHaveLength(0);
    });

    it('should handle empty input', () => {
      expect(parseObservations('')).toHaveLength(0);
      expect(parseObservations('   ')).toHaveLength(0);
    });

    it('should parse comma-separated lists', () => {
      const xml = `
        <observation>
          <type>change</type>
          <title>Updated files</title>
          <text>Modified multiple files</text>
          <files_modified>src/a.ts, src/b.ts, src/c.ts</files_modified>
        </observation>
      `;

      const observations = parseObservations(xml);
      expect(observations[0].filesModified).toHaveLength(3);
      expect(observations[0].filesModified).toContain('src/a.ts');
      expect(observations[0].filesModified).toContain('src/b.ts');
      expect(observations[0].filesModified).toContain('src/c.ts');
    });

    it('should handle case-insensitive tags', () => {
      const xml = `
        <OBSERVATION>
          <TYPE>feature</TYPE>
          <TITLE>Test</TITLE>
          <TEXT>Test text</TEXT>
        </OBSERVATION>
      `;

      const observations = parseObservations(xml);
      expect(observations).toHaveLength(1);
      expect(observations[0].type).toBe('feature');
    });

    it('should parse all valid observation types', () => {
      const validTypes = ['bugfix', 'feature', 'refactor', 'change', 'discovery', 'decision', 'session-request'];

      for (const type of validTypes) {
        const xml = `
          <observation>
            <type>${type}</type>
            <title>Test ${type}</title>
            <text>Testing ${type} type</text>
          </observation>
        `;

        const observations = parseObservations(xml);
        expect(observations[0].type).toBe(type);
      }
    });
  });

  describe('parseSummary', () => {
    it('should parse complete summary', () => {
      const xml = `
        <summary>
          <request>Implement user authentication</request>
          <investigated>Looked at existing auth patterns</investigated>
          <learned>JWT is preferred approach</learned>
          <completed>Added login endpoint</completed>
          <next_steps>Add logout and refresh token</next_steps>
        </summary>
      `;

      const summary = parseSummary(xml);
      expect(summary).not.toBeNull();
      expect(summary!.request).toBe('Implement user authentication');
      expect(summary!.investigated).toBe('Looked at existing auth patterns');
      expect(summary!.learned).toBe('JWT is preferred approach');
      expect(summary!.completed).toBe('Added login endpoint');
      expect(summary!.nextSteps).toBe('Add logout and refresh token');
    });

    it('should handle alternative nextsteps tag', () => {
      const xml = `
        <summary>
          <request>Test</request>
          <nextsteps>Do something next</nextsteps>
        </summary>
      `;

      const summary = parseSummary(xml);
      expect(summary!.nextSteps).toBe('Do something next');
    });

    it('should return null for missing summary tag', () => {
      const xml = `
        <observation>
          <type>feature</type>
          <title>Test</title>
          <text>No summary here</text>
        </observation>
      `;

      expect(parseSummary(xml)).toBeNull();
    });

    it('should return null for empty summary', () => {
      const xml = `<summary></summary>`;
      expect(parseSummary(xml)).toBeNull();
    });

    it('should handle partial summary', () => {
      const xml = `
        <summary>
          <request>Just a request</request>
        </summary>
      `;

      const summary = parseSummary(xml);
      expect(summary).not.toBeNull();
      expect(summary!.request).toBe('Just a request');
      expect(summary!.investigated).toBe('');
      expect(summary!.learned).toBe('');
      expect(summary!.completed).toBe('');
      expect(summary!.nextSteps).toBe('');
    });
  });

  describe('parseSessionId', () => {
    it('should parse memory_session_id', () => {
      const xml = `<memory_session_id>session-123-abc</memory_session_id>`;
      expect(parseSessionId(xml)).toBe('session-123-abc');
    });

    it('should parse session_id', () => {
      const xml = `<session_id>session-456-def</session_id>`;
      expect(parseSessionId(xml)).toBe('session-456-def');
    });

    it('should prefer memory_session_id over session_id', () => {
      const xml = `
        <memory_session_id>preferred-session</memory_session_id>
        <session_id>fallback-session</session_id>
      `;
      expect(parseSessionId(xml)).toBe('preferred-session');
    });

    it('should return null when no session ID present', () => {
      const xml = `<observation><title>Test</title></observation>`;
      expect(parseSessionId(xml)).toBeNull();
    });
  });

  describe('parseAgentResponse', () => {
    it('should parse complete agent response', () => {
      const xml = `
        <memory_session_id>session-xyz</memory_session_id>
        <observations>
          <observation>
            <type>feature</type>
            <title>Added feature</title>
            <text>Implemented new feature</text>
          </observation>
        </observations>
        <summary>
          <request>Add new feature</request>
          <completed>Feature added</completed>
        </summary>
      `;

      const response = parseAgentResponse(xml);

      expect(response.sessionId).toBe('session-xyz');
      expect(response.observations).toHaveLength(1);
      expect(response.observations[0].title).toBe('Added feature');
      expect(response.summary).not.toBeNull();
      expect(response.summary!.request).toBe('Add new feature');
      expect(response.raw).toBe(xml);
    });

    it('should handle response with only observations', () => {
      const xml = `
        <observation>
          <type>discovery</type>
          <title>Found issue</title>
          <text>Bug in module</text>
        </observation>
      `;

      const response = parseAgentResponse(xml);
      expect(response.observations).toHaveLength(1);
      expect(response.summary).toBeNull();
      expect(response.sessionId).toBeNull();
    });

    it('should handle empty response', () => {
      const response = parseAgentResponse('');
      expect(response.observations).toHaveLength(0);
      expect(response.summary).toBeNull();
      expect(response.sessionId).toBeNull();
      expect(response.raw).toBe('');
    });
  });
});
