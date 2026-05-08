// Direction B — Painel calmo
// Same data, more breathing room, larger typography, editorial hierarchy.

const { useState: useStateB, useMemo: useMemoB } = React;

const formatUptimeB = (s) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return `${d} dias · ${h}h`;
};

function PanelB({ mode = "read_only" }) {
  const state = window.SERVER_STATES[mode];
  const [tab, setTab] = useStateB("overview");
  const [phaseFilter, setPhaseFilter] = useStateB("all");

  const phases = window.TOOL_CATALOG;
  const filteredPhases = useMemoB(() => {
    if (phaseFilter === "all") return phases;
    return phases.filter(p => p.phase === phaseFilter);
  }, [phaseFilter]);

  return (
    <div className="cb-root">
      <header className="cb-top">
        <div className="cb-top-l">
          <div className="cb-eyebrow mono">github-unified-mcp · operador</div>
          <h1 className="cb-h1">Painel</h1>
        </div>
        <div className="cb-top-r">
          <div className="cb-status">
            <span className="cb-status-dot" data-tone={state.healthz.ok ? "ok" : "danger"} />
            <div>
              <div className="cb-status-label">Servidor saudável</div>
              <div className="cb-status-meta mono">{state.healthz.commit_sha} · {state.healthz.tool_schema_version}</div>
            </div>
          </div>
          <div className={`cb-mode cb-mode-${state.posture}`}>
            <div className="cb-mode-label">Modo atual</div>
            <div className="cb-mode-value">{state.label}</div>
          </div>
        </div>
      </header>

      <nav className="cb-nav">
        {[
          ["overview", "Visão geral"],
          ["security", "Segurança"],
          ["tools", "Ferramentas"],
          ["audit", "Auditoria"],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`cb-nav-btn ${tab === k ? "is-active" : ""}`}>
            {l}
          </button>
        ))}
      </nav>

      {tab === "overview" && <OverviewB state={state} />}
      {tab === "security" && <SecurityB state={state} />}
      {tab === "tools" && <ToolsB phases={filteredPhases} phaseFilter={phaseFilter} setPhaseFilter={setPhaseFilter} state={state} />}
      {tab === "audit" && <AuditB />}
    </div>
  );
}

