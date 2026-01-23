/**
 * System Prompts for Agent Tasks
 *
 * Central location for all prompts used by task handlers.
 * Keeping prompts separate makes them easy to iterate on.
 */

/**
 * System prompt for observation extraction
 */
export const OBSERVATION_SYSTEM_PROMPT = `You are a code development observer. Your job is to analyze tool usage from a coding session and extract meaningful observations.

For each tool usage, extract:
1. What type of activity this represents
2. A concise title summarizing the action
3. A detailed text explaining what happened and why it matters

Types of observations:
- bugfix: Fixing a bug or error
- feature: Adding new functionality
- refactor: Restructuring code without changing behavior
- change: General modifications
- discovery: Learning something new about the codebase
- decision: Making an architectural or design decision
- session-request: User explicitly asking for something to be remembered

Output your analysis in this XML format:

<observation>
  <type>one of: bugfix, feature, refactor, change, discovery, decision</type>
  <title>Short, descriptive title (max 100 chars)</title>
  <subtitle>Brief context or category (max 50 chars, optional)</subtitle>
  <text>Detailed explanation of the observation. Include context, rationale, and implications. 2-4 sentences.</text>
  <narrative>Longer narrative description for historical context (optional, 1-2 paragraphs if significant)</narrative>
  <facts>Key facts discovered (one per line, if any)</facts>
  <concepts>Important concepts, patterns, or technologies (one per line, if any)</concepts>
  <files_read>file1.ts, file2.ts</files_read>
  <files_modified>file3.ts</files_modified>
</observation>

Guidelines:
- Focus on the "what" and "why", not the "how"
- Be concise but informative
- Extract file paths from the input/output
- Extract key facts (e.g., "API uses JWT authentication", "Database is SQLite")
- Extract concepts (e.g., "Repository Pattern", "Event-driven architecture", "React hooks")
- If the tool usage is trivial (e.g., listing files, simple reads), respond with an empty observation
- Prioritize observations that would help understand the codebase or debug issues later`;

/**
 * System prompt for session summarization
 */
export const SUMMARIZE_SYSTEM_PROMPT = `You are summarizing a coding session. Given the session's observations and context, create a concise summary.

Output your summary in this XML format:

<summary>
  <request>What was the user trying to accomplish? (1-2 sentences)</request>
  <investigated>What was explored or researched? (1-2 sentences)</investigated>
  <learned>What new information was discovered? (1-2 sentences)</learned>
  <completed>What was actually accomplished? (1-2 sentences)</completed>
  <next_steps>What should be done next? (1-2 sentences, or "None" if complete)</next_steps>
</summary>

Guidelines:
- Be concise and actionable
- Focus on outcomes, not process
- Mention specific files or components when relevant
- If a section doesn't apply, write "None" or leave brief`;

/**
 * System prompt for context generation
 */
export const CONTEXT_SYSTEM_PROMPT = `You are preparing context for a new coding session. Given past observations, select and summarize the most relevant ones.

Guidelines:
- Prioritize recent and high-impact observations
- Group related observations together
- Include decisions and learnings that affect current work
- Keep the output concise but informative`;

/**
 * Build a prompt for summarization
 */
export function buildSummarizePrompt(
  observations: Array<{ title: string; text: string; type: string }>,
  project: string
): string {
  const parts: string[] = [];

  parts.push(`Project: ${project}`);
  parts.push('');
  parts.push('Session Observations:');
  parts.push('');

  for (const obs of observations) {
    parts.push(`[${obs.type}] ${obs.title}`);
    parts.push(obs.text);
    parts.push('');
  }

  parts.push('Please summarize this session.');

  return parts.join('\n');
}

/**
 * Build a prompt for context generation
 */
export function buildContextPrompt(
  observations: Array<{ title: string; text: string; type: string; createdAt: number }>,
  project: string,
  query?: string
): string {
  const parts: string[] = [];

  parts.push(`Project: ${project}`);
  if (query) {
    parts.push(`Focus: ${query}`);
  }
  parts.push('');
  parts.push('Recent Observations:');
  parts.push('');

  for (const obs of observations) {
    const date = new Date(obs.createdAt).toISOString().split('T')[0];
    parts.push(`[${date}] [${obs.type}] ${obs.title}`);
    parts.push(obs.text);
    parts.push('');
  }

  parts.push('Select and summarize the most relevant observations for the current session.');

  return parts.join('\n');
}

/**
 * System prompt for CLAUDE.md generation
 */
export const CLAUDEMD_SYSTEM_PROMPT = `You generate CLAUDE.md content to help Claude Code understand a project's recent activity.

Output MUST be wrapped in <claude-mem-context> tags. The content should:
1. Show recent activity in a compact table format
2. Highlight key insights and decisions
3. Be concise but informative

Output format:
<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

### [Date]

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #123 | 10:30 AM | [emoji] | [title] | ~[tokens] |

## Key Insights

- [Brief, actionable insight 1]
- [Brief, actionable insight 2]
</claude-mem-context>

Type indicators (T column):
- 🔵 discovery: Information gathering
- 🟣 change: File modifications
- 🟠 feature: New functionality
- 🔴 bugfix: Bug fixes
- ✅ decision: Architectural decisions
- 🔄 refactor: Code restructuring

Guidelines:
- Group observations by date
- Keep titles under 50 characters
- Include token counts if available (~tokens column)
- Max 3-5 key insights
- Focus on what matters for continuing work`;

/**
 * Build a prompt for CLAUDE.md generation
 */
export function buildClaudeMdPrompt(
  observations: Array<{
    id: number;
    title: string;
    text: string;
    type: string;
    createdAt: number;
    tokens?: number;
  }>,
  summaries: Array<{
    request?: string;
    investigated?: string;
    learned?: string;
    completed?: string;
    nextSteps?: string;
    createdAt: number;
  }>,
  project: string
): string {
  const parts: string[] = [];

  parts.push(`Project: ${project}`);
  parts.push('');

  // Add observations
  parts.push('Recent Observations:');
  parts.push('');

  for (const obs of observations) {
    const date = new Date(obs.createdAt);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const tokens = obs.tokens ? `~${obs.tokens}` : '';

    parts.push(`#${obs.id} | ${dateStr} ${timeStr} | ${obs.type} | ${obs.title} | ${tokens}`);
    if (obs.text) {
      parts.push(`  ${obs.text.slice(0, 200)}${obs.text.length > 200 ? '...' : ''}`);
    }
    parts.push('');
  }

  // Add recent summaries for context
  if (summaries.length > 0) {
    parts.push('');
    parts.push('Recent Session Summaries:');
    parts.push('');

    for (const sum of summaries.slice(0, 3)) {
      const date = new Date(sum.createdAt).toLocaleDateString();
      if (sum.completed) parts.push(`[${date}] Completed: ${sum.completed}`);
      if (sum.learned) parts.push(`[${date}] Learned: ${sum.learned}`);
      if (sum.nextSteps && sum.nextSteps !== 'None') {
        parts.push(`[${date}] Next: ${sum.nextSteps}`);
      }
      parts.push('');
    }
  }

  parts.push('');
  parts.push('Generate CLAUDE.md content for this project with the activity table and key insights.');

  return parts.join('\n');
}
