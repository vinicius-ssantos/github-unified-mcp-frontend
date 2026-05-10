export type RiskLevel = 'low' | 'medium' | 'high';

export type ToolSummary = {
  name: string;
  phase: string;
  summary: string;
  risk: RiskLevel;
  requiresConfirm?: boolean;
  requiresDangerous?: boolean;
};

export type HealthStatus = {
  ok: boolean;
  status: 'healthy' | 'degraded' | 'unreachable';
  source: '/healthz' | 'mock' | 'fallback';
  detail?: string;
};

export type RuntimeMode = 'read_only' | 'write_safe' | 'operator' | 'unknown';

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
  allowed_repos_count?: number;
  protected_branches_count?: number;
  oauth_redirect_strict?: boolean;
  rate_limit_enabled?: boolean;
};

export type RuntimePosture = {
  mode: RuntimeMode;
  health: HealthStatus;
  safety_flags: Array<{ label: string; value: string; state: 'safe' | 'warning' | 'danger' | 'unknown' }>;
};

export type ConsoleSnapshot = {
  mode: 'mock' | 'live';
  server: ServerInfo;
  posture: RuntimePosture;
  tools: ToolSummary[];
  warnings: string[];
};

export type ConsoleAdapter = {
  loadSnapshot(): Promise<ConsoleSnapshot>;
};
