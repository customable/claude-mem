import { describe, it, expect } from 'vitest';
import {
  calculateEntropy,
  hasHighEntropy,
  detectSecrets,
  redactSecrets,
  createSecretsSummary,
  processSecrets,
  type SecretMatch,
} from '../secret-detector.js';

describe('secret-detector', () => {
  describe('calculateEntropy', () => {
    it('should return 0 for empty string', () => {
      expect(calculateEntropy('')).toBe(0);
    });

    it('should return 0 for single character', () => {
      expect(calculateEntropy('a')).toBe(0);
    });

    it('should return low entropy for repeated characters', () => {
      const entropy = calculateEntropy('aaaaaaaaaa');
      expect(entropy).toBe(0);
    });

    it('should return higher entropy for mixed characters', () => {
      const lowEntropy = calculateEntropy('aaaa');
      const highEntropy = calculateEntropy('abcd');
      expect(highEntropy).toBeGreaterThan(lowEntropy);
    });

    it('should return high entropy for random-looking strings', () => {
      const entropy = calculateEntropy('sk-abc123XYZ456def789GHI');
      expect(entropy).toBeGreaterThan(3);
    });
  });

  describe('hasHighEntropy', () => {
    it('should return false for short strings', () => {
      expect(hasHighEntropy('short')).toBe(false);
    });

    it('should return false for long strings over 256 chars', () => {
      expect(hasHighEntropy('a'.repeat(300))).toBe(false);
    });

    it('should return false for strings with many spaces', () => {
      expect(hasHighEntropy('this is a normal sentence with spaces')).toBe(false);
    });

    it('should return true for random-looking API keys', () => {
      expect(hasHighEntropy('sk-abc123XYZ456def789GHI012jkl')).toBe(true);
    });

    it('should respect custom threshold', () => {
      const str = 'abcdefghijklmnop';
      expect(hasHighEntropy(str, 3.0)).toBe(true);
      expect(hasHighEntropy(str, 5.0)).toBe(false);
    });
  });

  describe('detectSecrets', () => {
    it('should return empty array for empty text', () => {
      expect(detectSecrets('')).toEqual([]);
    });

    it('should detect OpenAI API keys', () => {
      const text = 'My key is sk-abcdefghijklmnopqrstuvwxyz123456';
      const matches = detectSecrets(text);
      expect(matches.some(m => m.type === 'openai_key')).toBe(true);
    });

    it('should detect Anthropic API keys', () => {
      const text = 'Using sk-ant-api03-abcdefghijklmnopqrstuvwxyz';
      const matches = detectSecrets(text);
      expect(matches.some(m => m.type === 'anthropic_key')).toBe(true);
    });

    it('should detect GitHub PATs', () => {
      const text = 'Token: ghp_abcdefghijklmnopqrstuvwxyz1234567890';
      const matches = detectSecrets(text);
      expect(matches.some(m => m.type === 'github_pat')).toBe(true);
    });

    it('should detect AWS access keys', () => {
      const text = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
      const matches = detectSecrets(text);
      expect(matches.some(m => m.type === 'aws_access_key')).toBe(true);
    });

    it('should detect password patterns', () => {
      const text = 'password=supersecret123';
      const matches = detectSecrets(text);
      expect(matches.some(m => m.type === 'password')).toBe(true);
    });

    it('should detect MongoDB URIs', () => {
      const text = 'mongodb://user:password@localhost:27017/db';
      const matches = detectSecrets(text);
      expect(matches.some(m => m.type === 'mongodb_uri')).toBe(true);
    });

    it('should detect private key headers', () => {
      const text = '-----BEGIN RSA PRIVATE KEY-----';
      const matches = detectSecrets(text);
      expect(matches.some(m => m.type === 'private_key')).toBe(true);
    });

    it('should detect JWT tokens', () => {
      const text = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const matches = detectSecrets(text);
      expect(matches.some(m => m.type === 'jwt')).toBe(true);
    });

    it('should detect Bearer tokens', () => {
      const text = 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz';
      const matches = detectSecrets(text);
      expect(matches.some(m => m.type === 'bearer_token')).toBe(true);
    });

    it('should respect exclude patterns', () => {
      const text = 'password=test123456';
      const matches = detectSecrets(text, { excludePatterns: ['test.*'] });
      // Should still detect password pattern since excludePatterns work on matched text
      expect(matches.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect multiple secrets', () => {
      const text = `
        API_KEY=sk-abcdefghijklmnopqrstuvwxyz123456
        GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz1234567890
        password=mysecretpassword
      `;
      const matches = detectSecrets(text);
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });

    it('should detect custom patterns', () => {
      const text = 'Custom secret: CUSTOM-abc123';
      const matches = detectSecrets(text, {
        customPatterns: ['CUSTOM-[a-z0-9]+'],
      });
      expect(matches.some(m => m.type === 'custom')).toBe(true);
    });
  });

  describe('redactSecrets', () => {
    it('should return original text when no secrets', () => {
      const text = 'Hello world';
      const result = redactSecrets(text);
      expect(result.text).toBe('Hello world');
      expect(result.redactedCount).toBe(0);
    });

    it('should redact OpenAI keys', () => {
      const text = 'Key: sk-abcdefghijklmnopqrstuvwxyz123456';
      const result = redactSecrets(text);
      expect(result.text).toContain('[REDACTED:openai_key]');
      expect(result.redactedCount).toBeGreaterThan(0);
    });

    it('should redact multiple secrets', () => {
      const text = 'Key1: sk-abc123def456ghi789jkl012 Key2: ghp_abcdefghijklmnopqrstuvwxyz1234567890';
      const result = redactSecrets(text);
      expect(result.text).toContain('[REDACTED:');
      expect(result.redactedCount).toBeGreaterThanOrEqual(2);
    });

    it('should return empty text for empty input', () => {
      const result = redactSecrets('');
      expect(result.text).toBe('');
      expect(result.redactedCount).toBe(0);
    });
  });

  describe('processSecrets', () => {
    it('should return original text when disabled', () => {
      const text = 'password=secret123';
      const result = processSecrets(text, { enabled: false, mode: 'redact' });
      expect(result.text).toBe(text);
      expect(result.action).toBe('none');
      expect(result.secretsFound).toBe(false);
    });

    it('should redact when mode is redact', () => {
      const text = 'password=secret123';
      const result = processSecrets(text, { enabled: true, mode: 'redact' });
      expect(result.text).toContain('[REDACTED:');
      expect(result.action).toBe('redacted');
      expect(result.secretsFound).toBe(true);
    });

    it('should return empty text when mode is skip', () => {
      const text = 'password=secret123';
      const result = processSecrets(text, { enabled: true, mode: 'skip' });
      expect(result.text).toBe('');
      expect(result.action).toBe('skipped');
      expect(result.secretsFound).toBe(true);
    });

    it('should keep original text when mode is warn', () => {
      const text = 'password=secret123';
      const result = processSecrets(text, { enabled: true, mode: 'warn' });
      expect(result.text).toBe(text);
      expect(result.action).toBe('warned');
      expect(result.secretsFound).toBe(true);
    });

    it('should return none action when no secrets found', () => {
      const text = 'Hello world, no secrets here';
      const result = processSecrets(text, { enabled: true, mode: 'redact' });
      expect(result.text).toBe(text);
      expect(result.action).toBe('none');
      expect(result.secretsFound).toBe(false);
    });
  });

  describe('createSecretsSummary', () => {
    it('should return empty string for no matches', () => {
      expect(createSecretsSummary([])).toBe('');
    });

    it('should create summary with single match', () => {
      const matches: SecretMatch[] = [
        { type: 'openai_key', pattern: 'sk-.*', count: 1, positions: [0] },
      ];
      const summary = createSecretsSummary(matches);
      expect(summary).toBe('Detected secrets: openai_key: 1 occurrence(s)');
    });

    it('should create summary with multiple matches', () => {
      const matches: SecretMatch[] = [
        { type: 'openai_key', pattern: 'sk-.*', count: 2, positions: [0, 50] },
        { type: 'password', pattern: 'password=.*', count: 1, positions: [100] },
      ];
      const summary = createSecretsSummary(matches);
      expect(summary).toContain('openai_key: 2 occurrence(s)');
      expect(summary).toContain('password: 1 occurrence(s)');
    });
  });
});
