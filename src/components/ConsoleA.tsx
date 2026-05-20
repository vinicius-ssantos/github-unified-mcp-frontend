import { useState, useMemo, useEffect, useRef } from 'react';
import StatusDot from './StatusDot';
import ToolDrawer from './ToolDrawer';
import EnvWizard from './EnvWizard';
import PlaygroundA from './PlaygroundA';
import PrReadyA from './PrReadyA';
import VercelDeployTab from './VercelDeployTab';
import { callBffTool, fetchBffAudit, fetchBffCapabilities, fetchBffSession, getCsrfToken, logoutBffSession } from '../adapters/bffClient';
import { TOOL_CATALOG } from '../data/tools';
import { SERVER_STATES, ENV_CONFIG, AUDIT_EVENTS, RATE_LIMITS } from '../data/serverState';
import type { ToolFlatEntry, DriftInfo, ServerInfoFlags, HealthzResponse, BffAuditEvent, BffCapabilities, BffToolPolicy, BffUser } from '../types/mcp';

// ── helpers ───────────────────────────────────────────────────────────────────

const RISK_TONE = {
  low:    { label: "low",  bg: "rgba(120,200,160,0.14)", fg: "var(--ok)",     border: "rgba(120,200,160,0.30)" },
  medium: { label: "med",  bg: "rgba(220,180,100,0.14)", fg: "var(--warn)",   border: "rgba(220,180,100,0.30)" },
  high:   { label: "high", bg: "rgba(230,120,110,0.14)", fg: "var(--danger)", border: "rgba(230,120,110,0.30)" },
};

