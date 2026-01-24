/**
 * Secret Detection Utility
 *
 * Detects and optionally redacts sensitive information like API keys,
 * passwords, and tokens in text content.
 */

/**
 * Result of a secret detection scan
 */
export interface SecretMatch {
  type: string;
  pattern: string;
  count: number;
  // Original positions for audit (not the actual secrets)
  positions: number[];
}

/**
 * Configuration for secret detection
 */
export interface SecretDetectorConfig {
  /** Enable/disable detection */
  enabled: boolean;
  /** What to do when secrets are found: 'redact' | 'skip' | 'warn' */
  mode: 'redact' | 'skip' | 'warn';
  /** Custom patterns to add (regex strings) */
  customPatterns?: string[];
  /** Patterns to exclude (regex strings) */
  excludePatterns?: string[];
  /** Minimum entropy threshold for high-entropy detection */
  entropyThreshold?: number;
  /** Enable entropy-based detection */
  entropyEnabled?: boolean;
}

/**
 * Default secret patterns
 */
export const SECRET_PATTERNS: { type: string; pattern: RegExp }[] = [
  // API Keys - Common Providers
  { type: 'openai_key', pattern: /sk-[a-zA-Z0-9]{20,}/g },
  { type: 'anthropic_key', pattern: /sk-ant-[a-zA-Z0-9-]{20,}/g },
  { type: 'mistral_key', pattern: /[a-zA-Z0-9]{32}/g },

  // AWS
  { type: 'aws_access_key', pattern: /AKIA[0-9A-Z]{16}/g },
  { type: 'aws_secret', pattern: /aws_secret_access_key\s*[=:]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/gi },

  // GitHub/GitLab
  { type: 'github_pat', pattern: /ghp_[a-zA-Z0-9]{36}/g },
  { type: 'github_oauth', pattern: /gho_[a-zA-Z0-9]{36}/g },
  { type: 'gitlab_pat', pattern: /glpat-[a-zA-Z0-9-]{20}/g },

  // Generic Passwords
  { type: 'password', pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"]?[^\s'"]{4,}['"]?/gi },
  { type: 'secret', pattern: /(?:secret|token)\s*[=:]\s*['"]?[^\s'"]{8,}['"]?/gi },

  // Connection Strings
  { type: 'mongodb_uri', pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@[^\s]+/gi },
  { type: 'postgres_uri', pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^\s]+/gi },
  { type: 'mysql_uri', pattern: /mysql:\/\/[^:]+:[^@]+@[^\s]+/gi },
  { type: 'redis_uri', pattern: /redis:\/\/[^:]+:[^@]+@[^\s]+/gi },

  // Private Keys
  { type: 'private_key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },

  // JWT Tokens (only match if they look complete)
  { type: 'jwt', pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g },

  // Environment variable patterns
  { type: 'env_api_key', pattern: /[A-Z_]+_API_KEY\s*[=:]\s*['"]?[^\s'"]{8,}['"]?/g },
  { type: 'env_secret', pattern: /[A-Z_]+_SECRET\s*[=:]\s*['"]?[^\s'"]{8,}['"]?/g },
  { type: 'env_token', pattern: /[A-Z_]+_TOKEN\s*[=:]\s*['"]?[^\s'"]{8,}['"]?/g },

  // Bearer tokens
  { type: 'bearer_token', pattern: /Bearer\s+[a-zA-Z0-9_-]{20,}/g },

  // Basic Auth
  { type: 'basic_auth', pattern: /Basic\s+[a-zA-Z0-9+/=]{20,}/g },
];

/**
 * Calculate Shannon entropy of a string
 * Higher entropy suggests random/generated content like keys
 */
export function calculateEntropy(str: string): number {
  if (!str || str.length === 0) return 0;

  const freq = new Map<string, number>();
  for (const char of str) {
    freq.set(char, (freq.get(char) || 0) + 1);
  }

  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Check if a string has high entropy (likely a secret)
 */
export function hasHighEntropy(str: string, threshold = 4.0): boolean {
  // Only check strings that look like potential secrets
  if (str.length < 16 || str.length > 256) return false;

  // Skip if it contains too many spaces (likely natural text)
  if ((str.match(/\s/g) || []).length > str.length * 0.1) return false;

  return calculateEntropy(str) > threshold;
}

/**
 * Detect secrets in text
 */
export function detectSecrets(
  text: string,
  config?: Partial<SecretDetectorConfig>
): SecretMatch[] {
  if (!text) return [];

  const matches: SecretMatch[] = [];
  const excludePatterns = (config?.excludePatterns || []).map(p => new RegExp(p, 'g'));

  // Check against predefined patterns
  for (const { type, pattern } of SECRET_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;

    const found: number[] = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Check if this match should be excluded
      const matchText = match[0];
      const shouldExclude = excludePatterns.some(ep => {
        ep.lastIndex = 0;
        return ep.test(matchText);
      });

      if (!shouldExclude) {
        found.push(match.index);
      }
    }

    if (found.length > 0) {
      matches.push({
        type,
        pattern: pattern.source,
        count: found.length,
        positions: found,
      });
    }
  }

  // Check custom patterns
  if (config?.customPatterns) {
    for (const patternStr of config.customPatterns) {
      try {
        const pattern = new RegExp(patternStr, 'g');
        const found: number[] = [];
        let match;
        while ((match = pattern.exec(text)) !== null) {
          found.push(match.index);
        }

        if (found.length > 0) {
          matches.push({
            type: 'custom',
            pattern: patternStr,
            count: found.length,
            positions: found,
          });
        }
      } catch {
        // Invalid regex, skip
      }
    }
  }

  return matches;
}

/**
 * Redact secrets in text
 */
export function redactSecrets(
  text: string,
  config?: Partial<SecretDetectorConfig>
): { text: string; redactedCount: number; matches: SecretMatch[] } {
  if (!text) return { text: '', redactedCount: 0, matches: [] };

  const matches = detectSecrets(text, config);
  let redacted = text;
  let redactedCount = 0;

  // Sort matches by position (descending) to replace from end to start
  const allPositions: { pos: number; type: string; pattern: RegExp }[] = [];

  for (const { type, pattern } of SECRET_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      allPositions.push({
        pos: match.index,
        type,
        pattern: new RegExp(pattern.source, pattern.flags),
      });
    }
  }

  // Redact using patterns
  for (const { type, pattern } of SECRET_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const before = redacted;
    redacted = redacted.replace(regex, `[REDACTED:${type}]`);
    if (before !== redacted) {
      redactedCount += (before.match(regex) || []).length;
    }
  }

  // Redact custom patterns
  if (config?.customPatterns) {
    for (const patternStr of config.customPatterns) {
      try {
        const pattern = new RegExp(patternStr, 'g');
        const before = redacted;
        redacted = redacted.replace(pattern, '[REDACTED:custom]');
        if (before !== redacted) {
          redactedCount += (before.match(pattern) || []).length;
        }
      } catch {
        // Invalid regex, skip
      }
    }
  }

  return { text: redacted, redactedCount, matches };
}

