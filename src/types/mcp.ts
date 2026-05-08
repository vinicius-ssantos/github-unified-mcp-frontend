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

export type ConsoleAdapter = {
  loadSnapshot(): Promise<ConsoleSnapshot>;
};
