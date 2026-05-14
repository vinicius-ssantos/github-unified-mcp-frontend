// Direction A — Console denso (v2 with drawer + permalink + shortcuts + error state)

const { useState, useMemo, useEffect, useRef } = React;

const formatUptime = (s) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
};

// Isolated uptime ticker — only this tiny component re-renders every second
function LiveUptime({ baseSeconds, stopped }) {
  const [delta, setDelta] = React.useState(0);
  React.useEffect(() => { setDelta(0); }, [baseSeconds]);
  React.useEffect(() => {
    if (stopped) return;
    const iv = setInterval(() => setDelta(d => d + 1), 1000);
    return () => clearInterval(iv);
  }, [stopped]);
  return <span className="mono">{formatUptime(baseSeconds + delta)}</span>;
}

const RISK_TONE = {
  low: { label: "low", bg: "rgba(120, 200, 160, 0.14)", fg: "var(--ok)", border: "rgba(120, 200, 160, 0.30)" },
  medium: { label: "med", bg: "rgba(220, 180, 100, 0.14)", fg: "var(--warn)", border: "rgba(220, 180, 100, 0.30)" },
  high: { label: "high", bg: "rgba(230, 120, 110, 0.14)", fg: "var(--danger)", border: "rgba(230, 120, 110, 0.30)" },
};

function StatusDot({ tone = "ok" }) {
  const colors = { ok: "var(--ok)", warn: "var(--warn)", danger: "var(--danger)", info: "var(--info)", muted: "var(--text-dim)" };
  return (
    <span style={{
      display: "inline-block", width: 7, height: 7, borderRadius: "50%",
      background: colors[tone] || colors.muted,
    }} />
  );
}

function readHash() {
  const h = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(h);
  return {
    tab: params.get("tab") || "overview",
    risk: params.get("risk") || "all",
    phase: params.get("phase") || "all",
    q: params.get("q") || "",
    tool: params.get("tool") || "",
  };
}