const formatUptime = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m`;
  if (h > 0) return `${h}h ${String(m).padStart(2,"0")}m ${String(sec).padStart(2,"0")}s`;
  return `${m}m ${String(sec).padStart(2,"0")}s`;
};

function readHash() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return { tab: params.get("tab") ?? "overview", risk: params.get("risk") ?? "all", phase: params.get("phase") ?? "all", q: params.get("q") ?? "", tool: params.get("tool") ?? "" };
}

function writeHash(state: { tab: string; risk: string; phase: string; q: string; tool: string }) {
  const params = new URLSearchParams();
  if (state.tab !== "overview") params.set("tab", state.tab);
  if (state.risk !== "all") params.set("risk", state.risk);
  if (state.phase !== "all") params.set("phase", state.phase);
  if (state.q) params.set("q", state.q);
  if (state.tool) params.set("tool", state.tool);
  const next = params.toString();
  const url = next ? `#${next}` : window.location.pathname + window.location.search;
  if (window.location.hash.replace(/^#/, "") !== next) history.replaceState(null, "", url);
}

// ── sub-components ────────────────────────────────────────────────────────────

function LiveUptime({ baseSeconds, stopped }: { baseSeconds: number; stopped: boolean }) {
  const [delta, setDelta] = useState(0);
  useEffect(() => { setDelta(0); }, [baseSeconds]);
  useEffect(() => {
    if (stopped) return;
    const iv = setInterval(() => setDelta(d => d + 1), 1000);
    return () => clearInterval(iv);
  }, [stopped]);
  return <span className="mono">{formatUptime(baseSeconds + delta)}</span>;
}

function Sparkline({ values, tone }: { values: number[]; tone: string }) {
  const max = Math.max(...values, 1);
  const w = 96, h = 28, n = values.length;
  const pts = values.map((v, i) => `${(i / (n - 1)) * w},${h - (v / max) * h}`).join(" ");
  const fill = pts + ` ${w},${h} 0,${h}`;
  const color = tone === "warn" ? "var(--warn)" : tone === "danger" ? "var(--danger)" : "var(--ok)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polygon points={fill} fill={color} opacity="0.15" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function OverviewA({ state, forceError, sparkData }: { state: ReturnType<typeof buildState>; forceError: boolean; sparkData: Record<string, number[]> }) {
  const flags = state.server_info;
  const auditStats = useMemo(() => {
    const blocked = AUDIT_EVENTS.filter(e => e.level !== "info").length;
    const actors = new Set(AUDIT_EVENTS.map(e => e.actor)).size;
    const toolCounts: Record<string, number> = {};
    AUDIT_EVENTS.forEach(e => { toolCounts[e.tool] = (toolCounts[e.tool] ?? 0) + 1; });
    const topTool = Object.entries(toolCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const lastWarn = AUDIT_EVENTS.find(e => e.level !== "info");
    return { blocked, actors, topTool, lastWarnTs: lastWarn?.ts?.slice(11, 19) ?? "—" };
  }, []);

  const flagRows: [string, boolean, string][] = [
    ["read_only", flags.read_only, flags.read_only ? "ok" : "warn"],
    ["dangerous_tools_enabled", flags.dangerous_tools_enabled, flags.dangerous_tools_enabled ? "warn" : "ok"],
    ["workflow_dispatch_enabled", flags.workflow_dispatch_enabled, flags.workflow_dispatch_enabled ? "warn" : "ok"],
    ["require_allowed_repos", flags.require_allowed_repos, flags.require_allowed_repos ? "ok" : "danger"],
    ["protected_branches_configured", flags.protected_branches_configured, flags.protected_branches_configured ? "ok" : "danger"],
    ["oauth_redirect_allowlist_configured", flags.oauth_redirect_allowlist_configured, flags.oauth_redirect_allowlist_configured ? "ok" : "warn"],
    ["oauth_rate_limit_enabled", flags.oauth_rate_limit_enabled, flags.oauth_rate_limit_enabled ? "ok" : "warn"],
    ["tool_catalog_refresh_supported", flags.tool_catalog_refresh_supported, "ok"],
  ];

  const postureCopy = {
    safe:     { label: "Postura: SAFE",     desc: "Read-only ativo. Nenhuma escrita possível.",                                      tone: "ok"   },
    balanced: { label: "Postura: BALANCED", desc: "Escrita habilitada com fluxo PR-first. Tools perigosas desativadas.",             tone: "info" },
    elevated: { label: "Postura: ELEVATED", desc: "Modo operador ativo. pr_merge, git_update_ref e similares disponíveis sob confirm.", tone: "warn" },
  }[state.posture];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="ca-overview-strip">
        {[
          { n: auditStats.blocked,           l: "bloqueadas",    tone: auditStats.blocked > 0 ? "warn" : "ok" },
          { n: AUDIT_EVENTS.length,          l: "eventos audit", tone: "ok" },
          { n: auditStats.actors,            l: "atores únicos", tone: "ok" },
          { n: auditStats.topTool,           l: "top tool",      mono: true },
          { n: auditStats.lastWarnTs,        l: "último aviso",  mono: true, tone: auditStats.blocked > 0 ? "warn" : "ok" },
        ].map((s, i) => (
          <div key={i} className="ca-ostat">
            <div className={`ca-ostat-n${s.mono ? " mono" : ""}`} style={s.tone === "warn" ? { color: "var(--warn)" } : {}}>{s.n}</div>
            <div className="ca-ostat-l mono">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="ca-grid-overview">
        <div className="ca-card">
          <div className="ca-card-h"><span className="ca-card-h-num mono">01</span><span className="ca-card-h-title">Postura de segurança</span></div>
          <div className={`ca-posture ca-posture-${postureCopy?.tone}`}>
            <div className="ca-posture-bar" />
            <div><div className="ca-posture-label">{postureCopy?.label}</div><div className="ca-posture-desc">{postureCopy?.desc}</div></div>
          </div>
          <table className="ca-flags"><tbody>
            {flagRows.map(([k, v, tone]) => (
              <tr key={k}><td className="mono ca-flag-k">{k}</td><td><StatusDot tone={tone as 'ok'|'warn'|'danger'} /></td><td className="mono ca-flag-v">{String(v)}</td></tr>
            ))}
          </tbody></table>
        </div>

        <div className="ca-card">
          <div className="ca-card-h"><span className="ca-card-h-num mono">02</span><span className="ca-card-h-title">Rate limits — janela atual</span></div>
          <div className="ca-rates">
            {RATE_LIMITS.map(r => {
              const used = forceError && r.endpoint === "/oauth/token" ? r.max : r.used;
              const pct = Math.min(100, (used / r.max) * 100);
              const tone = pct > 85 ? "danger" : pct > 60 ? "warn" : "ok";
              const hist = sparkData[r.endpoint] ?? [];
              return (
                <div className="ca-rate" key={r.endpoint}>
                  <div className="ca-rate-row"><span className="mono ca-rate-name">{r.endpoint}</span><span className="mono ca-rate-num">{used}/{r.max}</span></div>
                  {hist.length > 1 && <Sparkline values={hist} tone={tone} />}
                  <div className="ca-rate-bar" style={{ marginTop: 4 }}><div className={`ca-rate-fill ca-rate-fill-${tone}`} style={{ width: `${pct}%` }} /></div>
                  <div className="ca-rate-meta mono">janela {r.window}s</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ca-card">
          <div className="ca-card-h"><span className="ca-card-h-num mono">03</span><span className="ca-card-h-title">Allowlists & env</span></div>
          <div className="ca-env-block"><div className="ca-env-label mono">GITHUB_ALLOWED_REPOS</div><ul className="ca-env-list">{ENV_CONFIG.GITHUB_ALLOWED_REPOS.map(r => <li key={r} className="mono">{r}</li>)}</ul></div>
          <div className="ca-env-block"><div className="ca-env-label mono">GITHUB_PROTECTED_BRANCHES</div><div className="ca-chips">{ENV_CONFIG.GITHUB_PROTECTED_BRANCHES.map(b => <span key={b} className="ca-chip mono">{b}</span>)}</div></div>
          <div className="ca-env-block"><div className="ca-env-label mono">FASTMCP_ALLOWED_ORIGINS</div><ul className="ca-env-list">{ENV_CONFIG.FASTMCP_ALLOWED_ORIGINS.map(r => <li key={r} className="mono">{r}</li>)}</ul></div>
        </div>

        <div className="ca-card ca-card-wide">
          <div className="ca-card-h"><span className="ca-card-h-num mono">04</span><span className="ca-card-h-title">Audit recente</span><span className="ca-card-h-meta mono">últimas entradas</span></div>
          <table className="ca-audit"><thead><tr><th>ts</th><th>actor</th><th>tool</th><th>target</th><th>decision</th><th>reason</th></tr></thead>
            <tbody>{AUDIT_EVENTS.slice(0, 6).map((e, i) => (
              <tr key={i}>
                <td className="mono ca-audit-ts">{e.ts}</td><td className="mono">{e.actor}</td>
                <td className="mono ca-audit-tool">{e.tool}</td><td className="mono ca-audit-target">{e.target}</td>
                <td><span className={`ca-decision ca-decision-${e.level}`}><StatusDot tone={e.level === "info" ? "ok" : e.level === "warn" ? "warn" : "danger"} />{e.decision}</span></td>
                <td className="mono ca-audit-reason">{e.reason ?? "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ToolsA({ tools, totals, riskFilter, setRiskFilter, phaseFilter, setPhaseFilter, query, setQuery, rowPad, cellFs, mode, onOpen, searchRef, drift }: {
  tools: ToolFlatEntry[]; totals: Record<string, number>; riskFilter: string; setRiskFilter: (v: string) => void;
  phaseFilter: string; setPhaseFilter: (v: string) => void; query: string; setQuery: (v: string) => void;
  rowPad: string; cellFs: number; mode: string; onOpen: (t: ToolFlatEntry) => void;
  searchRef: React.RefObject<HTMLInputElement | null>; drift: DriftInfo | null;
}) {
  const [copiedTool, setCopiedTool] = useState<string | null>(null);
  const copyCall = (e: React.MouseEvent, toolName: string) => {
    e.stopPropagation();
    const snippet = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: toolName, arguments: {} } });
    navigator.clipboard?.writeText(snippet);
    setCopiedTool(toolName);
    setTimeout(() => setCopiedTool(null), 1500);
  };
  const phases = TOOL_CATALOG.map(p => p.phase);
  const state = SERVER_STATES[mode] ?? SERVER_STATES['read_only'];
  const willRun = (t: ToolFlatEntry) => {
    if (t.requiresDangerous && !state.server_info.dangerous_tools_enabled) return { tone: "danger", text: "blocked", reason: "dangerous_tools_disabled" };
    if (t.requiresWorkflowDispatch && !state.server_info.workflow_dispatch_enabled) return { tone: "danger", text: "blocked", reason: "workflow_dispatch_disabled" };
    if (state.server_info.read_only && t.risk !== "low") return { tone: "warn", text: "read-only", reason: "read_only_mode" };
    if (t.requiresConfirm) return { tone: "warn", text: "requires confirm", reason: "destructive_confirmation" };
    if (t.planned) return { tone: "muted", text: "planejado", reason: "not_implemented" };
    return { tone: "ok", text: "allowed", reason: null };
  };

  return (
    <div className="ca-tools">
      <div className="ca-tools-bar">
        <div className="ca-tools-search">
          <span className="mono ca-tools-search-prompt">grep</span>
          <input ref={searchRef as React.RefObject<HTMLInputElement>} value={query} onChange={e => setQuery(e.target.value)} placeholder="filtrar por nome ou descrição… (/)" />
        </div>
        <div className="ca-tools-pills">
          <span className="ca-tools-pills-label mono">risk</span>
          {[["all", "all"], ["low", "low"], ["medium", "med"], ["high", "high"]].map(([k, label]) => (
            <button key={k} className={`ca-tools-pill ${riskFilter === k ? "is-active" : ""}`} onClick={() => setRiskFilter(k)}>
              {label} {k !== "all" && <span className="mono ca-tools-pill-n">{totals[k]}</span>}
            </button>
          ))}
        </div>
        <div className="ca-tools-pills">
          <span className="ca-tools-pills-label mono">phase</span>
          <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)} className="ca-tools-select mono">
            <option value="all">all</option>
            {phases.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {drift && drift.newTools.length > 0 && (
        <div className="ca-drift-banner">
          <span className="ca-drift-label">schema drift{drift.demo ? " · demo" : " · live"}</span>
          <span className="ca-drift-body">
            {drift.newTools.length} tool{drift.newTools.length > 1 ? "s" : ""} no servidor não catalogada{drift.newTools.length > 1 ? "s" : ""}:
            {drift.newTools.map(n => <span key={n} className="ca-drift-tool mono">{n}</span>)}
          </span>
          {drift.missingTools.length > 0 && (
            <span className="ca-drift-body" style={{ color: "var(--warn)" }}>
              · {drift.missingTools.length} ausente{drift.missingTools.length > 1 ? "s" : ""} no servidor:
              {drift.missingTools.map(n => <span key={n} className="ca-drift-tool mono">{n}</span>)}
            </span>
          )}
        </div>
      )}

      <div className="ca-tools-table-wrap">
        <table className="ca-tools-table" style={{ "--row-pad": rowPad, "--cell-fs": cellFs + "px" } as React.CSSProperties}>
          <thead><tr><th style={{ width: 200 }}>tool</th><th>summary</th><th style={{ width: 80 }}>risk</th><th style={{ width: 200 }}>phase</th><th style={{ width: 180 }}>under {state.label.toLowerCase()}</th></tr></thead>
          <tbody>
            {tools.map(t => {
              const r = RISK_TONE[t.risk];
              const w = willRun(t);
              return (
                <tr key={t.name} onClick={() => onOpen(t)} className="ca-tools-row" style={{ position: "relative" }}>
                  <td className="mono ca-tools-name">
                    {t.name}{t.planned && <span className="ca-tools-planned">planned</span>}
                    <button
                      className="ca-tools-copy"
                      title="copy JSON-RPC call"
                      onClick={e => copyCall(e, t.name)}
                      style={{ marginLeft: 6, fontFamily: "monospace", fontSize: 9, padding: "1px 5px", border: "1px solid var(--border,#333)", borderRadius: 3, background: "transparent", color: copiedTool === t.name ? "var(--ok)" : "var(--text-muted)", cursor: "pointer", opacity: 0, transition: "opacity .15s" }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={e => { if (copiedTool !== t.name) e.currentTarget.style.opacity = "0"; }}
                    >
                      {copiedTool === t.name ? "✓" : "copy"}
                    </button>
                  </td>
                  <td className="ca-tools-summary">{t.summary}</td>
                  <td><span className="ca-risk" style={{ background: r.bg, color: r.fg, borderColor: r.border }}>{r.label}</span></td>
                  <td className="mono ca-tools-phase">{t.phase}</td>
                  <td>
                    <span className={`ca-decision ca-decision-${w.tone === "ok" ? "info" : w.tone === "warn" ? "warn" : w.tone === "danger" ? "error" : "muted"}`}>
                      <StatusDot tone={w.tone as 'ok'|'warn'|'danger'|'muted'} />{w.text}
                    </span>
                    {w.reason && <span className="mono ca-tools-reason"> · {w.reason}</span>}
                  </td>
                </tr>
              );
            })}
            {tools.length === 0 && <tr><td colSpan={5} className="ca-tools-empty mono">$ grep returned 0 — ajuste os filtros</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SecurityA({ state }: { state: ReturnType<typeof buildState> }) {
  const flags = state.server_info;
  const layers = [
    { name: "Allowlist de repositórios", status: flags.require_allowed_repos ? "ok" : "danger", note: flags.require_allowed_repos ? `${ENV_CONFIG.GITHUB_ALLOWED_REPOS.length} repos permitidos` : "GITHUB_REQUIRE_ALLOWED_REPOS=false" },
    { name: "Read-only global", status: flags.read_only ? "ok" : "info", note: flags.read_only ? "Mutações recusadas no nível do guard" : "Escrita habilitada — fluxo PR-first" },
    { name: "Branches protegidas", status: flags.protected_branches_configured ? "ok" : "warn", note: ENV_CONFIG.GITHUB_PROTECTED_BRANCHES.join(", ") },
    { name: "Tools perigosas", status: flags.dangerous_tools_enabled ? "warn" : "ok", note: flags.dangerous_tools_enabled ? "pr_merge, git_*, pr_dismiss_review disponíveis" : "Bloqueadas no guard" },
    { name: "Confirmação destrutiva", status: "ok", note: 'confirm="CONFIRM_DESTRUCTIVE_OPERATION" obrigatório por chamada' },
    { name: "Workflow dispatch", status: flags.workflow_dispatch_enabled ? "warn" : "ok", note: flags.workflow_dispatch_enabled ? "actions_run_workflow disponível" : "actions_run_workflow bloqueado" },
    { name: "OAuth redirect allowlist", status: flags.oauth_redirect_allowlist_configured ? "ok" : "warn", note: "MCP_OAUTH_ALLOWED_REDIRECT_URIS configurado" },
    { name: "Rate limit OAuth", status: flags.oauth_rate_limit_enabled ? "ok" : "warn", note: `${ENV_CONFIG.MCP_OAUTH_RATE_LIMIT_MAX_REQUESTS} req / ${ENV_CONFIG.MCP_OAUTH_RATE_LIMIT_WINDOW_SECONDS}s por IP` },
    { name: "Token redaction", status: "ok", note: "Tokens, secrets e PATs nunca retornam em outputs" },
    { name: "Injection detect", status: "ok", note: "Padrões em respostas GET. request_text/audit em #62/#63" },
  ];
  const dangerCount = layers.filter(l => l.status === "danger").length;
  const warnCount   = layers.filter(l => l.status === "warn").length;
  const grade = dangerCount >= 2 ? "D" : dangerCount === 1 ? "C" : warnCount >= 2 ? "B" : "A";
  const gradeColor = { A: "var(--ok)", B: "var(--info)", C: "var(--warn)", D: "var(--danger)" }[grade];

  return (
    <div className="ca-sec">
      <div className="ca-sec-head">
        <div className="ca-sec-head-l"><div className="ca-sec-title">Camadas de segurança</div><div className="ca-sec-sub">10 camadas independentes. Falha em qualquer uma bloqueia a operação.</div></div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: gradeColor, lineHeight: 1 }}>{grade}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>security grade</span>
          </div>
          <div className="ca-sec-head-r mono">postura · {state.posture}</div>
        </div>
      </div>
      <div className="ca-sec-grid">
        {layers.map((l, i) => (
          <div key={l.name} className="ca-sec-cell">
            <div className="ca-sec-cell-h"><span className="mono ca-sec-cell-num">{String(i + 1).padStart(2, "0")}</span><StatusDot tone={l.status as 'ok'|'warn'|'danger'|'info'} /><span className="ca-sec-cell-name">{l.name}</span></div>
            <div className="ca-sec-cell-note">{l.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditTimeline({ events }: { events: { ts: string; level?: string; result_ok?: boolean }[] }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const buckets = useMemo(() => {
    const b: Record<number, { ok: number; warn: number; err: number }> = {};
    hours.forEach(h => { b[h] = { ok: 0, warn: 0, err: 0 }; });
    events.forEach(e => {
      const h = new Date(e.ts).getHours();
      if (!isNaN(h)) {
        const isErr = e.level === "error" || e.result_ok === false;
        const isWarn = e.level === "warn";
        if (isErr) b[h].err++;
        else if (isWarn) b[h].warn++;
        else b[h].ok++;
      }
    });
    return b;
  }, [events]);

  const maxVal = Math.max(...hours.map(h => buckets[h].ok + buckets[h].warn + buckets[h].err), 1);
  const w = 480, h = 48, barW = Math.floor(w / 24) - 1;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: 6 }}>timeline 24h · ok <span style={{ color: "var(--ok)" }}>▮</span> warn <span style={{ color: "var(--warn)" }}>▮</span> err <span style={{ color: "var(--danger)" }}>▮</span></div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block", height: 48 }}>
        {hours.map(hour => {
          const bk = buckets[hour];
          const total = bk.ok + bk.warn + bk.err;
          const totalH = (total / maxVal) * (h - 4);
          const okH    = (bk.ok   / maxVal) * (h - 4);
          const warnH  = (bk.warn / maxVal) * (h - 4);
          const errH   = (bk.err  / maxVal) * (h - 4);
          const x = hour * (barW + 1);
          return (
            <g key={hour}>
              <rect x={x} y={h - okH}   width={barW} height={okH}   fill="var(--ok,#4caf50)"   opacity={0.6} />
              <rect x={x} y={h - okH - warnH} width={barW} height={warnH} fill="var(--warn,#f0b429)" opacity={0.6} />
              <rect x={x} y={h - totalH} width={barW} height={errH}  fill="var(--danger,#ef5350)" opacity={0.6} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AuditA({ rowPad, cellFs, liveEvents, isLive }: { rowPad: string; cellFs: number; liveEvents: BffAuditEvent[] | null; isLive: boolean }) {
  const [toolQuery, setToolQuery] = useState("");
  const [resultFilter, setResultFilter] = useState("all");

  const events = liveEvents ?? [];
  const mockEvents = liveEvents === null ? AUDIT_EVENTS : [];

  const filteredLive = events.filter(e => {
    if (resultFilter === "ok" && !e.result_ok) return false;
    if (resultFilter === "fail" && e.result_ok) return false;
    if (toolQuery && !e.tool.toLowerCase().includes(toolQuery.toLowerCase()) && !e.user.toLowerCase().includes(toolQuery.toLowerCase())) return false;
    return true;
  });
  const filteredMock = mockEvents.filter(e => {
    if (toolQuery && !e.tool.toLowerCase().includes(toolQuery.toLowerCase())) return false;
    return true;
  });

  const total = isLive ? events.length : mockEvents.length;
  const filtered = isLive ? filteredLive.length : filteredMock.length;

  const allEventsForTimeline = useMemo(() =>
    isLive
      ? events.map(e => ({ ts: e.ts, result_ok: e.result_ok }))
      : mockEvents.map(e => ({ ts: e.ts, level: e.level })),
    [isLive, events, mockEvents]
  );

  const actorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (isLive ? events : mockEvents).forEach(e => {
      const key = isLive ? (e as BffAuditEvent).user : (e as typeof AUDIT_EVENTS[0]).actor;
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [isLive, events, mockEvents]);

  const exportEvents = (fmt: 'json' | 'csv') => {
    const src = isLive ? events : mockEvents;
    let blob: Blob;
    if (fmt === 'json') {
      blob = new Blob([JSON.stringify(src, null, 2)], { type: 'application/json' });
    } else {
      const headers = isLive ? 'ts,user,tool,ip,result,ms' : 'ts,actor,tool,target,decision,reason';
      const rows = src.map(e =>
        isLive
          ? `${(e as BffAuditEvent).ts},${(e as BffAuditEvent).user},${(e as BffAuditEvent).tool},${(e as BffAuditEvent).ip},${(e as BffAuditEvent).result_ok},${(e as BffAuditEvent).duration_ms}`
          : `${(e as typeof AUDIT_EVENTS[0]).ts},${(e as typeof AUDIT_EVENTS[0]).actor},${(e as typeof AUDIT_EVENTS[0]).tool},${(e as typeof AUDIT_EVENTS[0]).target},${(e as typeof AUDIT_EVENTS[0]).decision},${(e as typeof AUDIT_EVENTS[0]).reason ?? ''}`
      );
      blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv' });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audit.${fmt}`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ca-audit-page">
      <div className="ca-audit-head">
        <div className="ca-audit-title">
          Audit log
          <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400, marginLeft: 10 }}>{filtered}/{total} eventos</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="ca-audit-sub mono">{isLive ? "BFF SQLite · dados reais" : "mock local · sem persistência server-side"}</div>
          <button onClick={() => exportEvents('json')} style={{ fontFamily: "monospace", fontSize: 10, padding: "2px 7px", border: "1px solid var(--border,#333)", borderRadius: 3, background: "transparent", color: "var(--text-dim,#888)", cursor: "pointer" }}>↓ json</button>
          <button onClick={() => exportEvents('csv')}  style={{ fontFamily: "monospace", fontSize: 10, padding: "2px 7px", border: "1px solid var(--border,#333)", borderRadius: 3, background: "transparent", color: "var(--text-dim,#888)", cursor: "pointer" }}>↓ csv</button>
        </div>
      </div>

      <AuditTimeline events={allEventsForTimeline} />

      {actorCounts.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>top actors:</span>
          {actorCounts.map(([actor, n]) => (
            <span key={actor} style={{ fontFamily: "var(--font-mono)", fontSize: 11, padding: "1px 7px", border: "1px solid var(--border,#333)", borderRadius: 3, color: "var(--text-dim,#888)" }}>
              {actor} <span style={{ color: "var(--info,#60a0f0)" }}>×{n}</span>
            </span>
          ))}
        </div>
      )}

      <div className="ca-audit-filter">
        {isLive && (
          <div className="ca-tools-pills">
            <span className="ca-tools-pills-label mono">result</span>
            {[["all","all"],["ok","ok"],["fail","fail"]].map(([k,label]) => (
              <button key={k} className={`ca-tools-pill ${resultFilter === k ? "is-active" : ""}`} onClick={() => setResultFilter(k)}>{label}</button>
            ))}
          </div>
        )}
        <div className="ca-tools-search" style={{ flex: "0 1 260px" }}>
          <span className="mono ca-tools-search-prompt">grep</span>
          <input value={toolQuery} onChange={e => setToolQuery(e.target.value)} placeholder="filtrar por tool ou usuário…" />
        </div>
        {(resultFilter !== "all" || toolQuery) && <button className="ca-tools-pill" onClick={() => { setResultFilter("all"); setToolQuery(""); }}>× limpar</button>}
      </div>

      {isLive ? (
        <table className="ca-audit ca-audit-full" style={{ "--row-pad": rowPad, "--cell-fs": cellFs + "px" } as React.CSSProperties}>
          <thead><tr><th>ts</th><th>user</th><th>tool</th><th>ip</th><th>result</th><th>ms</th></tr></thead>
          <tbody>
            {filteredLive.map(e => (
              <tr key={e.id}>
                <td className="mono ca-audit-ts">{e.ts.slice(0, 19).replace("T", " ")}</td>
                <td className="mono">{e.user}</td>
                <td className="mono ca-audit-tool">{e.tool}</td>
                <td className="mono ca-audit-target">{e.ip}</td>
                <td><span className={`ca-decision ca-decision-${e.result_ok ? "info" : "error"}`}><StatusDot tone={e.result_ok ? "ok" : "danger"} />{e.result_ok ? "ok" : "fail"}</span></td>
                <td className="mono">{e.duration_ms}</td>
              </tr>
            ))}
            {filteredLive.length === 0 && <tr><td colSpan={6} className="ca-tools-empty mono">$ grep returned 0 — nenhum evento para este filtro</td></tr>}
          </tbody>
        </table>
      ) : (
        <table className="ca-audit ca-audit-full" style={{ "--row-pad": rowPad, "--cell-fs": cellFs + "px" } as React.CSSProperties}>
          <thead><tr><th>ts</th><th>actor</th><th>tool / endpoint</th><th>target</th><th>decision</th><th>reason</th></tr></thead>
          <tbody>
            {filteredMock.map((e, i) => (
              <tr key={i}>
                <td className="mono ca-audit-ts">{e.ts}</td><td className="mono">{e.actor}</td>
                <td className="mono ca-audit-tool">{e.tool}</td><td className="mono ca-audit-target">{e.target}</td>
                <td><span className={`ca-decision ca-decision-${e.level}`}><StatusDot tone={e.level === "info" ? "ok" : e.level === "warn" ? "warn" : "danger"} />{e.decision}</span></td>
                <td className="mono ca-audit-reason">{e.reason ?? "—"}</td>
              </tr>
            ))}
            {filteredMock.length === 0 && <tr><td colSpan={6} className="ca-tools-empty mono">$ grep returned 0 — nenhum evento para este filtro</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RunbookA({ state }: { state: ReturnType<typeof buildState> }) {
  const [activeBook, setActiveBook] = useState("merge");
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try { const s = localStorage.getItem('runbook-checked-merge'); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const toggle = (n: string) => setChecked(p => {
    const next = { ...p, [n]: !p[n] };
    try { localStorage.setItem(`runbook-checked-${activeBook}`, JSON.stringify(next)); } catch { /**/ }
    return next;
  });
  const RUNBOOKS = {
    rollback: { title: "Runbook · rollback de ref", sub: "Reset de emergência. git_update_ref aponta a branch de volta para um commit seguro.", statusBlocked: !state.server_info.dangerous_tools_enabled, blockedMsg: "git_update_ref bloqueado — ative modo operador", okMsg: "git_update_ref disponível sob confirm", steps: [
      { n:"01", title:"Identificar commit seguro", cmd:"compare_commits owner repo base head", note:"Confirme o sha do último commit bom antes do problema" },
      { n:"02", title:"Verificar branch alvo", cmd:"repo_get / repo_tree ref=main", note:"Confirme que não é branch protegida — bloqueia automaticamente" },
      { n:"03", title:"Checar head_sha atual", cmd:"pr_get ou repo_tree @main", note:"Registre o sha atual para auditoria antes de avançar" },
      { n:"04", title:"Avaliar CI do commit alvo", cmd:"actions_list_runs + actions_get_run", note:"Confirme que o commit de destino tinha CI verde" },
      { n:"05", title:"Executar git_update_ref", cmd:'git_update_ref ref=refs/heads/branch sha=<safe_sha> confirm="CONFIRM_DESTRUCTIVE_OPERATION"', note:"Irreversível sem novo commit — cheque duas vezes o sha" },
      { n:"06", title:"Validar rollback", cmd:"repo_tree ref=branch + actions_list_runs", note:"Confirme que o HEAD aponta para o commit seguro" },
      { n:"07", title:"Registrar incidente", cmd:"issue_create title='rollback: <motivo>'", note:"Documente causa, sha anterior, sha revertido e timestamp" },
    ]},
    merge: { title: "Runbook · pr_merge", sub: "Sequência obrigatória antes de operações destrutivas. Marque cada etapa ao concluir.", statusBlocked: !state.server_info.dangerous_tools_enabled, blockedMsg: "pr_merge bloqueado pela postura atual", okMsg: "pr_merge disponível sob confirm", steps: [
      { n:"01", title:"Verificar PR aberto", cmd:"pr_get owner repo number", note:"Confirma estado open e mergeable_state" },
      { n:"02", title:"Revisar diff", cmd:"pr_get_diff · pr_list_changed_files", note:"Output bounded; nunca retorna tokens" },
      { n:"03", title:"Avaliar risco", cmd:"pr_risk_review", note:"Retorna risk_level + checklist operacional" },
      { n:"04", title:"Confirmar CI", cmd:"ci_gate_check (planejado, #65)", note:"Ainda em desenvolvimento — verificar manualmente" },
      { n:"05", title:"Capturar head_sha", cmd:"sha=<head_sha>", note:"Garantia de merge sobre o commit revisado" },
      { n:"06", title:"Executar pr_merge", cmd:'confirm="CONFIRM_DESTRUCTIVE_OPERATION"', note:"Falha sem dangerous_tools_enabled=true" },
    ]},
    branch_pr: { title: "Runbook · branch → arquivo → PR", sub: "Fluxo completo de entrega segura. Preferir sempre sobre git low-level.", statusBlocked: state.server_info.read_only, blockedMsg: "escrita bloqueada em modo read_only", okMsg: "fluxo disponível na postura atual", steps: [
      { n:"01", title:"Criar branch de feature", cmd:"branch_create owner repo branch ref", note:"Nunca use main/master como destino — protegidas" },
      { n:"02", title:"Criar ou editar arquivo", cmd:"file_create_or_update / file_apply_patch", note:"file_apply_patch para edições pontuais — não exige conteúdo completo" },
      { n:"03", title:"Abrir pull request", cmd:"pr_create owner repo head base title body", note:"head=feat/branch, base=main" },
      { n:"04", title:"Solicitar revisão", cmd:"pr_request_reviewers pull_number reviewers", note:"Opcional — importante em repos colaborativos" },
      { n:"05", title:"Checar status de CI", cmd:"actions_list_runs / actions_get_run", note:"Aguardar CI verde antes de merge" },
      { n:"06", title:"Revisar PR antes do merge", cmd:"pr_risk_review pull_number", note:"low → ok · medium → checar diff · high → revisão manual" },
      { n:"07", title:"Merge via GitHub (preferido)", cmd:"— merge manual na interface GitHub —", note:"Mais seguro; evita ENABLE_DANGEROUS_TOOLS=true" },
      { n:"08", title:"Ou: pr_merge via MCP (operador)", cmd:'pr_merge sha=<head_sha> confirm="CONFIRM_DESTRUCTIVE_OPERATION"', note:"Exige dangerous_tools_enabled=true" },
    ]},
  } as const;
  const book = RUNBOOKS[activeBook as keyof typeof RUNBOOKS];
  const lastBook = useRef(activeBook);
  if (lastBook.current !== activeBook) {
    try { const s = localStorage.getItem(`runbook-checked-${activeBook}`); setChecked(s ? JSON.parse(s) : {}); } catch { setChecked({}); }
    lastBook.current = activeBook;
  }
  const doneCount = Object.values(checked).filter(Boolean).length;
  const allDone = doneCount === book.steps.length;
  return (
    <div className="ca-runbook">
      <div className="ca-runbook-bookpicker">
        {Object.entries(RUNBOOKS).map(([k, rb]) => (
          <button key={k} className={`ca-runbook-pick ${activeBook === k ? "is-active" : ""}`} onClick={() => setActiveBook(k)}>{rb.title.replace("Runbook · ", "")}</button>
        ))}
      </div>
      <div className="ca-runbook-head">
        <div><div className="ca-runbook-title">{book.title}</div><div className="ca-runbook-sub">{book.sub}</div></div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
          <div className={`ca-runbook-status ${book.statusBlocked ? "is-blocked" : "is-ok"}`}><StatusDot tone={book.statusBlocked ? "danger" : "warn"} />{book.statusBlocked ? book.blockedMsg : book.okMsg}</div>
          <div className="mono" style={{ fontSize:11, color: allDone ? "var(--ok)" : "var(--text-muted)" }}>{doneCount}/{book.steps.length} etapas{allDone ? " · concluído" : ""}</div>
        </div>
      </div>
      <div className="ca-runbook-progress"><div className="ca-runbook-progress-fill" style={{ width:`${(doneCount/book.steps.length)*100}%` }} /></div>
      <ol className="ca-runbook-list">
        {book.steps.map(s => {
          const done = !!checked[s.n];
          return (
            <li key={s.n} className={`ca-runbook-step ${done ? "is-done" : ""}`} onClick={() => toggle(s.n)}>
              <div className="ca-runbook-check"><span className="ca-runbook-check-box">{done ? "✓" : ""}</span></div>
              <div className="ca-runbook-num mono">{s.n}</div>
              <div className="ca-runbook-step-body">
                <div className="ca-runbook-step-title">{s.title}</div>
                <div className="ca-runbook-step-cmd mono">$ {s.cmd}</div>
                <div className="ca-runbook-step-note">{s.note}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Command Palette ───────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: "○" },
  { id: "tools", label: "Tool catalog", icon: "◈" },
  { id: "security", label: "Security posture", icon: "⬡" },
  { id: "audit", label: "Audit log", icon: "◷" },
  { id: "runbook", label: "Runbook", icon: "◉" },
  { id: "playground", label: "Playground", icon: "▶" },
  { id: "pr", label: "PR Readiness", icon: "⑂" },
  { id: "wizard", label: ".env wizard", icon: "⚙" },
  { id: "vercel", label: "Vercel deploy", icon: "▲" },
];

function CommandPalette({ allTools, onClose, onTab, onTool }: {
  allTools: ToolFlatEntry[];
  onClose: () => void;
  onTab: (tab: string) => void;
  onTool: (name: string) => void;
}) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);

  const items = useMemo(() => {
    const nav = NAV_ITEMS.filter(n => !q || n.label.toLowerCase().includes(q.toLowerCase())).map(n => ({ type: "nav" as const, id: n.id, label: n.label, sub: "tab", icon: n.icon }));
    const tools = allTools.filter(t => !q || t.name.includes(q.toLowerCase()) || t.summary.toLowerCase().includes(q.toLowerCase())).slice(0, 20).map(t => ({ type: "tool" as const, id: t.name, label: t.name, sub: t.summary, icon: { low: "○", medium: "◐", high: "●" }[t.risk] }));
    return [...nav, ...tools];
  }, [q, allTools]);

  useEffect(() => { setCursor(0); }, [q]);

  const select = (item: typeof items[0]) => {
    if (item.type === "nav") onTab(item.id);
    else onTool(item.id);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh" }} onClick={onClose}>
      <div style={{ width: 560, background: "var(--surface,#1a1a1a)", border: "1px solid var(--border-strong,#444)", borderRadius: 10, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border,#333)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)" }}>⌘</span>
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Navegar ou buscar tool…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text,#ccc)" }}
            onKeyDown={e => {
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c + 1, items.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
              if (e.key === "Enter" && items[cursor]) select(items[cursor]);
              if (e.key === "Escape") onClose();
            }}
          />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", padding: "1px 5px", border: "1px solid var(--border,#333)", borderRadius: 3 }}>esc</span>
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {items.length === 0 && <div style={{ padding: "16px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>Nenhum resultado</div>}
          {items.map((item, i) => (
            <button key={item.id} onClick={() => select(item)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 14px", background: i === cursor ? "rgba(255,255,255,.07)" : "transparent", border: "none", borderBottom: "1px solid var(--border,#222)", cursor: "pointer", textAlign: "left" }} onMouseEnter={() => setCursor(i)}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", width: 14, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text,#ccc)", flex: 1 }}>{item.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", opacity: 0.6 }}>{item.sub}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: "6px 14px", borderTop: "1px solid var(--border,#222)", display: "flex", gap: 12 }}>
          {[["↑↓","navegar"],["↵","selecionar"],["esc","fechar"]].map(([k, l]) => (
            <span key={k} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>
              <span style={{ padding: "1px 4px", border: "1px solid var(--border,#333)", borderRadius: 2, marginRight: 4 }}>{k}</span>{l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── state builder (pure) ──────────────────────────────────────────────────────

function buildState(mode: string, forceError: boolean, liveHealth: HealthzResponse | null, liveInfo: Partial<ServerInfoFlags> | null) {
  const base = SERVER_STATES[mode] ?? SERVER_STATES['read_only'];
  const livePosure = liveInfo
    ? liveInfo.read_only ? "safe" : liveInfo.dangerous_tools_enabled ? "operator" : "balanced"
    : null;
  return {
    ...base,
    posture: (livePosure === "operator" ? "elevated" : livePosure ?? base.posture) as 'safe'|'balanced'|'elevated',
    label: livePosure ? ({ safe:"Read-only", balanced:"Write-safe pessoal", operator:"Operador" }[livePosure] ?? base.label) : base.label,
    healthz: forceError
      ? { ...base.healthz, ok: false, commit_sha: "—", uptime_seconds: 0 }
      : liveHealth
        ? { ok: liveHealth.ok, service: liveHealth.service, version: liveHealth.version, tool_schema_version: liveHealth.tool_schema_version, commit_sha: liveHealth.commit_sha ?? "live", uptime_seconds: liveHealth.uptime_seconds ?? 0 }
        : base.healthz,
    server_info: liveInfo ? {
      read_only: liveInfo.read_only ?? base.server_info.read_only,
      dangerous_tools_enabled: liveInfo.dangerous_tools_enabled ?? base.server_info.dangerous_tools_enabled,
      workflow_dispatch_enabled: liveInfo.workflow_dispatch_enabled ?? base.server_info.workflow_dispatch_enabled,
      require_allowed_repos: liveInfo.require_allowed_repos ?? base.server_info.require_allowed_repos,
      protected_branches_configured: liveInfo.protected_branches_configured ?? base.server_info.protected_branches_configured,
      oauth_redirect_allowlist_configured: liveInfo.oauth_redirect_allowlist_configured ?? base.server_info.oauth_redirect_allowlist_configured,
      oauth_rate_limit_enabled: liveInfo.oauth_rate_limit_enabled ?? base.server_info.oauth_rate_limit_enabled,
      tool_catalog_refresh_supported: liveInfo.tool_catalog_refresh_supported ?? base.server_info.tool_catalog_refresh_supported,
      allowed_repos_configured: liveInfo.allowed_repos_configured ?? base.server_info.allowed_repos_configured,
      classic_pat_for_projects_configured: liveInfo.classic_pat_for_projects_configured ?? base.server_info.classic_pat_for_projects_configured,
    } : base.server_info,
  };
}

// ── ConsoleA (main) ───────────────────────────────────────────────────────────

type ConsoleAProps = { mode?: string; density?: string; forceError?: boolean; serverUrl?: string; bearerToken?: string; vercelToken?: string };

export default function ConsoleA({ mode = "read_only", density = "compact", forceError = false, serverUrl = "", bearerToken = "", vercelToken = "" }: ConsoleAProps) {
  const [liveHealth, setLiveHealth] = useState<HealthzResponse | null>(null);
  const [liveInfo, setLiveInfo] = useState<Partial<ServerInfoFlags> | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [liveTools, setLiveTools] = useState<string[] | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [liveAudit, setLiveAudit] = useState<BffAuditEvent[] | null>(null);
  const [bffUser, setBffUser] = useState<BffUser | null>(null);
  const [bffCapabilities, setBffCapabilities] = useState<BffCapabilities | null>(null);
  const [healthLatencyMs, setHealthLatencyMs] = useState<number | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const runtimeMode = !serverUrl ? 'demo' : fetchError ? 'degraded' : liveHealth ? 'bff-live' : 'connecting';
  const isDemo = runtimeMode === 'demo';

  useEffect(() => {
    if (!serverUrl) { setLiveHealth(null); setLiveInfo(null); setFetchError(false); return; }
    let cancelled = false;
    const authHeaders: Record<string, string> = bearerToken ? { "Authorization": `Bearer ${bearerToken}` } : {};
    const fetchHealth = async () => {
      const t0 = Date.now();
      try {
        const r = await fetch(`${serverUrl}/healthz`, { signal: AbortSignal.timeout(5000) });
        if (!r.ok) throw new Error("non-200");
        const data = await r.json();
        if (!cancelled) { setLiveHealth(data); setFetchError(false); setLastRefreshed(new Date()); setHealthLatencyMs(Date.now() - t0); }
      } catch { if (!cancelled) { setFetchError(true); setHealthLatencyMs(null); } }
    };
    const fetchServerInfo = async () => {
      try {
        const info = await callBffTool<Partial<ServerInfoFlags>>(serverUrl, "server_info", {}, { bearerToken, timeoutMs: 6000 });
        if (!cancelled) setLiveInfo(info);
      } catch { /**/ }
    };
    fetchHealth(); fetchServerInfo();
    const iv = setInterval(() => { fetchHealth(); fetchServerInfo(); }, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [serverUrl, bearerToken]);

  useEffect(() => {
    if (!serverUrl) { setLiveTools(null); return; }
    let cancelled = false;
    const authHeaders: Record<string, string> = bearerToken ? { "Authorization": `Bearer ${bearerToken}` } : {};
    const fetchToolsList = async () => {
      try {
        const csrf = getCsrfToken();
        const csrfHeader: Record<string, string> = csrf ? { "X-CSRF-Token": csrf } : {};
        const r = await fetch(`${serverUrl}/mcp`, { method:"POST", credentials:"include", headers:{"Content-Type":"application/json",...authHeaders,...csrfHeader}, body:JSON.stringify({jsonrpc:"2.0",id:99,method:"tools/list",params:{}}), signal:AbortSignal.timeout(8000) });
        if (!r.ok) return;
        const data = await r.json();
        const names = (data?.result?.tools ?? []).map((t: { name: string }) => t.name);
        if (!cancelled && names.length > 0) setLiveTools(names);
      } catch { /**/ }
    };
    fetchToolsList();
    return () => { cancelled = true; };
  }, [serverUrl, bearerToken]);

  useEffect(() => {
    if (!serverUrl) { setLiveAudit(null); setBffUser(null); setBffCapabilities(null); return; }
    let cancelled = false;
    const fetchAudit = async () => {
      try {
        const data = await fetchBffAudit<BffAuditEvent>(serverUrl, 100, 5000);
        if (!cancelled && Array.isArray(data.events)) setLiveAudit(data.events);
      } catch { if (!cancelled) setLiveAudit(null); }
    };
    const fetchUser = async () => {
      try {
        const capabilities = await fetchBffCapabilities(serverUrl, 3000);
        if (!cancelled) {
          setBffCapabilities(capabilities);
          setBffUser(capabilities.user ?? null);
        }
      } catch {
        try {
          const session = await fetchBffSession(serverUrl, 3000);
          if (!cancelled) setBffUser(session);
        } catch { if (!cancelled) { setBffUser(null); setBffCapabilities(null); } }
      }
    };
    fetchAudit();
    fetchUser();
    const iv = setInterval(fetchAudit, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [serverUrl]);

  const state = useMemo(() => buildState(mode, forceError, liveHealth, liveInfo), [mode, forceError, liveHealth, liveInfo]);

  // When logged in as operator/admin via BFF, unlock write/destructive tools in playground
  const effectiveMode = useMemo(() => {
    if (bffUser?.role === "admin" || bffUser?.role === "operator") return "operator";
    return mode;
  }, [bffUser, mode]);

  const initial = readHash();
  const [tab, setTab] = useState(initial.tab);
  const [riskFilter, setRiskFilter] = useState(initial.risk);
  const [phaseFilter, setPhaseFilter] = useState(initial.phase);
  const [query, setQuery] = useState(initial.q);
  const [openTool, setOpenTool] = useState(initial.tool);
  const [playgroundTool, setPlaygroundTool] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const gPressedRef = useRef(0);

  useEffect(() => { writeHash({ tab, risk: riskFilter, phase: phaseFilter, q: query, tool: openTool }); }, [tab, riskFilter, phaseFilter, query, openTool]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = ((e.target as HTMLElement).tagName ?? "").toLowerCase();
      const inField = tag === "input" || tag === "textarea" || tag === "select";
      if (e.key === "Escape") { if (showPalette) { setShowPalette(false); return; } if (showHelp) { setShowHelp(false); return; } if (openTool) { setOpenTool(""); return; } if (inField) (e.target as HTMLElement).blur(); return; }
      if ((e.key === "k" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); setShowPalette(p => !p); return; }
      if (e.key === "?" && !inField) { setShowHelp(h => !h); return; }
      if (inField) return;
      if (e.key === "/") { e.preventDefault(); setTab("tools"); setTimeout(() => searchRef.current?.focus(), 30); return; }
      if (e.key === "g") { gPressedRef.current = Date.now(); return; }
      const within = Date.now() - gPressedRef.current < 800;
      if (within) {
        const map: Record<string, string> = { o:"overview", t:"tools", s:"security", a:"audit", r:"runbook", p:"playground", b:"pr", e:"wizard", v:"vercel" };
        if (map[e.key]) { setTab(map[e.key]); gPressedRef.current = 0; }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openTool, showHelp, showPalette]);

  const allTools = useMemo(() => TOOL_CATALOG.flatMap(p => p.tools.map(t => ({ ...t, phase: p.phase }))), []);

  const bffPolicyByTool = useMemo(() => {
    const entries = bffCapabilities?.tools ?? [];
    return entries.reduce<Record<string, BffToolPolicy>>((acc, policy) => {
      acc[policy.name] = policy;
      return acc;
    }, {});
  }, [bffCapabilities]);

  const drift = useMemo((): DriftInfo | null => {
    const catalogNames = new Set(allTools.map(t => t.name));
    if (liveTools && liveTools.length > 0) {
      const liveSet = new Set(liveTools);
      return { newTools: liveTools.filter(n => !catalogNames.has(n)), missingTools: allTools.filter(t => !liveSet.has(t.name) && !t.planned).map(t => t.name), demo: false };
    }
    if (!serverUrl) return { newTools: ["github_assign_issue", "pr_add_label"], missingTools: [], demo: true };
    return null;
  }, [liveTools, allTools, serverUrl]);

  const filteredTools = useMemo(() => allTools.filter(t => {
    if (riskFilter !== "all" && t.risk !== riskFilter) return false;
    if (phaseFilter !== "all" && t.phase !== phaseFilter) return false;
    if (query && !t.name.toLowerCase().includes(query.toLowerCase()) && !t.summary.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [allTools, riskFilter, phaseFilter, query]);

  const totals = useMemo(() => ({ all: allTools.length, low: allTools.filter(t => t.risk === "low").length, medium: allTools.filter(t => t.risk === "medium").length, high: allTools.filter(t => t.risk === "high").length }), [allTools]);

  const rowPad = density === "compact" ? "8px 14px" : "12px 16px";
  const cellFs = density === "compact" ? 12.5 : 13.5;
  const activeTool = openTool ? allTools.find(t => t.name === openTool) ?? null : null;

  const sparkData = useMemo(() => {
    const seed = (ep: string, i: number) => {
      const base = ({"/oauth/register":3,"/oauth/authorize":10,"/oauth/token":24,"GitHub REST":900,"GitHub GraphQL":200} as Record<string,number>)[ep] ?? 10;
      return Math.max(0, Math.round(base + Math.sin(i * 1.7 + ep.length) * base * 0.4));
    };
    return RATE_LIMITS.reduce((acc: Record<string, number[]>, r) => { acc[r.endpoint] = Array.from({length:16},(_,i)=>seed(r.endpoint,i)); return acc; }, {});
  }, []);

  return (
    <div className="ca-root" data-density={density}>
      {forceError && (
        <div className="ca-incident"><StatusDot tone="danger" /><span className="mono ca-incident-label">INCIDENT</span><span className="ca-incident-msg">healthz returned 503 — deploy possivelmente em estado inconsistente</span><span className="mono ca-incident-meta">last good commit · 7ff00f7 · 14:18 UTC</span></div>
      )}

      <header className="ca-topbar">
        <div className="ca-brand"><div className="ca-brand-mark">◢◣</div><div className="ca-brand-text"><div className="ca-brand-name">github-unified-mcp</div><div className="ca-brand-sub">painel de operador · console</div></div></div>
        <div className="ca-topbar-mid">
          {runtimeMode === 'demo' && !forceError && <div className="ca-topbar-pill ca-topbar-demo"><span className="mono">DEMO</span><span className="ca-demo-sep">·</span><span className="ca-demo-hint">sem URL configurada</span></div>}
          {runtimeMode === 'connecting' && <div className="ca-topbar-pill"><StatusDot tone="warn" /><span className="mono">CONNECTING · BFF</span></div>}
          {runtimeMode === 'degraded' && <div className="ca-topbar-pill" style={{ borderColor: 'rgba(230,110,100,.35)', color: 'var(--danger)' }}><StatusDot tone="danger" /><span className="mono">DEGRADED · BFF indisponível</span></div>}
          {runtimeMode === 'bff-live' && liveHealth && <div className="ca-topbar-pill ca-topbar-live"><StatusDot tone="ok" /><span className="mono">BFF LIVE{liveInfo ? " · flags reais" : ""}</span></div>}
          <div className="ca-topbar-pill"><StatusDot tone={state.healthz.ok ? "ok" : "danger"} /><span className="mono">healthz · {state.healthz.ok ? "200 OK" : "503 FAIL"}</span></div>
          <div className="ca-topbar-pill"><span className="ca-pill-k">commit</span><span className="mono">{state.healthz.commit_sha}</span></div>
          <div className="ca-topbar-pill"><span className="ca-pill-k">schema</span><span className="mono">{state.healthz.tool_schema_version}</span></div>
          <div className="ca-topbar-pill"><span className="ca-pill-k">uptime</span><LiveUptime baseSeconds={state.healthz.uptime_seconds} stopped={forceError} /></div>
          {lastRefreshed && runtimeMode === 'bff-live' && (
            <div className="ca-topbar-pill" style={{ opacity: 0.6 }}>
              <span className="ca-pill-k">sync</span>
              <span className="mono">{lastRefreshed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          )}
          {healthLatencyMs !== null && runtimeMode === 'bff-live' && (
            <div className="ca-topbar-pill" style={{ gap: 4 }}>
              <span className="ca-pill-k">ping</span>
              <span className="mono" style={{ color: healthLatencyMs < 300 ? "var(--ok)" : healthLatencyMs < 1000 ? "var(--warn)" : "var(--danger)" }}>{healthLatencyMs}ms</span>
            </div>
          )}
          {serverUrl && (
            <button
              onClick={async () => {
                setReconnecting(true);
                const t0 = Date.now();
                try {
                  const r = await fetch(`${serverUrl}/healthz`, { signal: AbortSignal.timeout(5000) });
                  if (!r.ok) throw new Error();
                  const data = await r.json();
                  setLiveHealth(data); setFetchError(false); setLastRefreshed(new Date()); setHealthLatencyMs(Date.now() - t0);
                } catch { setFetchError(true); setHealthLatencyMs(null); }
                setReconnecting(false);
              }}
              style={{ fontFamily: "monospace", fontSize: 10, padding: "2px 7px", border: "1px solid var(--border,#333)", borderRadius: 3, background: "transparent", color: "var(--text-dim,#888)", cursor: "pointer" }}
              title="Reconectar ao servidor"
            >
              {reconnecting ? "…" : "⟳"}
            </button>
          )}
        </div>
        <div className="ca-topbar-right" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {serverUrl && (
            bffUser
              ? <div className="ca-topbar-pill" style={{ gap: 6 }}>
                  <StatusDot tone="ok" />
                  <span className="mono" style={{ fontSize: 11 }}>{bffUser.user}</span>
                  <button onClick={async () => { try { await logoutBffSession(serverUrl); } finally { setBffUser(null); setLiveAudit(null); } }} style={{ fontFamily: "monospace", fontSize: 10, background: "transparent", border: "1px solid var(--border,#333)", borderRadius: 3, color: "var(--text-dim,#888)", cursor: "pointer", padding: "1px 6px" }}>logout</button>
                </div>
              : <a href={`${serverUrl.replace(/\/$/, "")}/auth/login`} title="Login no GitHub via BFF" style={{ fontFamily: "monospace", fontSize: 11, padding: "3px 10px", border: "1px solid var(--border,#333)", borderRadius: 4, color: "var(--text,#ccc)", textDecoration: "none", background: "transparent" }}>login ↗</a>
          )}
          <div className={`ca-mode ca-mode-${state.posture}`}><span className="ca-mode-dot" /><span className="ca-mode-label">{state.label}</span></div>
        </div>
      </header>

      <nav className="ca-tabs">
        {([["overview","Overview","o"],["tools",`Tool catalog · ${totals.all}`,"t"],["security","Security posture","s"],["audit","Audit log","a"],["runbook","Runbook","r"],["playground","Playground ▶","p"],["pr","PR Readiness","b"],["wizard",".env wizard","e"],["vercel","Vercel ▲","v"]] as [string,string,string][]).map(([k,label,key]) => (
          <button key={k} onClick={() => setTab(k)} className={`ca-tab ${tab === k ? "is-active" : ""}`}>{label}<span className="ca-tab-key mono">g{key}</span></button>
        ))}
        <div className="ca-tabs-spacer" />
        <div className="ca-tabs-meta mono"><span className="ca-kbd">⌘K</span> palette<span className="ca-kbd">/</span> grep<span className="ca-kbd">g</span><span className="ca-kbd">·</span> nav<span className="ca-kbd">esc</span> close<span className="ca-kbd">?</span> help</div>
      </nav>

      <div className="ca-body">
        {tab === "overview" && <OverviewA state={state} forceError={forceError} sparkData={sparkData} />}
        {tab === "tools" && <ToolsA tools={filteredTools} totals={totals} riskFilter={riskFilter} setRiskFilter={setRiskFilter} phaseFilter={phaseFilter} setPhaseFilter={setPhaseFilter} query={query} setQuery={setQuery} rowPad={rowPad} cellFs={cellFs} mode={mode} onOpen={t => setOpenTool(t.name)} searchRef={searchRef} drift={drift} />}
        {tab === "security" && <SecurityA state={state} />}
        {tab === "audit" && <AuditA rowPad={rowPad} cellFs={cellFs} liveEvents={liveAudit} isLive={!!serverUrl && liveAudit !== null} />}
        {tab === "runbook" && <RunbookA state={state} />}
        {tab === "wizard" && <EnvWizard />}
        {tab === "playground" && <PlaygroundA serverUrl={serverUrl} mode={effectiveMode} initialTool={playgroundTool} bearerToken={bearerToken} bffRole={bffUser?.role} bffPolicyByTool={bffPolicyByTool} runtimeMode={runtimeMode} />}
        {tab === "pr" && <PrReadyA serverUrl={serverUrl} mode={mode} bearerToken={bearerToken} />}
        {tab === "vercel" && <VercelDeployTab serverUrl={serverUrl} bearerToken={vercelToken || bearerToken} />}
      </div>

      {activeTool && <ToolDrawer tool={activeTool} mode={mode} onClose={() => setOpenTool("")} onPlayground={name => { setPlaygroundTool(name); setTab("playground"); setOpenTool(""); }} />}

      {showPalette && (
        <CommandPalette
          allTools={allTools}
          onClose={() => setShowPalette(false)}
          onTab={t => setTab(t)}
          onTool={name => setOpenTool(name)}
        />
      )}

      {showHelp && (
        <div className="ca-help-overlay" onClick={() => setShowHelp(false)}>
          <div className="ca-help-modal" onClick={e => e.stopPropagation()}>
            <div className="ca-help-title">atalhos de teclado</div>
            <div className="ca-help-grid">
              {([[[" g","o"],"Overview"],[["g","t"],"Tool catalog"],[["g","s"],"Security"],[["g","a"],"Audit log"],[["g","r"],"Runbook"],[["g","p"],"Playground"],[["g","b"],"PR Readiness"],[["g","e"],".env wizard"],[["g","v"],"Vercel Deploy"]] as [string[], string][]).map(([keys,label]) => (
                <div key={label} className="ca-help-row">
                  <div className="ca-help-keys">{keys.map((k,i) => <span key={i}><span className="ca-kbd">{k.trim()}</span>{i < keys.length-1 && <span style={{color:"var(--text-muted)",fontSize:10}}>+</span>}</span>)}</div>
                  <span className="ca-help-desc">{label}</span>
                </div>
              ))}
              <div className="ca-help-sep" />
              <div className="ca-help-row"><div className="ca-help-keys"><span className="ca-kbd">/</span></div><span className="ca-help-desc">grep tools</span></div>
              <div className="ca-help-row"><div className="ca-help-keys"><span className="ca-kbd">esc</span></div><span className="ca-help-desc">fechar drawer/modal</span></div>
            </div>
            <div className="ca-help-footer">pressione <span className="ca-kbd">?</span> ou clique fora para fechar</div>
          </div>
        </div>
      )}
    </div>
  );
}
