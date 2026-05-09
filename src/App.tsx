import { useEffect, useMemo, useState } from 'react';
import { mockAdapter } from './adapters/mockAdapter';
import { createLiveMcpAdapter } from './adapters/liveMcpAdapter';
import { VercelDeployPage } from './pages/VercelDeployPage';
import type { ConsoleAdapter, ConsoleSnapshot, RiskLevel, ToolSummary } from './types/mcp';

type Page = 'catalog' | 'vercel';

const riskRank: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}d ${hours}h`;
}

function ToolCard({ tool }: { tool: ToolSummary }) {
  return (
    <article className={`tool tool-${tool.risk}`}>
      <div className="tool-head">
        <span className="mono">{tool.name}</span>
        <span className="risk">{tool.risk}</span>
      </div>
      <p>{tool.summary}</p>
      <footer>{tool.phase}</footer>
    </article>
  );
}

export function App() {
  const [serverUrl, setServerUrl] = useState(import.meta.env.VITE_MCP_URL ?? '');
  const [token, setToken] = useState(import.meta.env.VITE_MCP_TOKEN ?? '');
  const [snapshot, setSnapshot] = useState<ConsoleSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [risk, setRisk] = useState<RiskLevel | 'all'>('all');
  const [page, setPage] = useState<Page>('catalog');
  const [adapter, setAdapter] = useState<ConsoleAdapter>(mockAdapter);

  useEffect(() => {
    const next = serverUrl ? createLiveMcpAdapter(serverUrl, { token }) : mockAdapter;
    setAdapter(next);
    setError(null);
    next
      .loadSnapshot()
      .then(setSnapshot)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setAdapter(mockAdapter);
        return mockAdapter.loadSnapshot().then(setSnapshot);
      });
  }, [serverUrl, token]);

  const tools = useMemo(() => {
    const items = snapshot?.tools ?? [];
    return items
      .filter((tool) => risk === 'all' || tool.risk === risk)
      .sort((a, b) => riskRank[b.risk] - riskRank[a.risk] || a.name.localeCompare(b.name));
  }, [snapshot, risk]);

  const highRisk = snapshot?.tools.filter((tool) => tool.risk === 'high').length ?? 0;
  const mediumRisk = snapshot?.tools.filter((tool) => tool.risk === 'medium').length ?? 0;

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">deploy-orchestrator-mcp · operator console</p>
          <h1>MCP Console</h1>
          <p className="sub">Vite + React + TypeScript scaffold for the MCP dashboard. Mock-first, live-read capable, no browser-side secrets.</p>
        </div>
        <label className="server-input">
          <span>MCP URL</span>
          <input value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} placeholder="empty = mock mode" />
        </label>
        <label className="server-input">
          <span>Bearer token (optional)</span>
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="empty = no Authorization header"
            type="password"
          />
        </label>
      </header>

      {snapshot && (
        <section className="stats">
          <div><span>mode</span><strong>{snapshot.mode}</strong></div>
          <div><span>version</span><strong>{snapshot.server.version}</strong></div>
          <div><span>schema</span><strong>{snapshot.server.tool_schema_version}</strong></div>
          <div><span>uptime</span><strong>{formatUptime(snapshot.server.uptime_seconds)}</strong></div>
          <div><span>tools</span><strong>{snapshot.server.tool_count ?? snapshot.tools.length}</strong></div>
          <div><span>risk</span><strong>{highRisk} high · {mediumRisk} med</strong></div>
        </section>
      )}

      {error && <div className="notice">Live mode failed, using mock data: {error}</div>}
      {snapshot?.warnings.map((warning) => <div className="notice" key={warning}>{warning}</div>)}

      <nav className="tab-nav">
        <button
          className={`tab-btn ${page === 'catalog' ? 'tab-active' : ''}`}
          onClick={() => setPage('catalog')}
        >
          Tool catalog
        </button>
        <button
          className={`tab-btn ${page === 'vercel' ? 'tab-active' : ''}`}
          onClick={() => setPage('vercel')}
        >
          ▲ Vercel Preview Deploy
        </button>
      </nav>

      {page === 'catalog' && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Tool catalog</h2>
              <p>Runtime-aware catalog view. High-risk operations stay visible but should remain server-confirmed.</p>
            </div>
            <select value={risk} onChange={(event) => setRisk(event.target.value as RiskLevel | 'all')}>
              <option value="all">all risks</option>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </div>
          <div className="tools-grid">
            {tools.map((tool) => <ToolCard key={tool.name} tool={tool} />)}
          </div>
        </section>
      )}

      {page === 'vercel' && <VercelDeployPage adapter={adapter} />}
    </main>
  );
}
