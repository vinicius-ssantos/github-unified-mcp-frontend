export type RiskLevel = 'low' | 'medium' | 'high';

export type ToolSummary = {
  name: string;
  phase: string;
  summary: string;
  risk: RiskLevel;
  requiresConfirm?: boolean;
  requiresDangerous?: boolean;
};

export type ServerInfo = {
  version: string;
  tool_schema_version: string;
  commit_sha: string;
  uptime_seconds: number;
  read_only?: boolean;
  dangerous_tools_enabled?: boolean;
  workflow_dispatch_enabled?: boolean;
  tool_count?: number;
  tool_names?: string[];
};

export type ConsoleSnapshot = {
  mode: 'mock' | 'live';
  server: ServerInfo;
  tools: ToolSummary[];
  warnings: string[];
};

// Vercel deploy types
export type VercelCredentials = {
  valid: boolean;
  user?: string;
  team?: string;
  error?: string;
};

export type VercelEnvCheck = {
  found: string[];
  warnings: string[];
};

export type VercelPlan = {
  project_name: string;
  github_repo: string;
  branch: string;
  framework: string;
  build_command: string;
  output_dir: string;
  public_env_check: VercelEnvCheck;
};

export type VercelDeployResult = {
  deployment_id: string;
  url: string;
  status: string;
  error?: string;
};

export type VercelDeployStatus = {
  id: string;
  status: 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';
  url?: string;
  preview_url?: string;
  error?: string;
};

export type ConsoleAdapter = {
  loadSnapshot(): Promise<ConsoleSnapshot>;
  callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T>;
};
