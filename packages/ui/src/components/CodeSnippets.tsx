/**
 * Code Snippets Component
 *
 * Displays extracted code snippets for an observation.
 * Supports syntax highlighting and copy functionality.
 */

import { useState, useEffect } from 'react';
import { api, type CodeSnippet } from '../api/client';

interface Props {
  observationId: number;
  project?: string;
}

// Language display names and colors
const LANGUAGE_CONFIG: Record<string, { name: string; color: string }> = {
  javascript: { name: 'JavaScript', color: 'bg-yellow-500' },
  typescript: { name: 'TypeScript', color: 'bg-blue-500' },
  python: { name: 'Python', color: 'bg-green-500' },
  rust: { name: 'Rust', color: 'bg-orange-500' },
  go: { name: 'Go', color: 'bg-cyan-500' },
  java: { name: 'Java', color: 'bg-red-500' },
  csharp: { name: 'C#', color: 'bg-purple-500' },
  cpp: { name: 'C++', color: 'bg-pink-500' },
  c: { name: 'C', color: 'bg-gray-500' },
  ruby: { name: 'Ruby', color: 'bg-red-400' },
  php: { name: 'PHP', color: 'bg-indigo-500' },
  swift: { name: 'Swift', color: 'bg-orange-400' },
  kotlin: { name: 'Kotlin', color: 'bg-violet-500' },
  sql: { name: 'SQL', color: 'bg-blue-400' },
  html: { name: 'HTML', color: 'bg-orange-600' },
  css: { name: 'CSS', color: 'bg-blue-600' },
  json: { name: 'JSON', color: 'bg-gray-400' },
  yaml: { name: 'YAML', color: 'bg-gray-400' },
  markdown: { name: 'Markdown', color: 'bg-gray-500' },
  bash: { name: 'Bash', color: 'bg-gray-600' },
  shell: { name: 'Shell', color: 'bg-gray-600' },
};

function getLanguageConfig(language: string | null) {
  if (!language) return { name: 'Code', color: 'bg-gray-500' };
  return LANGUAGE_CONFIG[language.toLowerCase()] || { name: language, color: 'bg-gray-500' };
}

function CodeBlock({ snippet }: { snippet: CodeSnippet }) {
  const [copied, setCopied] = useState(false);
  const langConfig = getLanguageConfig(snippet.language);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="border border-base-300 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-base-200 border-b border-base-300">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${langConfig.color}`} />
          <span className="text-xs font-medium text-base-content/70">{langConfig.name}</span>
          {snippet.file_path && (
            <span className="text-xs text-base-content/50 font-mono truncate max-w-xs" title={snippet.file_path}>
              {snippet.file_path.split('/').pop()}
            </span>
          )}
          {snippet.line_start && (
            <span className="text-xs text-base-content/50">
              L{snippet.line_start}{snippet.line_end && snippet.line_end !== snippet.line_start ? `-${snippet.line_end}` : ''}
            </span>
          )}
        </div>
        <button
          onClick={copyToClipboard}
          className="btn btn-ghost btn-xs gap-1"
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <span className="iconify ph--check size-3.5 text-success" />
              <span className="text-success">Copied</span>
            </>
          ) : (
            <>
              <span className="iconify ph--copy size-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <pre className="p-3 overflow-x-auto bg-base-100 text-sm">
        <code className="font-mono text-base-content/90 whitespace-pre">{snippet.code}</code>
      </pre>

      {/* Context (if available) */}
      {snippet.context && (
        <div className="px-3 py-1.5 bg-base-200 border-t border-base-300">
          <span className="text-xs text-base-content/50">{snippet.context}</span>
        </div>
      )}
    </div>
  );
}

export function CodeSnippets({ observationId }: Props) {
  const [snippets, setSnippets] = useState<CodeSnippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchSnippets() {
      try {
        setLoading(true);
        const data = await api.getObservationCodeSnippets(observationId);
        if (!cancelled) {
          setSnippets(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load code snippets');
          console.error('Error fetching code snippets:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchSnippets();

    return () => {
      cancelled = true;
    };
  }, [observationId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-base-content/50">
        <span className="loading loading-spinner loading-xs" />
        Loading code snippets...
      </div>
    );
  }

  if (error) {
    return null; // Silently fail - code snippets are optional
  }

  if (snippets.length === 0) {
    return null; // Don't show section if no snippets
  }

  const displaySnippets = expanded ? snippets : snippets.slice(0, 2);

  return (
    <div>
      <div className="text-xs font-medium text-base-content/60 uppercase tracking-wide mb-2 flex items-center gap-1">
        <span className="iconify ph--code size-3" />
        Code Snippets ({snippets.length})
      </div>
      <div className="space-y-3">
        {displaySnippets.map((snippet) => (
          <CodeBlock key={snippet.id} snippet={snippet} />
        ))}
        {snippets.length > 2 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="btn btn-ghost btn-xs w-full"
          >
            Show {snippets.length - 2} more snippets
          </button>
        )}
        {expanded && snippets.length > 2 && (
          <button
            onClick={() => setExpanded(false)}
            className="btn btn-ghost btn-xs w-full"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}
