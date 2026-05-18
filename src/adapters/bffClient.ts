import type { BffUser } from '../types/mcp';

type JsonRpcContent = { type?: string; text?: string };
type JsonRpcResult = { content?: JsonRpcContent[] } | unknown;
type JsonRpcEnvelope = { result?: JsonRpcResult; error?: { code?: number; message?: string } | string };

export type BffCallOptions = {
  timeoutMs?: number;
  bearerToken?: string;
};

export type BffAuditResponse<TEvent = unknown> = {
  total?: number;
  events?: TEvent[];
};

export function getCsrfToken(): string {
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

function bffBase(serverUrl: string): string {
  return serverUrl.replace(/\/$/, '');
}

function csrfHeaders(): Record<string, string> {
  const csrf = getCsrfToken();
  return csrf ? { 'X-CSRF-Token': csrf } : {};
}

export async function fetchBffSession(serverUrl: string, timeoutMs = 3000): Promise<BffUser | null> {
  const resp = await fetch(`${bffBase(serverUrl)}/auth/me`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (resp.status === 401) return null;
  if (!resp.ok) throw new Error(`${errorLabel(resp.status)} (${resp.status}): ${await parseError(resp)}`);
  return (await resp.json()) as BffUser;
}

export async function logoutBffSession(serverUrl: string, timeoutMs = 5000): Promise<void> {
  const resp = await fetch(`${bffBase(serverUrl)}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', ...csrfHeaders() },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok && resp.status !== 401) {
    throw new Error(`${errorLabel(resp.status)} (${resp.status}): ${await parseError(resp)}`);
  }
}

export async function fetchBffAudit<TEvent = unknown>(serverUrl: string, limit = 100, timeoutMs = 5000): Promise<BffAuditResponse<TEvent>> {
  const url = new URL(`${bffBase(serverUrl)}/api/audit`);
  url.searchParams.set('limit', String(limit));
  const resp = await fetch(url.toString(), {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) throw new Error(`${errorLabel(resp.status)} (${resp.status}): ${await parseError(resp)}`);
  return (await resp.json()) as BffAuditResponse<TEvent>;
}

export async function callBffTool<T = unknown>(
  serverUrl: string,
  name: string,
  args: Record<string, unknown> = {},
  options: BffCallOptions = {},
): Promise<T> {
  const base = bffBase(serverUrl);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // Dev-only escape hatch. Production strips bearer tokens before this client is called.
  const token = options.bearerToken?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  Object.assign(headers, csrfHeaders());

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
