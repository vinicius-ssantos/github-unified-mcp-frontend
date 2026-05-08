import type { ConsoleAdapter, ConsoleSnapshot, ToolSummary } from '../types/mcp';

const tools: ToolSummary[] = [
  { name: 'server_info', phase: 'Diagnostics', summary: 'Runtime diagnostics and security flags', risk: 'low' },
  { name: 'repo_search_code', phase: 'Repository', summary: 'Search code with fallback scanning', risk: 'low' },
  { name: 'file_get_around', phase: 'Repository', summary: 'Read context around an anchor without full-file fetch', risk: 'low' },
  { name: 'ci_gate_check', phase: 'Actions', summary: 'Evaluate latest relevant workflow runs for a SHA', risk: 'low' },
  { name: 'pr_ready_to_merge', phase: 'Pull Requests', summary: 'Consolidated pre-merge checklist', risk: 'low' },
  { name: 'file_apply_patch', phase: 'Write-safe', summary: 'Apply exact replacements on a PR branch', risk: 'medium' },
  { name: 'pr_merge', phase: 'Dangerous', summary: 'Merge a pull request with CI gate and confirmation', risk: 'high', requiresConfirm: true, requiresDangerous: true },
];

export const mockAdapter: ConsoleAdapter = {
  async loadSnapshot(): Promise<ConsoleSnapshot> {
    return {
      mode: 'mock',
      server: {
        version: '1.2.x',
        tool_schema_version: 'mock-schema',
        commit_sha: 'local-demo',
        uptime_seconds: 14221,
        read_only: false,
        dangerous_tools_enabled: false,
        workflow_dispatch_enabled: false,
        tool_count: tools.length,
        tool_names: tools.map((tool) => tool.name),
      },
      tools,
      warnings: ['Mock mode: no GitHub token or destructive operation is used in the browser.'],
    };
  },
};