function OverviewB({ state }) {
  const flags = state.server_info;
  const summaryStats = [
    { k: "Tools no catálogo", v: window.TOOL_CATALOG.reduce((a, p) => a + p.tools.length, 0), sub: "6 fases" },
    { k: "Repos permitidos", v: window.ENV_CONFIG.GITHUB_ALLOWED_REPOS.length, sub: "via allowlist" },
    { k: "Branches protegidas", v: window.ENV_CONFIG.GITHUB_PROTECTED_BRANCHES.length, sub: "glob suportado" },
    { k: "Uptime", v: formatUptimeB(state.healthz.uptime_seconds), sub: "desde último deploy" },
  ];

  return (
    <section className="cb-overview">
      <div className="cb-stats">
        {summaryStats.map(s => (
          <div key={s.k} className="cb-stat">
            <div className="cb-stat-k">{s.k}</div>
            <div className="cb-stat-v">{s.v}</div>
            <div className="cb-stat-sub mono">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="cb-two-col">
        <div className="cb-block">
          <div className="cb-block-h">
            <h2 className="cb-block-title">Postura de segurança</h2>
            <div className="cb-block-sub">Estado das oito flags principais expostas por <span className="mono">server_info</span>.</div>
          </div>
          <div className="cb-flags">
            {[
              ["Read-only global", flags.read_only, flags.read_only ? "ok" : "info"],
              ["Tools perigosas", flags.dangerous_tools_enabled, flags.dangerous_tools_enabled ? "warn" : "ok"],
              ["Workflow dispatch", flags.workflow_dispatch_enabled, flags.workflow_dispatch_enabled ? "warn" : "ok"],
              ["Allowlist exigida", flags.require_allowed_repos, "ok"],
              ["Branches protegidas", flags.protected_branches_configured, "ok"],
              ["OAuth redirect allowlist", flags.oauth_redirect_allowlist_configured, "ok"],
              ["Rate limit OAuth", flags.oauth_rate_limit_enabled, "ok"],
              ["Catalog refresh", flags.tool_catalog_refresh_supported, "ok"],
            ].map(([name, val, tone]) => (
              <div key={name} className="cb-flag">
                <div className="cb-flag-name">{name}</div>
                <div className={`cb-flag-pill cb-flag-pill-${tone}`}>{String(val)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="cb-block">
          <div className="cb-block-h">
            <h2 className="cb-block-title">Atividade recente</h2>
            <div className="cb-block-sub">Últimas decisões registradas pelo guard de escrita.</div>
          </div>
          <ul className="cb-feed">
            {window.AUDIT_EVENTS.slice(0, 7).map((e, i) => (
              <li key={i} className="cb-feed-item">
                <div className="cb-feed-ts mono">{e.ts.slice(11)}</div>
                <div className="cb-feed-body">
                  <div className="cb-feed-line">
                    <span className="mono cb-feed-tool">{e.tool}</span>
                    <span className="cb-feed-arrow">→</span>
                    <span className="mono cb-feed-target">{e.target}</span>
                  </div>
                  <div className="cb-feed-meta">
                    <span className={`cb-feed-decision cb-feed-decision-${e.level}`}>{e.decision}</span>
                    {e.reason && <span className="mono cb-feed-reason">{e.reason}</span>}
                    <span className="cb-feed-actor mono">{e.actor}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="cb-block">
        <div className="cb-block-h">
          <h2 className="cb-block-title">Rate limits</h2>
          <div className="cb-block-sub">Janela atual por endpoint OAuth e quota da GitHub API.</div>
        </div>
        <div className="cb-rates">
          {window.RATE_LIMITS.map(r => {
            const pct = Math.min(100, (r.used / r.max) * 100);
            const tone = pct > 85 ? "danger" : pct > 60 ? "warn" : "ok";
            return (
              <div className="cb-rate" key={r.endpoint}>
                <div className="cb-rate-h">
                  <span className="mono cb-rate-name">{r.endpoint}</span>
                  <span className="mono cb-rate-num">{r.used}<span className="cb-rate-of"> / {r.max}</span></span>
                </div>
                <div className="cb-rate-bar">
                  <div className={`cb-rate-fill cb-rate-fill-${tone}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SecurityB({ state }) {
  const layers = [
    { n: "01", name: "Allowlist de repositórios", note: `${window.ENV_CONFIG.GITHUB_ALLOWED_REPOS.length} repos permitidos`, on: state.server_info.require_allowed_repos },
    { n: "02", name: "Read-only global", note: state.server_info.read_only ? "Mutações recusadas no guard" : "Escrita habilitada — fluxo PR-first", on: state.server_info.read_only },
    { n: "03", name: "Branches protegidas", note: window.ENV_CONFIG.GITHUB_PROTECTED_BRANCHES.join(" · "), on: state.server_info.protected_branches_configured },
    { n: "04", name: "Tools perigosas", note: "pr_merge, git_create_*, pr_dismiss_review", on: !state.server_info.dangerous_tools_enabled },
    { n: "05", name: "Confirmação destrutiva", note: 'confirm="CONFIRM_DESTRUCTIVE_OPERATION" obrigatório', on: true },
    { n: "06", name: "Workflow dispatch", note: "actions_run_workflow off por padrão", on: !state.server_info.workflow_dispatch_enabled },
    { n: "07", name: "OAuth redirect allowlist", note: "Bloqueia URIs fora da allowlist", on: state.server_info.oauth_redirect_allowlist_configured },
    { n: "08", name: "Rate limit OAuth", note: `${window.ENV_CONFIG.MCP_OAUTH_RATE_LIMIT_MAX_REQUESTS} req / ${window.ENV_CONFIG.MCP_OAUTH_RATE_LIMIT_WINDOW_SECONDS}s por IP`, on: state.server_info.oauth_rate_limit_enabled },
    { n: "09", name: "Token redaction", note: "Tokens, secrets e PATs nunca retornam", on: true },
    { n: "10", name: "Injection detect", note: "Padrões em respostas GET", on: true },
  ];

  return (
    <section className="cb-sec">
      <div className="cb-sec-head">
        <h2 className="cb-block-title">Modelo de segurança em camadas</h2>
        <div className="cb-block-sub">Dez guards independentes. Falha em qualquer um bloqueia a operação.</div>
      </div>
      <div className="cb-sec-list">
        {layers.map(l => (
          <div key={l.n} className="cb-sec-row">
            <div className="cb-sec-row-num mono">{l.n}</div>
            <div className="cb-sec-row-name">{l.name}</div>
            <div className="cb-sec-row-note">{l.note}</div>
            <div className={`cb-sec-row-state ${l.on ? "is-on" : "is-off"}`}>{l.on ? "ATIVO" : "INATIVO"}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ToolsB({ phases, phaseFilter, setPhaseFilter, state }) {
  const allPhases = window.TOOL_CATALOG.map(p => p.phase);

  return (
    <section className="cb-tools">
      <div className="cb-tools-filter">
        <button className={`cb-tools-filter-btn ${phaseFilter === "all" ? "is-active" : ""}`} onClick={() => setPhaseFilter("all")}>
          Todas as fases
        </button>
        {allPhases.map(p => (
          <button key={p} className={`cb-tools-filter-btn ${phaseFilter === p ? "is-active" : ""}`} onClick={() => setPhaseFilter(p)}>
            {p}
          </button>
        ))}
      </div>
      {phases.map(p => (
        <div key={p.phase} className="cb-phase">
          <div className="cb-phase-h">
            <h3 className="cb-phase-title">{p.phase}</h3>
            <div className="cb-phase-desc">{p.description}</div>
          </div>
          <div className="cb-phase-grid">
            {p.tools.map(t => {
              const blocked =
                (t.requiresDangerous && !state.server_info.dangerous_tools_enabled) ||
                (t.requiresWorkflowDispatch && !state.server_info.workflow_dispatch_enabled);
              const ro = state.server_info.read_only && t.risk !== "low";
              return (
                <div key={t.name} className={`cb-tool cb-tool-${t.risk} ${blocked ? "is-blocked" : ""} ${ro ? "is-readonly" : ""}`}>
                  <div className="cb-tool-h">
                    <div className="mono cb-tool-name">{t.name}</div>
                    <div className={`cb-tool-risk cb-tool-risk-${t.risk}`}>{t.risk}</div>
                  </div>
                  <div className="cb-tool-summary">{t.summary}</div>
                  <div className="cb-tool-foot mono">
                    {blocked ? "blocked · postura" : ro ? "read-only" : t.requiresConfirm ? "exige confirm" : t.planned ? "planejado" : "allowed"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function AuditB() {
  return (
    <section className="cb-audit">
      <div className="cb-block-h">
        <h2 className="cb-block-title">Auditoria</h2>
        <div className="cb-block-sub">Stream de decisões do guard de escrita. Sem persistência server-side em modo stateless.</div>
      </div>
      <div className="cb-audit-list">
        {window.AUDIT_EVENTS.map((e, i) => (
          <div key={i} className={`cb-audit-row cb-audit-row-${e.level}`}>
            <div className="mono cb-audit-ts">{e.ts}</div>
            <div className="mono cb-audit-tool">{e.tool}</div>
            <div className="mono cb-audit-target">{e.target}</div>
            <div className={`cb-audit-decision cb-audit-decision-${e.level}`}>{e.decision}</div>
            <div className="mono cb-audit-reason">{e.reason || "—"}</div>
            <div className="mono cb-audit-actor">{e.actor}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

window.PanelB = PanelB;
