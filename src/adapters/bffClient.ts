type JsonRpcContent = { type?: string; text?: string };
type JsonRpcResult = { content?: JsonRpcContent[] } | unknown;
type JsonRpcEnvelope = { result?: JsonRpcResult; error?: { code?: number; message?: string } | string };

export type BffCallOptions = {
  timeoutMs?: number;
  bearerToken?: string;
};

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function errorLabel(status: number): string {
  if (status === 401) return 'login required';
  if (status === 403) return 'role/policy denied';
  if (status === 429) return 'rate limit exceeded';
  if (status === 502) return 'MCP server unreachable';
  if (status === 504) return 'MCP server timeout';
  return 'BFF request failed';
}

async function parseError(resp: Response): Promise<string> {
  try {
    const payload = await resp.json();
    const detail = payload?.detail ?? payload?.message ?? payload?.error;
    if (typeof detail === 'string') return detail;
    if (detail?.message) return String(detail.message);
  } catch { /**/ }
  return resp.statusText;
}

export function parseMcpResult<T = unknown>(payload: JsonRpcEnvelope): T {
  if (payload.error) {
    if (typeof payload.error === 'string') throw new Error(payload.error);
    throw new Error(payload.error.message || `MCP error ${payload.error.code ?? ''}`.trim());
  }

  const result = payload.result as { content?: JsonRpcContent[] } | undefined;
  const raw = Array.isArray(result?.content) ? result?.content?.[0]?.text : undefined;
  if (raw) {
    try { return JSON.parse(raw) as T; }
    catch { return raw as T; }
  }
  return payload.result as T;
}

export async function callBffTool<T = unknown>(
  serverUrl: string,
  name: string,
  args: Record<string, unknown> = {},
  options: BffCallOptions = {},
): Promise<T> {
  const base = serverUrl.replace(/\/$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // Dev-only escape hatch. Production strips bearer tokens before this client is called.
  const token = options.bearerToken?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const csrf = getCsrfToken();
  if (csrf) headers['X-CSRF-Token'] = csrf;

  const resp = await fetch(`${base}/api/mcp/call`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ name, arguments: args }),
    signal: AbortSignal.timeout(options.timeoutMs ?? 10000),
  });

  if (!resp.ok) {
    const detail = await parseError(resp);
    throw new Error(`${errorLabel(resp.status)} (${resp.status})${detail ? `: ${detail}` : ''}`);
  }

  const payload = (await resp.json()) as JsonRpcEnvelope;
  return parseMcpResult<T>(payload);
}
