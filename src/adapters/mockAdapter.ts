import type { ConsoleAdapter, ConsoleSnapshot, ToolSummary, VercelCredentials, VercelDeployResult, VercelDeployStatus, VercelPlan } from '../types/mcp';

const tools: ToolSummary[] = [
  { name: 'server_info', phase: 'Diagnostics', summary: 'Runtime diagnostics and security flags', risk: 'low' },
  { name: 'repo_search_code', phase: 'Repository', summary: 'Search code with fallback scanning', risk: 'low' },
  { name: 'file_get_around', phase: 'Repository', summary: 'Read context around an anchor without full-file fetch', risk: 'low' },
  { name: 'ci_gate_check', phase: 'Actions', summary: 'Evaluate latest relevant workflow runs for a SHA', risk: 'low' },
  { name: 'pr_ready_to_merge', phase: 'Pull Requests', summary: 'Consolidated pre-merge checklist', risk: 'low' },
  { name: 'file_apply_patch', phase: 'Write-safe', summary: 'Apply exact replacements on a PR branch', risk: 'medium' },
  { name: 'pr_merge', phase: 'Dangerous', summary: 'Merge a pull request with CI gate and confirmation', risk: 'high', requiresConfirm: true, requiresDangerous: true },
];

const mockVercelCredentials: VercelCredentials = {
  valid: true,
  user: 'demo-user',
  team: 'demo-team',
};

const mockVercelPlan = (args: Record<string, unknown>): VercelPlan => ({
  project_name: String(args.project_name ?? 'deploy-orchestrator-mcp-frontend'),
  github_repo: String(args.github_repo ?? 'vinicius-ssantos/github-unified-mcp-frontend'),
  branch: String(args.branch ?? 'main'),
  framework: String(args.framework ?? 'vite'),
  build_command: String(args.build_command ?? 'npm run build'),
  output_dir: String(args.output_dir ?? 'dist'),
  public_env_check: {
    found: ['VITE_MCP_URL'],
    warnings: ['VITE_MCP_URL may expose internal endpoint — review before deploying to production.'],
  },
});

const mockVercelDeployResult: VercelDeployResult = {
  deployment_id: 'dpl_mock_abc123',
  url: 'https://deploy-orchestrator-mcp-frontend-abc123.vercel.app',
  status: 'BUILDING',
};

const mockVercelStatus: VercelDeployStatus = {
  id: 'dpl_mock_abc123',
  status: 'READY',
  url: 'https://deploy-orchestrator-mcp-frontend-abc123.vercel.app',
  preview_url: 'https://deploy-orchestrator-mcp-frontend-abc123.vercel.app',
};

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

  async callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, 600));
    switch (name) {
      case 'vercel_validate_credentials': return mockVercelCredentials as T;
      case 'vercel_project_plan': return mockVercelPlan(args) as T;
      case 'vercel_deploy_preview': return mockVercelDeployResult as T;
      case 'vercel_get_deploy_status': return mockVercelStatus as T;
      default: throw new Error(`Mock: unknown tool "${name}"`);
    }
  },
};
