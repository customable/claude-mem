/**
 * Tests for path-utils (Issue #297)
 */

import { describe, it, expect } from 'vitest';
import { isLikelyFile, normalizeToDirectory, CODE_EXTENSIONS } from '../utils/path-utils.js';

describe('path-utils', () => {
  describe('isLikelyFile', () => {
    it('should return true for TypeScript files', () => {
      expect(isLikelyFile('/path/to/file.ts')).toBe(true);
      expect(isLikelyFile('/path/to/file.tsx')).toBe(true);
    });

    it('should return true for JavaScript files', () => {
      expect(isLikelyFile('/path/to/file.js')).toBe(true);
      expect(isLikelyFile('/path/to/file.jsx')).toBe(true);
      expect(isLikelyFile('/path/to/file.mjs')).toBe(true);
      expect(isLikelyFile('/path/to/file.cjs')).toBe(true);
    });

    it('should return true for common code files', () => {
      expect(isLikelyFile('/path/to/file.py')).toBe(true);
      expect(isLikelyFile('/path/to/file.go')).toBe(true);
      expect(isLikelyFile('/path/to/file.rs')).toBe(true);
      expect(isLikelyFile('/path/to/file.java')).toBe(true);
      expect(isLikelyFile('/path/to/file.c')).toBe(true);
      expect(isLikelyFile('/path/to/file.cpp')).toBe(true);
    });

    it('should return true for config/data files', () => {
      expect(isLikelyFile('/path/to/file.json')).toBe(true);
      expect(isLikelyFile('/path/to/file.yaml')).toBe(true);
      expect(isLikelyFile('/path/to/file.yml')).toBe(true);
      expect(isLikelyFile('/path/to/file.toml')).toBe(true);
      expect(isLikelyFile('/path/to/file.xml')).toBe(true);
    });

    it('should return true for markdown files', () => {
      expect(isLikelyFile('/path/to/README.md')).toBe(true);
      expect(isLikelyFile('/path/to/CLAUDE.md')).toBe(true);
    });

    it('should return true for style files', () => {
      expect(isLikelyFile('/path/to/file.css')).toBe(true);
      expect(isLikelyFile('/path/to/file.scss')).toBe(true);
      expect(isLikelyFile('/path/to/file.less')).toBe(true);
    });

    it('should return true for frontend framework files', () => {
      expect(isLikelyFile('/path/to/component.vue')).toBe(true);
      expect(isLikelyFile('/path/to/component.svelte')).toBe(true);
    });

    it('should return false for directories (no extension)', () => {
      expect(isLikelyFile('/path/to/directory')).toBe(false);
      expect(isLikelyFile('/path/to/src')).toBe(false);
      expect(isLikelyFile('/home/user/repos/project')).toBe(false);
    });

    it('should return false for extensionless files', () => {
      expect(isLikelyFile('/path/to/Makefile')).toBe(false);
      expect(isLikelyFile('/path/to/Dockerfile')).toBe(false);
      expect(isLikelyFile('/path/to/.gitignore')).toBe(false);
    });

    it('should be case-insensitive for extensions', () => {
      expect(isLikelyFile('/path/to/file.TS')).toBe(true);
      expect(isLikelyFile('/path/to/file.TSX')).toBe(true);
      expect(isLikelyFile('/path/to/file.JSON')).toBe(true);
    });

    it('should handle paths from the issue examples', () => {
      // From Issue #297: affected paths
      expect(isLikelyFile('/home/jonas/repos/claude-mem/packages/ui/src/App.tsx')).toBe(true);
      expect(isLikelyFile('/home/jonas/repos/claude-mem/packages/websocket/task-dispatcher.ts')).toBe(true);
      expect(isLikelyFile('/home/jonas/repos/claude-mem/packages/types/src/repository.ts')).toBe(true);
    });
  });

  describe('normalizeToDirectory', () => {
    it('should return parent directory for file paths', () => {
      expect(normalizeToDirectory('/path/to/file.ts')).toBe('/path/to');
      expect(normalizeToDirectory('/path/to/file.tsx')).toBe('/path/to');
      expect(normalizeToDirectory('/path/to/file.js')).toBe('/path/to');
    });

    it('should return same path for directories', () => {
      expect(normalizeToDirectory('/path/to/directory')).toBe('/path/to/directory');
      expect(normalizeToDirectory('/path/to/src')).toBe('/path/to/src');
    });

    it('should handle nested file paths', () => {
      expect(normalizeToDirectory('/home/user/project/src/components/Button.tsx'))
        .toBe('/home/user/project/src/components');
    });

    it('should handle paths from the issue examples', () => {
      // From Issue #297: expected corrections
      expect(normalizeToDirectory('/home/jonas/repos/claude-mem/packages/ui/src/App.tsx'))
        .toBe('/home/jonas/repos/claude-mem/packages/ui/src');
      expect(normalizeToDirectory('/home/jonas/repos/claude-mem/packages/websocket/task-dispatcher.ts'))
        .toBe('/home/jonas/repos/claude-mem/packages/websocket');
      expect(normalizeToDirectory('/home/jonas/repos/claude-mem/packages/types/src/repository.ts'))
        .toBe('/home/jonas/repos/claude-mem/packages/types/src');
    });

    it('should preserve absolute paths', () => {
      const result = normalizeToDirectory('/absolute/path/to/file.ts');
      expect(result).toBe('/absolute/path/to');
      expect(result.startsWith('/')).toBe(true);
    });

    it('should handle relative paths', () => {
      expect(normalizeToDirectory('./src/file.ts')).toBe('./src');
      expect(normalizeToDirectory('../file.ts')).toBe('..');
    });
  });

  describe('CODE_EXTENSIONS', () => {
    it('should include common TypeScript/JavaScript extensions', () => {
      expect(CODE_EXTENSIONS).toContain('.ts');
      expect(CODE_EXTENSIONS).toContain('.tsx');
      expect(CODE_EXTENSIONS).toContain('.js');
      expect(CODE_EXTENSIONS).toContain('.jsx');
      expect(CODE_EXTENSIONS).toContain('.mjs');
      expect(CODE_EXTENSIONS).toContain('.cjs');
    });

    it('should include common backend language extensions', () => {
      expect(CODE_EXTENSIONS).toContain('.py');
      expect(CODE_EXTENSIONS).toContain('.go');
      expect(CODE_EXTENSIONS).toContain('.rs');
      expect(CODE_EXTENSIONS).toContain('.java');
      expect(CODE_EXTENSIONS).toContain('.rb');
      expect(CODE_EXTENSIONS).toContain('.php');
    });

    it('should include config file extensions', () => {
      expect(CODE_EXTENSIONS).toContain('.json');
      expect(CODE_EXTENSIONS).toContain('.yaml');
      expect(CODE_EXTENSIONS).toContain('.yml');
      expect(CODE_EXTENSIONS).toContain('.toml');
      expect(CODE_EXTENSIONS).toContain('.xml');
    });

    it('should include style file extensions', () => {
      expect(CODE_EXTENSIONS).toContain('.css');
      expect(CODE_EXTENSIONS).toContain('.scss');
      expect(CODE_EXTENSIONS).toContain('.less');
    });

    it('should include frontend framework extensions', () => {
      expect(CODE_EXTENSIONS).toContain('.vue');
      expect(CODE_EXTENSIONS).toContain('.svelte');
    });
  });
});