/**
 * Process text according to config
 * Returns the processed text and metadata about any secrets found
 */
export function processSecrets(
  text: string,
  config: SecretDetectorConfig
): {
  text: string;
  secretsFound: boolean;
  matches: SecretMatch[];
  action: 'none' | 'redacted' | 'skipped' | 'warned';
} {
  if (!config.enabled || !text) {
    return { text, secretsFound: false, matches: [], action: 'none' };
  }

  const matches = detectSecrets(text, config);
  const secretsFound = matches.length > 0;

  if (!secretsFound) {
    return { text, secretsFound: false, matches: [], action: 'none' };
  }

  switch (config.mode) {
    case 'redact': {
      const result = redactSecrets(text, config);
      return {
        text: result.text,
        secretsFound: true,
        matches: result.matches,
        action: 'redacted',
      };
    }
    case 'skip':
      return {
        text: '',
        secretsFound: true,
        matches,
        action: 'skipped',
      };
    case 'warn':
    default:
      return {
        text,
        secretsFound: true,
        matches,
        action: 'warned',
      };
  }
}

/**
 * Create a summary of detected secrets for logging (without exposing actual values)
 */
export function createSecretsSummary(matches: SecretMatch[]): string {
  if (matches.length === 0) return '';

  const summary = matches
    .map(m => `${m.type}: ${m.count} occurrence(s)`)
    .join(', ');

  return `Detected secrets: ${summary}`;
}
