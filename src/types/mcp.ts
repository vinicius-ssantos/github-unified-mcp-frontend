export type RiskLevel = 'low' | 'medium' | 'high';

export type ToolEntry = {
  name: string;
  summary: string;
  risk: RiskLevel;
  requiresConfirm?: boolean;
  requiresDangerous?: boolean;
  requiresWorkflowDispatch?: boolean;
  planned?: boolean;
};

export type ToolGroup = {
  phase: string;
  description: string;
  tools: ToolEntry[];
};

export type ToolFlatEntry = ToolEntry & { phase: string };

export type ToolInput = {
  name: string;
  type: string;
  required: boolean;
  note?: string;
  default?: string;
};

export type ToolSchema = {
  inputs: ToolInput[];
  example: { name: string; arguments: Record<string, unknown> };
  returns: string;
};

export type HealthzResponse = {
  ok: boolean;
  service: string;
  version: string;
  tool_schema_version: string;
  commit_sha: string;
  uptime_seconds: number;
};

export type ServerInfoFlags = {
  read_only: boolean;
  dangerous_tools_enabled: boolean;
  workflow_dispatch_enabled: boolean;
  require_allowed_repos: boolean;
  protected_branches_configured: boolean;
  oauth_redirect_allowlist_configured: boolean;
  oauth_rate_limit_enabled: boolean;
  tool_catalog_refresh_supported: boolean;
  allowed_repos_configured: boolean;
  classic_pat_for_projects_configured: boolean;
};

export type ServerState = {
  label: string;
  healthz: HealthzResponse;
  server_info: ServerInfoFlags;
  posture: 'safe' | 'balanced' | 'elevated';
};

export type RateLimit = {
  endpoint: string;
  used: number;
  max: number;
  window: number;
};

export type AuditEvent = {
  ts: string;
  actor: string;
  tool: string;
  target: string;
  decision: string;
  level: 'info' | 'warn' | 'error';
  reason?: string;
};

export type EnvConfig = {
  GITHUB_ALLOWED_REPOS: string[];
  GITHUB_PROTECTED_BRANCHES: string[];
  GITHUB_DESTRUCTIVE_CONFIRMATION: string;
  FASTMCP_PORT: number;
  FASTMCP_ALLOWED_HOSTS: string[];
  FASTMCP_ALLOWED_ORIGINS: string[];
  MCP_OAUTH_RATE_LIMIT_WINDOW_SECONDS: number;
  MCP_OAUTH_RATE_LIMIT_MAX_REQUESTS: number;
  MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS: number;
};

export type DriftInfo = {
  newTools: string[];
  missingTools: string[];
  demo: boolean;
};

export type BffAuditEvent = {
  id: number;
  ts: string;
  user: string;
  tool: string;
  args_hash: string;
  result_ok: boolean;
  ip: string;
  duration_ms: number;
};

export type BffUser = {
  user: string;
  name: string;
  role: 'viewer' | 'operator' | 'admin';
};

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
