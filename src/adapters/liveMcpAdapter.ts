import type { ConsoleAdapter, ConsoleSnapshot, HealthStatus, RuntimeMode, RuntimePosture, ServerInfo, ToolSummary } from '../types/mcp';

type McpResponse<T> = { result?: { content?: Array<{ type: string; text?: string }> } | T; error?: unknown };

const inferRisk = (name: string): ToolSummary['risk'] => {
  if (name.includes('merge') || name.includes('delete') || name.includes('dismiss') || name.includes('update_ref')) return 'high';
  if (name.includes('create') || name.includes('update') || name.includes('apply')) return 'medium';
  return 'low';
};

const phaseFor = (name: string): string => {
  if (name.startsWith('pr_') || name.includes('review')) return 'Pull Requests';
  if (name.startsWith('actions_') || name.includes('ci_')) return 'Actions';
  if (name.startsWith('repo_') || name.startsWith('file_') || name.startsWith('git_')) return 'Repository';
  if (name.startsWith('project_')) return 'Projects';
  if (name.includes('server') || name.includes('github_get_me')) return 'Diagnostics';
  return 'Tools';
};

const parseMcpResult = <T>(payload: McpResponse<T>): T => {
  const content = (payload.result as { content?: Array<{ type: string; text?: string }> } | undefined)?.content;
  const text = Array.isArray(content) ? content[0]?.text : undefined;
  return (text ? JSON.parse(text) : payload.result) as T;
};

const resolveMode = (server: ServerInfo): RuntimeMode => {
  if (server.read_only) return 'read_only';
  if (server.dangerous_tools_enabled) return 'operator';
  if (server.workflow_dispatch_enabled) return 'write_safe';
  return 'unknown';
};

const stateFromFlag = (safe: boolean | undefined, dangerOnTrue = false): RuntimePosture['safety_flags'][number]['state'] => {
  if (safe === undefined) return 'unknown';
  if (dangerOnTrue) return safe ? 'danger' : 'safe';
  return safe ? 'safe' : 'warning';
};

const buildPosture = (server: ServerInfo, health: HealthStatus): RuntimePosture => {
  const mode = resolveMode(server);

  return {
    mode,
    health,
    safety_flags: [
      {
        label: 'Browser posture',
        value: mode === 'read_only' ? 'read-only' : mode.replace('_', '-'),
        state: mode === 'operator' ? 'warning' : mode === 'unknown' ? 'unknown' : 'safe',
      },
      {
        label: 'Dangerous tools',
        value: server.dangerous_tools_enabled ? 'enabled' : 'disabled',
        state: stateFromFlag(server.dangerous_tools_enabled, true),
      },
      {
        label: 'Workflow dispatch',
        value: server.workflow_dispatch_enabled ? 'enabled' : 'disabled',
        state: stateFromFlag(server.workflow_dispatch_enabled, true),
      },
      {
        label: 'Allowed repos',
        value: server.allowed_repos_count !== undefined ? `${server.allowed_repos_count} configured` : 'unknown',
        state: server.allowed_repos_count === undefined ? 'unknown' : server.allowed_repos_count > 0 ? 'safe' : 'danger',
      },
      {
        label: 'Protected branches',
        value: server.protected_branches_count !== undefined ? `${server.protected_branches_count} detected` : 'unknown',
        state: server.protected_branches_count === undefined ? 'unknown' : server.protected_branches_count > 0 ? 'safe' : 'warning',
      },
      {
        label: 'OAuth redirects',
        value: server.oauth_redirect_strict === undefined ? 'unknown' : server.oauth_redirect_strict ? 'strict' : 'loose',
        state: stateFromFlag(server.oauth_redirect_strict),
      },
      {
        label: 'Rate limit',
        value: server.rate_limit_enabled === undefined ? 'unknown' : server.rate_limit_enabled ? 'enabled' : 'disabled',
        state: stateFromFlag(server.rate_limit_enabled),
      },
    ],
  };
};

async function loadServerInfo(baseUrl: string): Promise<ServerInfo> {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'server_info', arguments: {} },
    }),
  });
  if (!res.ok) throw new Error(`MCP request failed: ${res.status}`);
  return parseMcpResult<ServerInfo>((await res.json()) as McpResponse<ServerInfo>);
}

async function loadHealth(baseUrl: string): Promise<HealthStatus> {
  try {
    const res = await fetch(`${baseUrl}/healthz`);
    if (!res.ok) {
      return { ok: false, status: 'degraded', source: '/healthz', detail: `/healthz returned ${res.status}` };
    }
    return { ok: true, status: 'healthy', source: '/healthz', detail: 'Live health check passed.' };
  } catch (err) {
    return {
      ok: false,
      status: 'unreachable',
      source: '/healthz',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export function createLiveMcpAdapter(serverUrl: string): ConsoleAdapter {
  return {
    async loadSnapshot(): Promise<ConsoleSnapshot> {
      const baseUrl = serverUrl.replace(/\/$/, '');
      const health = await loadHealth(baseUrl);
      const server = await loadServerInfo(baseUrl);
      const toolNames = server.tool_names ?? [];
      const tools = toolNames.map((name) => ({
        name,
        phase: phaseFor(name),
        summary: 'Runtime tool from server_info.tool_names',
        risk: inferRisk(name),
      }));

      return {
        mode: 'live',
        server,
        posture: buildPosture(server, health),
        tools,
        warnings: health.ok ? [] : [`Live health check reported: ${health.detail}`'],
      };
    },
  };
}
