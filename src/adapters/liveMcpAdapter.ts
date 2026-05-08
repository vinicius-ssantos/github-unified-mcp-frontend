import type { ConsoleAdapter, ConsoleSnapshot, ServerInfo, ToolSummary } from '../types/mcp';

type McpResponse<T> = { result?: { content?: Array<{ type: string; text?: string }> } | T; error?: unknown };

const inferRisk = (name: string): ToolSummary['risk'] => {
  if (name.includes('merge') || name.includes('delete') || name.includes('dismiss') || name.includes('update_ref')) return 'high';
  if (name.includes('create') || name.includes('update') || name.includes('apply') || name.includes('comment')) return 'medium';
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

export function createLiveMcpAdapter(serverUrl: string): ConsoleAdapter {
  return {
    async loadSnapshot(): Promise<ConsoleSnapshot> {
      const res = await fetch(`${serverUrl.replace(/\/$/, '')}/mcp`, {
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
      const payload = (await res.json()) as McpResponse<ServerInfo>;
      const text = Array.isArray((payload.result as any)?.content) ? (payload.result as any).content[0]?.text : undefined;
      const server = (text ? JSON.parse(text) : payload.result) as ServerInfo;
      const toolNames = server.tool_names ?? [];
      const tools = toolNames.map((name) => ({ name, phase: phaseFor(name), summary: 'Runtime tool from server_info.tool_names', risk: inferRisk(name) }));
      return { mode: 'live', server, tools, warnings: [] };
    },
  };
}
