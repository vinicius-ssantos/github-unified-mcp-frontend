import { useEffect, useMemo, useState } from 'react';
import { mockAdapter } from './adapters/mockAdapter';
import { createLiveMcpAdapter } from './adapters/liveMcpAdapter';
import type { ConsoleSnapshot, RiskLevel, ToolSummary } from './types/mcp';

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
  const [serverUrl, setServerUrl] = useState('');
  const [snapshot, setSnapshot] = useState<ConsoleSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [risk, setRisk] = useState<RiskLevel | 'all'>('all');

  useEffect(() => {
    const adapter = serverUrl ? createLiveMcpAdapter(serverUrl) : mockAdapter;
    setError(null);
    adapter
      .loadSnapshot()
      .then(setSnapshot)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        return mockAdapter.loadSnapshot().then(setSnapshot);
      });
  }, [serverUrl]);

  const tools = useMemo(() => {
    const items = snapshot?.tools ?? [];
    return items
      .filter((tool) => risk === 'all' || tool.risk === risk)
      .sort((a, b) => riskRank[b.risk] - riskRank+a.risk] || a.name.localeCompare(b.name));
  }, [snapshot, risk]);

  const highRisk = snapshot?.tools.filter((tool) => tool.risk === 'high').length ?? 0;
  const mediumRisk = snapshot?.tools.filter((tool) => tool.risk === 'medium').length ?? 0;

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">github-unified-mcp · operator console</p>
          <h1>Frontend console</h1>
          <p className="sub">Vite + React + TypeScript scaffold for the MCP dashboard. Mock-first, live-read capable, no browser-side secrets.</p>
        </div>
        <label className="server-input">
          <span>MCP URL</span>
          <input value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} placeholder="empty = mock mode" />
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
    </main>
  );
}