function writeHash(state) {
  const params = new URLSearchParams();
  if (state.tab && state.tab !== "overview") params.set("tab", state.tab);
  if (state.risk && state.risk !== "all") params.set("risk", state.risk);
  if (state.phase && state.phase !== "all") params.set("phase", state.phase);
  if (state.q) params.set("q", state.q);
  if (state.tool) params.set("tool", state.tool);
  const next = params.toString();
  const url = next ? `#${next}` : window.location.pathname + window.location.search;
  if (window.location.hash.replace(/^#/, "") !== next) {
    history.replaceState(null, "", url);
  }
}

function ConsoleA({ mode = "read_only", density = "compact", forceError = false, serverUrl = "", bearerToken = "" }) {
  const baseState = window.SERVER_STATES[mode];
  const [liveHealth, setLiveHealth] = React.useState(null);
  const [liveInfo, setLiveInfo] = React.useState(null); // from server_info tool
  const [fetchError, setFetchError] = React.useState(false);
  const [liveTools, setLiveTools] = React.useState(null); // from tools/list
  const [lastRefreshed, setLastRefreshed] = React.useState(null);
  const isDemo = !serverUrl || fetchError || liveHealth === null;

  // Live fetch /healthz every 30s
  useEffect(() => {
    if (!serverUrl) { setLiveHealth(null); setLiveInfo(null); setFetchError(false); return; }
    let cancelled = false;
    const fetchHealth = async () => {
      try {
        const r = await fetch(`${serverUrl}/healthz`, { signal: AbortSignal.timeout(5000) });
        if (!r.ok) throw new Error("non-200");
        const data = await r.json();
        if (!cancelled) { setLiveHealth(data); setFetchError(false); setLastRefreshed(new Date()); }
      } catch {
        if (!cancelled) setFetchError(true);
      }
    };
    const authHeaders = bearerToken ? { "Authorization": `Bearer ${bearerToken}` } : {};
    // Live fetch server_info via MCP call
    const fetchServerInfo = async () => {
      try {
        const r = await fetch(`${serverUrl}/mcp`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "server_info", arguments: {} } }),
          signal: AbortSignal.timeout(6000),
        });
        if (!r.ok) return;
        const data = await r.json();
        const result = data?.result?.content?.[0]?.text;
        if (result && !cancelled) {
          try { setLiveInfo(JSON.parse(result)); } catch {}
        }
      } catch {}
    };
    fetchHealth();
    fetchServerInfo();
    const iv = setInterval(() => { fetchHealth(); fetchServerInfo(); }, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [serverUrl, bearerToken]);

  // Fetch tools/list once on connect for schema drift detection
  useEffect(() => {
    if (!serverUrl) { setLiveTools(null); return; }
    let cancelled = false;
    const authHeaders = bearerToken ? { "Authorization": `Bearer ${bearerToken}` } : {};
    const fetchToolsList = async () => {
      try {
        const r = await fetch(`${serverUrl}/mcp`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list", params: {} }),
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return;
        const data = await r.json();
        const names = (data?.result?.tools || []).map(t => t.name);
        if (!cancelled && names.length > 0) setLiveTools(names);
      } catch {}
    };
    fetchToolsList();
    return () => { cancelled = true; };
  }, [serverUrl]);

  // Merge live server_info flags into state when available
  const livePosure = liveInfo
    ? liveInfo.read_only ? "safe"
      : liveInfo.dangerous_tools_enabled ? "operator"
      : "balanced"
    : null;

  const state = {
    ...baseState,
    posture: livePosure || baseState.posture,
    label: livePosure
      ? { safe: "Read-only", balanced: "Write-safe pessoal", operator: "Operador" }[livePosure]
      : baseState.label,
    healthz: forceError
      ? { ...baseState.healthz, ok: false, commit_sha: "—", uptime_seconds: 0 }
      : liveHealth
      ? { ok: liveHealth.ok, service: liveHealth.service, version: liveHealth.version, tool_schema_version: liveHealth.tool_schema_version, commit_sha: liveHealth.commit_sha || "live", uptime_seconds: liveHealth.uptime_seconds || 0 }
      : baseState.healthz,
    server_info: liveInfo
      ? {
          read_only: liveInfo.read_only ?? baseState.server_info.read_only,
          dangerous_tools_enabled: liveInfo.dangerous_tools_enabled ?? baseState.server_info.dangerous_tools_enabled,
          workflow_dispatch_enabled: liveInfo.workflow_dispatch_enabled ?? baseState.server_info.workflow_dispatch_enabled,
          require_allowed_repos: liveInfo.require_allowed_repos ?? baseState.server_info.require_allowed_repos,
          protected_branches_configured: liveInfo.protected_branches_configured ?? baseState.server_info.protected_branches_configured,
          oauth_redirect_allowlist_configured: liveInfo.oauth_redirect_allowlist_configured ?? baseState.server_info.oauth_redirect_allowlist_configured,
          oauth_rate_limit_enabled: liveInfo.oauth_rate_limit_enabled ?? baseState.server_info.oauth_rate_limit_enabled,
          tool_catalog_refresh_supported: liveInfo.tool_catalog_refresh_supported ?? baseState.server_info.tool_catalog_refresh_supported,
          allowed_repos_configured: liveInfo.allowed_repos_configured ?? baseState.server_info.allowed_repos_configured,
          classic_pat_for_projects_configured: liveInfo.classic_pat_for_projects_configured ?? baseState.server_info.classic_pat_for_projects_configured,
        }
      : baseState.server_info,
  };

  const initial = readHash();
  const [tab, setTab] = useState(initial.tab);
  const [riskFilter, setRiskFilter] = useState(initial.risk);
  const [phaseFilter, setPhaseFilter] = useState(initial.phase);
  const [query, setQuery] = useState(initial.q);
  const [openTool, setOpenTool] = useState(initial.tool);
  const [playgroundTool, setPlaygroundTool] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const searchRef = useRef(null);
  const gPressedRef = useRef(0);

  // Permalink sync
  useEffect(() => {
    writeHash({ tab, risk: riskFilter, phase: phaseFilter, q: query, tool: openTool });
  }, [tab, riskFilter, phaseFilter, query, openTool]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      const inField = tag === "input" || tag === "textarea" || tag === "select";

      if (e.key === "Escape") {
        if (showHelp) { setShowHelp(false); return; }
        if (openTool) { setOpenTool(""); return; }
        if (inField) e.target.blur();
        return;
      }
      if (e.key === "?" && !inField) { setShowHelp(h => !h); return; }
      if (inField) return;

      if (e.key === "/") {
        e.preventDefault();
        setTab("tools");
        setTimeout(() => searchRef.current && searchRef.current.focus(), 30);
        return;
      }

      if (e.key === "g") {
        gPressedRef.current = Date.now();
        return;
      }
      const within = Date.now() - gPressedRef.current < 800;
      if (within) {
        if (e.key === "o") { setTab("overview"); gPressedRef.current = 0; }
        else if (e.key === "t") { setTab("tools"); gPressedRef.current = 0; }
        else if (e.key === "s") { setTab("security"); gPressedRef.current = 0; }
        else if (e.key === "a") { setTab("audit"); gPressedRef.current = 0; }
        else if (e.key === "r") { setTab("runbook"); gPressedRef.current = 0; }
        else if (e.key === "p") { setTab("playground"); gPressedRef.current = 0; }
        else if (e.key === "b") { setTab("pr"); gPressedRef.current = 0; }
        else if (e.key === "e") { setTab("wizard"); gPressedRef.current = 0; }
        else if (e.key === "v") { setTab("vercel"); gPressedRef.current = 0; }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openTool]);

  const allTools = useMemo(() => window.TOOL_CATALOG.flatMap(p => p.tools.map(t => ({ ...t, phase: p.phase }))), []);

  // Schema drift: compare local catalog vs live server tools/list
  const drift = useMemo(() => {
    const catalogNames = new Set(allTools.map(t => t.name));
    if (liveTools && liveTools.length > 0) {
      const liveSet = new Set(liveTools);
      return {
        newTools: liveTools.filter(n => !catalogNames.has(n)),
        missingTools: allTools.filter(t => !liveSet.has(t.name) && !t.planned).map(t => t.name),
        demo: false,
      };
    }
    // Demo mode: simulate example drift to showcase the feature
    if (!serverUrl) {
      return { newTools: ["github_assign_issue", "pr_add_label"], missingTools: [], demo: true };
    }
    return null;
  }, [liveTools, allTools, serverUrl]);
  const filteredTools = useMemo(() => allTools.filter(t => {
    if (riskFilter !== "all" && t.risk !== riskFilter) return false;
    if (phaseFilter !== "all" && t.phase !== phaseFilter) return false;
    if (query && !t.name.toLowerCase().includes(query.toLowerCase()) && !t.summary.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [allTools, riskFilter, phaseFilter, query]);

  const totals = useMemo(() => ({
    all: allTools.length,
    low: allTools.filter(t => t.risk === "low").length,
    medium: allTools.filter(t => t.risk === "medium").length,
    high: allTools.filter(t => t.risk === "high").length,
  }), [allTools]);

  const rowPad = density === "compact" ? "8px 14px" : "12px 16px";
  const cellFs = density === "compact" ? 12.5 : 13.5;

  const activeTool = openTool ? allTools.find(t => t.name === openTool) : null;

  // Sparkline data — fake history for each rate-limit endpoint
  const sparkData = useMemo(() => {
    const seed = (ep, i) => {
      const base = { "/oauth/register": 3, "/oauth/authorize": 10, "/oauth/token": 24, "GitHub REST": 900, "GitHub GraphQL": 200 }[ep] || 10;
      return Math.max(0, Math.round(base + Math.sin(i * 1.7 + ep.length) * base * 0.4));
    };
    return window.RATE_LIMITS.reduce((acc, r) => {
      acc[r.endpoint] = Array.from({ length: 16 }, (_, i) => seed(r.endpoint, i));
      return acc;
    }, {});
  }, []);

  return (
    <div className="ca-root" data-density={density}>
      {forceError && (
        <div className="ca-incident">
          <StatusDot tone="danger" />
          <span className="mono ca-incident-label">INCIDENT</span>
          <span className="ca-incident-msg">healthz returned 503 — deploy possivelmente em estado inconsistente</span>
          <span className="mono ca-incident-meta">last good commit · 7ff00f7 · 14:18 UTC</span>
        </div>
      )}

      <header className="ca-topbar">
        <div className="ca-brand">
          <div className="ca-brand-mark">◢◣</div>
          <div className="ca-brand-text">
            <div className="ca-brand-name">github-unified-mcp</div>
            <div className="ca-brand-sub">painel de operador · console</div>
          </div>
        </div>
        <div className="ca-topbar-mid">
          {isDemo && !forceError && (
            <div className="ca-topbar-pill ca-topbar-demo">
              <span className="mono">DEMO</span>
              <span className="ca-demo-sep">·</span>
              <span className="ca-demo-hint">{serverUrl ? "erro ao conectar" : "sem URL configurada"}</span>
            </div>
          )}
          {!isDemo && liveHealth && (
            <div className="ca-topbar-pill ca-topbar-live">
              <StatusDot tone="ok" />
              <span className="mono">LIVE{liveInfo ? " · flags reais" : ""}</span>
            </div>
          )}
          <div className="ca-topbar-pill">
            <StatusDot tone={state.healthz.ok ? "ok" : "danger"} />
            <span className="mono">healthz · {state.healthz.ok ? "200 OK" : "503 FAIL"}</span>
          </div>
          <div className="ca-topbar-pill">
            <span className="ca-pill-k">commit</span>
            <span className="mono">{state.healthz.commit_sha}</span>
          </div>
          <div className="ca-topbar-pill">
            <span className="ca-pill-k">schema</span>
            <span className="mono">{state.healthz.tool_schema_version}</span>
          </div>
          <div className="ca-topbar-pill">
            <span className="ca-pill-k">uptime</span>
            <LiveUptime baseSeconds={state.healthz.uptime_seconds} stopped={forceError} />
          </div>
          {lastRefreshed && !isDemo && (
            <div className="ca-topbar-pill" style={{ opacity: 0.6 }}>
              <span className="ca-pill-k">sync</span>
              <span className="mono">{lastRefreshed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </div>
          )}
        </div>
        <div className="ca-topbar-right">
          <div className={`ca-mode ca-mode-${state.posture}`}>
            <span className="ca-mode-dot" />
            <span className="ca-mode-label">{state.label}</span>
          </div>
        </div>
      </header>

      <nav className="ca-tabs">
        {[
          ["overview", "Overview", "o"],
          ["tools", `Tool catalog · ${totals.all}`, "t"],
          ["security", "Security posture", "s"],
          ["audit", "Audit log", "a"],
          ["runbook", "Runbook", "r"],
          ["playground", "Playground ▶", "p"],
          ["pr", "PR Readiness", "b"],
          ["wizard", ".env wizard", "e"],
          ["vercel", "Vercel ▲", "v"],
        ].map(([k, label, key]) => (          <button key={k} onClick={() => setTab(k)} className={`ca-tab ${tab === k ? "is-active" : ""}`}>
            {label}
            <span className="ca-tab-key mono">g{key}</span>
          </button>
        ))}
        <div className="ca-tabs-spacer" />
        <div className="ca-tabs-meta mono">
          <span className="ca-kbd">/</span> grep
          <span className="ca-kbd">g</span><span className="ca-kbd">·</span> nav
          <span className="ca-kbd">esc</span> close
          <span className="ca-kbd">?</span> help
        </div>
      </nav>

      <div className="ca-body">
        {tab === "overview" && <OverviewA state={state} forceError={forceError} sparkData={sparkData} />}
        {tab === "tools" && (
          <ToolsA
            tools={filteredTools}
            totals={totals}
            riskFilter={riskFilter}
            setRiskFilter={setRiskFilter}
            phaseFilter={phaseFilter}
            setPhaseFilter={setPhaseFilter}
            query={query}
            setQuery={setQuery}
            rowPad={rowPad}
            cellFs={cellFs}
            mode={mode}
            onOpen={(t) => setOpenTool(t.name)}
            searchRef={searchRef}
            drift={drift}
          />
        )}
        {tab === "security" && <SecurityA state={state} />}
        {tab === "audit" && <AuditA rowPad={rowPad} cellFs={cellFs} />}
        {tab === "runbook" && <RunbookA state={state} />}
        {tab === "wizard" && <window.EnvWizard />}
        {tab === "playground" && window.PlaygroundA && <window.PlaygroundA serverUrl={serverUrl} mode={mode} initialTool={playgroundTool} bearerToken={bearerToken} />}
        {tab === "pr" && window.PrReadyA && <window.PrReadyA serverUrl={serverUrl} mode={mode} bearerToken={bearerToken} />}
        {tab === "vercel" && window.VercelDeployA && <window.VercelDeployA serverUrl={serverUrl} bearerToken={bearerToken} />}
      </div>

      {activeTool && <window.ToolDrawer
        tool={activeTool} mode={mode} onClose={() => setOpenTool("")}
        onPlayground={(name) => { setPlaygroundTool(name); setTab("playground"); setOpenTool(""); }}
      />}

      {showHelp && (
        <div className="ca-help-overlay" onClick={() => setShowHelp(false)}>
          <div className="ca-help-modal" onClick={e => e.stopPropagation()}>
            <div className="ca-help-title">atalhos de teclado</div>
            <div className="ca-help-grid">
              {[
                [["g","o"], "Overview"],
                [["g","t"], "Tool catalog"],
                [["g","s"], "Security"],
                [["g","a"], "Audit log"],
                [["g","r"], "Runbook"],
                [["g","p"], "Playground"],
                [["g","b"], "PR Readiness"],
                [["g","e"], ".env wizard"],
                [["g","v"], "Vercel Deploy"],
              ].map(([keys, label]) => (
                <div key={label} className="ca-help-row">
                  <div className="ca-help-keys">
                    {keys.map((k, i) => (
                      <React.Fragment key={i}>
                        <span className="ca-kbd">{k}</span>
                        {i < keys.length - 1 && <span style={{ color: "var(--text-muted)", fontSize: 10 }}>+</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  <span className="ca-help-desc">{label}</span>
                </div>
              ))}
              <div className="ca-help-sep" />
              <div className="ca-help-row">
                <div className="ca-help-keys"><span className="ca-kbd">/</span></div>
                <span className="ca-help-desc">grep tools</span>
              </div>
              <div className="ca-help-row">
                <div className="ca-help-keys"><span className="ca-kbd">esc</span></div>
                <span className="ca-help-desc">fechar drawer/modal</span>
              </div>
            </div>
            <div className="ca-help-footer">pressione <span className="ca-kbd">?</span> ou clique fora para fechar</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Sparkline({ values, tone }) {
  const max = Math.max(...values, 1);
  const w = 96, h = 28, n = values.length;
  const pts = values.map((v, i) => {
    const x = (i / (n - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(" ");
  const fill = pts + ` ${w},${h} 0,${h}`;
  const color = { ok: "var(--ok)", warn: "var(--warn)", danger: "var(--danger)" }[tone] || "var(--ok)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polygon points={fill} fill={color} opacity="0.15" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function OverviewA({ state, forceError, sparkData = {} }) {
  const flags = state.server_info;

  const auditStats = React.useMemo(() => {
    const events = window.AUDIT_EVENTS;
    const blocked = events.filter(e => e.level !== "info").length;
    const actors = new Set(events.map(e => e.actor)).size;
    const toolCounts = {};
    events.forEach(e => { toolCounts[e.tool] = (toolCounts[e.tool] || 0) + 1; });
    const topTool = Object.entries(toolCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    const lastWarn = events.find(e => e.level !== "info");
    return { blocked, actors, topTool, lastWarnTs: lastWarn?.ts?.slice(11, 19) || "—" };
  }, []);

  const flagRows = [
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
    safe: { label: "Postura: SAFE", desc: "Read-only ativo. Nenhuma escrita possível.", tone: "ok" },
    balanced: { label: "Postura: BALANCED", desc: "Escrita habilitada com fluxo PR-first. Tools perigosas desativadas.", tone: "info" },
    elevated: { label: "Postura: ELEVATED", desc: "Modo operador ativo. pr_merge, git_update_ref e similares disponíveis sob confirm.", tone: "warn" },
  }[state.posture];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="ca-overview-strip">
        {[
          { n: auditStats.blocked, l: "bloqueadas",    tone: auditStats.blocked > 0 ? "warn" : "ok" },
          { n: window.AUDIT_EVENTS.length, l: "eventos audit", tone: "ok" },
          { n: auditStats.actors,  l: "atores únicos", tone: "ok" },
          { n: auditStats.topTool, l: "top tool",      mono: true },
          { n: auditStats.lastWarnTs, l: "último aviso", mono: true, tone: auditStats.blocked > 0 ? "warn" : "ok" },
        ].map((s, i) => (
          <div key={i} className="ca-ostat">
            <div className={`ca-ostat-n${s.mono ? " mono" : ""}`} style={s.tone === "warn" ? { color: "var(--warn)" } : {}}>
              {s.n}
            </div>
            <div className="ca-ostat-l mono">{s.l}</div>
          </div>
        ))}
      </div>
    <div className="ca-grid-overview">
      <div className="ca-card">
        <div className="ca-card-h">
          <span className="ca-card-h-num mono">01</span>
          <span className="ca-card-h-title">Postura de segurança</span>
        </div>
        <div className={`ca-posture ca-posture-${postureCopy.tone}`}>
          <div className="ca-posture-bar" />
          <div>
            <div className="ca-posture-label">{postureCopy.label}</div>
            <div className="ca-posture-desc">{postureCopy.desc}</div>
          </div>
        </div>
        <table className="ca-flags">
          <tbody>
            {flagRows.map(([k, v, tone]) => (
              <tr key={k}>
                <td className="mono ca-flag-k">{k}</td>
                <td><StatusDot tone={tone} /></td>
                <td className="mono ca-flag-v">{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ca-card">
        <div className="ca-card-h">
          <span className="ca-card-h-num mono">02</span>
          <span className="ca-card-h-title">Rate limits — janela atual</span>
        </div>
        <div className="ca-rates">
          {window.RATE_LIMITS.map(r => {
            const used = forceError && r.endpoint === "/oauth/token" ? r.max : r.used;
            const pct = Math.min(100, (used / r.max) * 100);
            const tone = pct > 85 ? "danger" : pct > 60 ? "warn" : "ok";
            const hist = sparkData[r.endpoint] || [];
            return (
              <div className="ca-rate" key={r.endpoint}>
                <div className="ca-rate-row">
                  <span className="mono ca-rate-name">{r.endpoint}</span>
                  <span className="mono ca-rate-num">{used}/{r.max}</span>
                </div>
                {hist.length > 1 && <Sparkline values={hist} tone={tone} />}
                <div className="ca-rate-bar" style={{ marginTop: 4 }}>
                  <div className={`ca-rate-fill ca-rate-fill-${tone}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="ca-rate-meta mono">janela {r.window}s</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ca-card">
        <div className="ca-card-h">
          <span className="ca-card-h-num mono">03</span>
          <span className="ca-card-h-title">Allowlists & env</span>
        </div>
        <div className="ca-env-block">
          <div className="ca-env-label mono">GITHUB_ALLOWED_REPOS</div>
          <ul className="ca-env-list">
            {window.ENV_CONFIG.GITHUB_ALLOWED_REPOS.map(r => (
              <li key={r} className="mono">{r}</li>
            ))}
          </ul>
        </div>
        <div className="ca-env-block">
          <div className="ca-env-label mono">GITHUB_PROTECTED_BRANCHES</div>
          <div className="ca-chips">
            {window.ENV_CONFIG.GITHUB_PROTECTED_BRANCHES.map(b => (
              <span key={b} className="ca-chip mono">{b}</span>
            ))}
          </div>
        </div>
        <div className="ca-env-block">
          <div className="ca-env-label mono">FASTMCP_ALLOWED_ORIGINS</div>
          <ul className="ca-env-list">
            {window.ENV_CONFIG.FASTMCP_ALLOWED_ORIGINS.map(r => (
              <li key={r} className="mono">{r}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="ca-card ca-card-wide">
        <div className="ca-card-h">
          <span className="ca-card-h-num mono">04</span>
          <span className="ca-card-h-title">Audit recente</span>
          <span className="ca-card-h-meta mono">últimas entradas</span>
        </div>
        <table className="ca-audit">
          <thead>
            <tr>
              <th>ts</th><th>actor</th><th>tool</th><th>target</th><th>decision</th><th>reason</th>
            </tr>
          </thead>
          <tbody>
            {window.AUDIT_EVENTS.slice(0, 6).map((e, i) => (
              <tr key={i}>
                <td className="mono ca-audit-ts">{e.ts}</td>
                <td className="mono">{e.actor}</td>
                <td className="mono ca-audit-tool">{e.tool}</td>
                <td className="mono ca-audit-target">{e.target}</td>
                <td>
                  <span className={`ca-decision ca-decision-${e.level}`}>
                    <StatusDot tone={e.level === "info" ? "ok" : e.level === "warn" ? "warn" : "danger"} />
                    {e.decision}
                  </span>
                </td>
                <td className="mono ca-audit-reason">{e.reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

function ToolsA({ tools, totals, riskFilter, setRiskFilter, phaseFilter, setPhaseFilter, query, setQuery, rowPad, cellFs, mode, onOpen, searchRef, drift }) {
  const phases = window.TOOL_CATALOG.map(p => p.phase);
  const state = window.SERVER_STATES[mode];

  const willRun = (t) => {
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
          <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="filtrar por nome ou descrição… (/)" />
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
          <span className="ca-drift-label">
            schema drift{drift.demo ? " · demo" : " · live"}
          </span>
          <span className="ca-drift-body">
            {drift.newTools.length} tool{drift.newTools.length > 1 ? "s" : ""} no servidor não catalogada{drift.newTools.length > 1 ? "s" : ""}:
            {drift.newTools.map(n => (
              <span key={n} className="ca-drift-tool mono">{n}</span>
            ))}
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
        <table className="ca-tools-table" style={{ "--row-pad": rowPad, "--cell-fs": cellFs + "px" }}>
          <thead>
            <tr>
              <th style={{ width: 200 }}>tool</th>
              <th>summary</th>
              <th style={{ width: 80 }}>risk</th>
              <th style={{ width: 200 }}>phase</th>
              <th style={{ width: 180 }}>under {state.label.toLowerCase()}</th>
            </tr>
          </thead>
          <tbody>
            {tools.map(t => {
              const r = RISK_TONE[t.risk];
              const w = willRun(t);
              return (
                <tr key={t.name} onClick={() => onOpen(t)} className="ca-tools-row">
                  <td className="mono ca-tools-name">{t.name}{t.planned && <span className="ca-tools-planned">planned</span>}</td>
                  <td className="ca-tools-summary">{t.summary}</td>
                  <td>
                    <span className="ca-risk" style={{ background: r.bg, color: r.fg, borderColor: r.border }}>{r.label}</span>
                  </td>
                  <td className="mono ca-tools-phase">{t.phase}</td>
                  <td>
                    <span className={`ca-decision ca-decision-${w.tone === "ok" ? "info" : w.tone === "warn" ? "warn" : w.tone === "danger" ? "error" : "muted"}`}>
                      <StatusDot tone={w.tone} />
                      {w.text}
                    </span>
                    {w.reason && <span className="mono ca-tools-reason"> · {w.reason}</span>}
                  </td>
                </tr>
              );
            })}
            {tools.length === 0 && (
              <tr><td colSpan={5} className="ca-tools-empty mono">$ grep returned 0 — ajuste os filtros</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SecurityA({ state }) {
  const layers = [
    { name: "Allowlist de repositórios", status: state.server_info.require_allowed_repos ? "ok" : "danger", note: state.server_info.require_allowed_repos ? `${window.ENV_CONFIG.GITHUB_ALLOWED_REPOS.length} repos permitidos` : "GITHUB_REQUIRE_ALLOWED_REPOS=false" },
    { name: "Read-only global", status: state.server_info.read_only ? "ok" : "info", note: state.server_info.read_only ? "Mutações recusadas no nível do guard" : "Escrita habilitada — fluxo PR-first" },
    { name: "Branches protegidas", status: state.server_info.protected_branches_configured ? "ok" : "warn", note: window.ENV_CONFIG.GITHUB_PROTECTED_BRANCHES.join(", ") },
    { name: "Tools perigosas", status: state.server_info.dangerous_tools_enabled ? "warn" : "ok", note: state.server_info.dangerous_tools_enabled ? "pr_merge, git_*, pr_dismiss_review disponíveis" : "Bloqueadas no guard" },
    { name: "Confirmação destrutiva", status: "ok", note: 'confirm="CONFIRM_DESTRUCTIVE_OPERATION" obrigatório por chamada' },
    { name: "Workflow dispatch", status: state.server_info.workflow_dispatch_enabled ? "warn" : "ok", note: state.server_info.workflow_dispatch_enabled ? "actions_run_workflow disponível" : "actions_run_workflow bloqueado" },
    { name: "OAuth redirect allowlist", status: state.server_info.oauth_redirect_allowlist_configured ? "ok" : "warn", note: "MCP_OAUTH_ALLOWED_REDIRECT_URIS configurado" },
    { name: "Rate limit OAuth", status: state.server_info.oauth_rate_limit_enabled ? "ok" : "warn", note: `${window.ENV_CONFIG.MCP_OAUTH_RATE_LIMIT_MAX_REQUESTS} req / ${window.ENV_CONFIG.MCP_OAUTH_RATE_LIMIT_WINDOW_SECONDS}s por IP` },
    { name: "Token redaction", status: "ok", note: "Tokens, secrets e PATs nunca retornam em outputs" },
    { name: "Injection detect", status: "ok", note: "Padrões em respostas GET. request_text/audit em #62/#63" },
  ];

  return (
    <div className="ca-sec">
      <div className="ca-sec-head">
        <div className="ca-sec-head-l">
          <div className="ca-sec-title">Camadas de segurança</div>
          <div className="ca-sec-sub">10 camadas independentes. Falha em qualquer uma bloqueia a operação.</div>
        </div>
        <div className="ca-sec-head-r mono">postura · {state.posture}</div>
      </div>
      <div className="ca-sec-grid">
        {layers.map((l, i) => (
          <div key={l.name} className="ca-sec-cell">
            <div className="ca-sec-cell-h">
              <span className="mono ca-sec-cell-num">{String(i + 1).padStart(2, "0")}</span>
              <StatusDot tone={l.status} />
              <span className="ca-sec-cell-name">{l.name}</span>
            </div>
            <div className="ca-sec-cell-note">{l.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditA({ rowPad, cellFs }) {
  const [levelFilter, setLevelFilter] = React.useState("all");
  const [toolQuery, setToolQuery] = React.useState("");

  const filtered = window.AUDIT_EVENTS.filter(e => {
    if (levelFilter !== "all" && e.level !== levelFilter) return false;
    if (toolQuery && !e.tool.toLowerCase().includes(toolQuery.toLowerCase()) &&
        !e.actor.toLowerCase().includes(toolQuery.toLowerCase())) return false;
    return true;
  });

  const levelCounts = React.useMemo(() => ({
    info: window.AUDIT_EVENTS.filter(e => e.level === "info").length,
    warn: window.AUDIT_EVENTS.filter(e => e.level === "warn").length,
    error: window.AUDIT_EVENTS.filter(e => e.level === "error").length,
  }), []);

  return (
    <div className="ca-audit-page">
      <div className="ca-audit-head">
        <div className="ca-audit-title">
          Audit log
          <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400, marginLeft: 10 }}>
            {filtered.length}/{window.AUDIT_EVENTS.length} eventos
          </span>
        </div>
        <div className="ca-audit-sub mono">stream local · stateless_http=true · sem persistência server-side</div>
      </div>

      <div className="ca-audit-filter">
        <div className="ca-tools-pills">
          <span className="ca-tools-pills-label mono">level</span>
          {[
            ["all", "all"],
            ["info", `info · ${levelCounts.info}`],
            ["warn", `warn · ${levelCounts.warn}`],
            ["error", `error · ${levelCounts.error}`],
          ].map(([k, label]) => (
            <button key={k} className={`ca-tools-pill ${levelFilter === k ? "is-active" : ""}`} onClick={() => setLevelFilter(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="ca-tools-search" style={{ flex: "0 1 260px" }}>
          <span className="mono ca-tools-search-prompt">grep</span>
          <input value={toolQuery} onChange={e => setToolQuery(e.target.value)} placeholder="filtrar por tool ou actor…" />
        </div>
        {(levelFilter !== "all" || toolQuery) && (
          <button className="ca-tools-pill" onClick={() => { setLevelFilter("all"); setToolQuery(""); }}>
            × limpar
          </button>
        )}
      </div>

      <table className="ca-audit ca-audit-full" style={{ "--row-pad": rowPad, "--cell-fs": cellFs + "px" }}>
        <thead>
          <tr>
            <th>ts</th><th>actor</th><th>tool / endpoint</th><th>target</th><th>decision</th><th>reason</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((e, i) => (
            <tr key={i}>
              <td className="mono ca-audit-ts">{e.ts}</td>
              <td className="mono">{e.actor}</td>
              <td className="mono ca-audit-tool">{e.tool}</td>
              <td className="mono ca-audit-target">{e.target}</td>
              <td>
                <span className={`ca-decision ca-decision-${e.level}`}>
                  <StatusDot tone={e.level === "info" ? "ok" : e.level === "warn" ? "warn" : "danger"} />
                  {e.decision}
                </span>
              </td>
              <td className="mono ca-audit-reason">{e.reason || "—"}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="ca-tools-empty mono">$ grep returned 0 — nenhum evento para este filtro</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RunbookA({ state }) {
  const [activeBook, setActiveBook] = React.useState("merge");
  const [checked, setChecked] = React.useState({});
  const toggle = (n) => setChecked(p => ({ ...p, [n]: !p[n] }));

  const RUNBOOKS = {
    rollback: {
      title: "Runbook · rollback de ref",
      sub: "Reset de emergência. git_update_ref aponta a branch de volta para um commit seguro.",
      statusBlocked: !state.server_info.dangerous_tools_enabled,
      blockedMsg: "git_update_ref bloqueado — ative modo operador",
      okMsg: "git_update_ref disponível sob confirm",
      steps: [
        { n: "01", title: "Identificar commit seguro", cmd: "compare_commits owner repo base head", note: "Confirme o sha do último commit bom antes do problema" },
        { n: "02", title: "Verificar branch alvo", cmd: "repo_get / repo_tree ref=main", note: "Confirme que não é branch protegida — bloqueia automaticamente" },
        { n: "03", title: "Checar head_sha atual", cmd: "pr_get ou repo_tree @main", note: "Registre o sha atual para auditoria antes de avançar" },
        { n: "04", title: "Avaliar CI do commit alvo", cmd: "actions_list_runs + actions_get_run", note: "Confirme que o commit de destino tinha CI verde" },
        { n: "05", title: "Executar git_update_ref", cmd: 'git_update_ref ref=refs/heads/branch sha=<safe_sha> confirm="CONFIRM_DESTRUCTIVE_OPERATION"', note: "Irreversível sem novo commit — cheque duas vezes o sha" },
        { n: "06", title: "Validar rollback", cmd: "repo_tree ref=branch + actions_list_runs", note: "Confirme que o HEAD aponta para o commit seguro" },
        { n: "07", title: "Registrar incidente", cmd: "issue_create title='rollback: <motivo>'", note: "Documente causa, sha anterior, sha revertido e timestamp" },
      ],
    },
    merge: {
      title: "Runbook · pr_merge",
      sub: "Sequência obrigatória antes de operações destrutivas. Marque cada etapa ao concluir.",
      statusBlocked: !state.server_info.dangerous_tools_enabled,
      blockedMsg: "pr_merge bloqueado pela postura atual",
      okMsg: "pr_merge disponível sob confirm",
      steps: [
        { n: "01", title: "Verificar PR aberto", cmd: "pr_get owner repo number", note: "Confirma estado open e mergeable_state" },
        { n: "02", title: "Revisar diff", cmd: "pr_get_diff · pr_list_changed_files", note: "Output bounded; nunca retorna tokens" },
        { n: "03", title: "Avaliar risco", cmd: "pr_risk_review", note: "Retorna risk_level + checklist operacional" },
        { n: "04", title: "Confirmar CI", cmd: "ci_gate_check (planejado, #65)", note: "Ainda em desenvolvimento — verificar manualmente" },
        { n: "05", title: "Capturar head_sha", cmd: "sha=<head_sha>", note: "Garantia de merge sobre o commit revisado" },
        { n: "06", title: "Executar pr_merge", cmd: 'confirm="CONFIRM_DESTRUCTIVE_OPERATION"', note: "Falha sem dangerous_tools_enabled=true" },
      ],
    },
    branch_pr: {
      title: "Runbook · branch → arquivo → PR",
      sub: "Fluxo completo de entrega segura. Preferir sempre sobre git low-level.",
      statusBlocked: state.server_info.read_only,
      blockedMsg: "escrita bloqueada em modo read_only",
      okMsg: "fluxo disponível na postura atual",
      steps: [
        { n: "01", title: "Criar branch de feature", cmd: "branch_create owner repo branch ref", note: "Nunca use main/master como destino — protegidas" },
        { n: "02", title: "Criar ou editar arquivo", cmd: "file_create_or_update / file_apply_patch", note: "file_apply_patch para edições pontuais — não exige conteúdo completo" },
        { n: "03", title: "Abrir pull request", cmd: "pr_create owner repo head base title body", note: "head=feat/branch, base=main" },
        { n: "04", title: "Solicitar revisão", cmd: "pr_request_reviewers pull_number reviewers", note: "Opcional — importante em repos colaborativos" },
        { n: "05", title: "Checar status de CI", cmd: "actions_list_runs / actions_get_run", note: "Aguardar CI verde antes de merge" },
        { n: "06", title: "Revisar PR antes do merge", cmd: "pr_risk_review pull_number", note: "low → ok · medium → checar diff · high → revisão manual" },
        { n: "07", title: "Merge via GitHub (preferido)", cmd: "— merge manual na interface GitHub —", note: "Mais seguro; evita ENABLE_DANGEROUS_TOOLS=true" },
        { n: "08", title: "Ou: pr_merge via MCP (operador)", cmd: 'pr_merge sha=<head_sha> confirm="CONFIRM_DESTRUCTIVE_OPERATION"', note: "Exige dangerous_tools_enabled=true" },
      ],
    },
  };

  const book = RUNBOOKS[activeBook];
  // Reset checklist when switching runbook
  const lastBook = React.useRef(activeBook);
  if (lastBook.current !== activeBook) { setChecked({}); lastBook.current = activeBook; }

  const doneCount = Object.values(checked).filter(Boolean).length;
  const allDone = doneCount === book.steps.length;

  return (
    <div className="ca-runbook">
      <div className="ca-runbook-bookpicker">
        {Object.entries(RUNBOOKS).map(([k, rb]) => (
          <button key={k} className={`ca-runbook-pick ${activeBook === k ? "is-active" : ""}`} onClick={() => setActiveBook(k)}>
            {rb.title.replace("Runbook · ", "")}
          </button>
        ))}
      </div>

      <div className="ca-runbook-head">
        <div>
          <div className="ca-runbook-title">{book.title}</div>
          <div className="ca-runbook-sub">{book.sub}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div className={`ca-runbook-status ${book.statusBlocked ? "is-blocked" : "is-ok"}`}>
            <StatusDot tone={book.statusBlocked ? "danger" : "warn"} />
            {book.statusBlocked ? book.blockedMsg : book.okMsg}
          </div>
          <div className="mono" style={{ fontSize: 11, color: allDone ? "var(--ok)" : "var(--text-muted)" }}>
            {doneCount}/{book.steps.length} etapas{allDone ? " · concluído" : ""}
          </div>
        </div>
      </div>

      <div className="ca-runbook-progress">
        <div className="ca-runbook-progress-fill" style={{ width: `${(doneCount / book.steps.length) * 100}%` }} />
      </div>

      <ol className="ca-runbook-list">
        {book.steps.map(s => {
          const done = !!checked[s.n];
          return (
            <li key={s.n} className={`ca-runbook-step ${done ? "is-done" : ""}`} onClick={() => toggle(s.n)}>
              <div className="ca-runbook-check">
                <span className="ca-runbook-check-box">{done ? "✓" : ""}</span>
              </div>
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

window.ConsoleA = ConsoleA;
window.StatusDot = StatusDot;
