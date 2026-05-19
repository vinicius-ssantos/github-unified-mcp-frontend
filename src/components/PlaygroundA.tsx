import { useState, useMemo, useEffect } from 'react';
import { TOOL_CATALOG } from '../data/tools';
import { getSchema } from '../data/schemas';
import { callBffTool } from '../adapters/bffClient';
import type { BffToolPolicy } from '../types/mcp';

type Props = { serverUrl: string; mode?: string; initialTool?: string | null; bearerToken?: string; bffRole?: string; bffPolicyByTool?: Record<string, BffToolPolicy> };

type HistoryEntry = { ts: string; tool: string; risk: string; ok: boolean; demo?: boolean; error?: string; ms?: number };

// ── Demo responses ────────────────────────────────────────────────────────────

const DEMO_RESPONSES: Record<string, unknown> = {
  server_info: { service: "github-unified-mcp", version: "0.1.0", tool_schema_version: "2026-05-02.1", uptime_seconds: 184223, read_only: true, dangerous_tools_enabled: false, workflow_dispatch_enabled: false, require_allowed_repos: true, protected_branches_configured: true, oauth_rate_limit_enabled: true },
  github_get_me: { login: "vinicius-ssantos", name: "Vinicius Santos", public_repos: 42, followers: 12, following: 8, html_url: "https://github.com/vinicius-ssantos" },
  stack_detect: { stacks: ["Java", "Spring Boot", "Maven"], manifest_files: ["pom.xml", "src/main/resources/application.yml"], entrypoints: ["src/main/java/com/example/Application.java"] },
  repo_context_atlas: { repo: "vinicius-ssantos/github-unified-mcp", stacks: ["Python", "FastMCP"], risk_summary: "low", open_prs: 3, open_issues: 7, protected_branches: ["main", "develop"] },
};

function generateDemoResponse(toolName: string, args: Record<string, unknown>): unknown {
  if (DEMO_RESPONSES[toolName]) return DEMO_RESPONSES[toolName];
  const owner = (args.owner as string) || "vinicius-ssantos";
  const repo  = (args.repo as string) || "github-unified-mcp";
  const dynamic: Record<string, unknown> = {
    repo_get:             { full_name: `${owner}/${repo}`, default_branch: "main", stargazers_count: 7, open_issues_count: 3, visibility: "private" },
    repo_tree:            { entries: [{ path: "README.md", type: "blob", sha: "7ff00f7" }, { path: "src/", type: "tree" }, { path: "tests/", type: "tree" }] },
    file_get:             { path: args.path || "README.md", size: 8828, content: "# github-unified-mcp\n\nOperator console...", encoding: "utf-8" },
    pr_get:               { number: args.pull_number || 138, title: "fix: allowlist enforcement", state: "open", draft: false, mergeable: true, mergeable_state: "clean" },
    pr_list:              [{ number: 142, title: "feat/policy-43: add allowlist", state: "open", draft: false }, { number: 138, title: "fix: protected branch guard", state: "open", draft: false }],
    actions_list_runs:    { workflow_runs: [{ id: 9001, name: "CI", status: "completed", conclusion: "success", head_branch: "main" }, { id: 9000, name: "CI", status: "completed", conclusion: "failure", head_branch: "feat/policy-43" }] },
    pr_risk_review:       { risk_level: "medium", summary: "Modifica guard de segurança — revisar cuidadosamente", requires_confirmation: false, checklist: ["Revisar lógica de allowlist", "Confirmar testes passando", "Verificar proteção de branches"] },
    pr_list_changed_files:{ files: [{ filename: "src/guard.py", status: "modified", additions: 12, deletions: 4 }, { filename: "tests/test_guard.py", status: "added", additions: 28 }] },
    injection_detect:     { detected: false, patterns_checked: 12, safe: true, note: "No prompt injection patterns found in response" },
    branch_create:        { ok: true, status: "created", ref: "refs/heads/feat/example", sha: "7ff00f7a", verified: true },
    file_create_or_update:{ ok: true, path: args.path || "example.md", sha: "abc1234", committed: true },
    issue_create:         { number: 99, title: args.title || "nova issue", state: "open", html_url: `https://github.com/${owner}/${repo}/issues/99` },
    pr_create:            { number: 143, title: args.title || "feat: exemplo", state: "open", draft: false, html_url: `https://github.com/${owner}/${repo}/pull/143` },
    write_preflight_check:{ allowed: false, reason: "read_only_mode", tool: args.tool || "file_create_or_update", risk: "medium" },
  };
  return dynamic[toolName] ?? { demo: true, tool: toolName, args, note: "configure serverUrl nas Settings para chamadas reais" };
}

// ── Risk helpers ──────────────────────────────────────────────────────────────

const RISK_STYLE = {
  low:    { badge: "low",  bg: "rgba(120,200,160,.13)", color: "var(--ok,#4caf50)",     border: "rgba(120,200,160,.28)" },
  medium: { badge: "med",  bg: "rgba(220,180,100,.13)", color: "var(--warn,#f0b429)",   border: "rgba(220,180,100,.28)" },
  high:   { badge: "high", bg: "rgba(230,110,100,.13)", color: "var(--danger,#ef5350)", border: "rgba(230,110,100,.28)" },
} as const;

function RiskBadge({ risk }: { risk: 'low' | 'medium' | 'high' }) {
  const s = RISK_STYLE[risk];
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 4, padding: '1px 5px', fontSize: 10, fontFamily: 'ui-monospace, monospace', letterSpacing: '.04em', flexShrink: 0 }}>
      {s.badge}
    </span>
  );
}

// ── JSON syntax highlight (safe — HTML-escapes before coloring) ───────────────

function syntaxHighlight(json: string): string {
  const e = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return e.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    match => {
      if (/^"/.test(match))
        return /:$/.test(match)
          ? `<span style="color:#60a0f0">${match}</span>`
          : `<span style="color:#7ec8a0">${match}</span>`;
      if (/true|false/.test(match)) return `<span style="color:#ef5350">${match}</span>`;
      if (/null/.test(match))       return `<span style="color:#aaa">${match}</span>`;
      return `<span style="color:#f0b429">${match}</span>`;
    }
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlaygroundA({ serverUrl, initialTool, mode = 'read_only', bearerToken = "", bffRole, bffPolicyByTool = {} }: Props) {

  const allTools = useMemo(() =>
    TOOL_CATALOG.flatMap(p => p.tools.map(t => ({ ...t, phase: p.phase }))).filter(t => !t.planned),
    []
  );
  const phaseGroups = useMemo(() => {
    const map: Record<string, typeof allTools> = {};
    allTools.forEach(t => { if (!map[t.phase]) map[t.phase] = []; map[t.phase].push(t); });
    return Object.entries(map);
  }, [allTools]);

  const [selectedTool, setSelectedTool] = useState(allTools[0]?.name ?? "");
  const [formArgs, setFormArgs] = useState<Record<string, string>>(() => {
    try {
      const s = localStorage.getItem(`pg-args-${allTools[0]?.name}`);
      return s ? JSON.parse(s) : {};
    } catch { return {}; }
  });
  const [loading, setLoading]             = useState(false);
  const [resultDisplay, setResultDisplay] = useState<string | null>(null);
  const [callError, setCallError]         = useState<string | null>(null);
  const [history, setHistory]             = useState<HistoryEntry[]>(() => {
    try { const s = localStorage.getItem('pg-history'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [copied, setCopied]               = useState(false);
  const [confirmed, setConfirmed]         = useState(false);
  const [latencyMs, setLatencyMs]         = useState<number | null>(null);
  const [resultTab, setResultTab]         = useState<'result' | 'curl' | 'jsonrpc'>('result');

  // Navigate from ToolDrawer
  useEffect(() => {
    if (initialTool && allTools.some(t => t.name === initialTool)) {
      setSelectedTool(initialTool);
      try {
        const saved = localStorage.getItem(`pg-args-${initialTool}`);
        setFormArgs(saved ? JSON.parse(saved) : {});
      } catch { setFormArgs({}); }
      setResultDisplay(null);
      setCallError(null);
      setConfirmed(false);
      setResultTab('result');
      setLatencyMs(null);
    }
  }, [initialTool, allTools]);

  // Reset confirmation when tool changes
  useEffect(() => { setConfirmed(false); }, [selectedTool]);

  const schema      = useMemo(() => getSchema(selectedTool), [selectedTool]);
  const isDemo      = !serverUrl;
  const activeTool  = allTools.find(t => t.name === selectedTool);
  const risk        = activeTool?.risk ?? 'low';

  const canExecute = (() => {
    if (!activeTool) return false;
    if (isDemo) return true;
    if (risk === 'low') return true;
    if (risk === 'medium') return mode !== 'read_only';
    if (risk === 'high') return mode === 'operator' && confirmed;
    return false;
  })();

  const blockedReason = (() => {
    if (isDemo) return null;
    if (risk === 'medium' && mode === 'read_only') return 'Esta tool faz mutações. Mude a postura para write_safe ou operator nas Settings.';
    if (risk === 'high' && mode !== 'operator') return 'Esta tool é destrutiva e exige modo operator + ENABLE_DANGEROUS_TOOLS=true no servidor.';
    if (risk === 'high' && !confirmed) return null;
    return null;
  })();

  const handleSelectTool = (name: string) => {
    setSelectedTool(name);
    try {
      const saved = localStorage.getItem(`pg-args-${name}`);
      setFormArgs(saved ? JSON.parse(saved) : {});
    } catch { setFormArgs({}); }
    setResultDisplay(null);
    setCallError(null);
    setResultTab('result');
    setLatencyMs(null);
  };

  const handleExecute = async () => {
    if (loading || (!canExecute && !isDemo)) return;
    setLoading(true);
    setResultDisplay(null);
    setCallError(null);
    setLatencyMs(null);
    const ts = new Date().toISOString().slice(11, 19);
    const t0 = Date.now();

    if (isDemo) {
      await new Promise(r => setTimeout(r, 320));
      const mock = generateDemoResponse(selectedTool, formArgs);
      const ms = Date.now() - t0;
      setResultDisplay(JSON.stringify(mock, null, 2));
      setLatencyMs(ms);
      setHistory(h => {
        const next = [{ ts, tool: selectedTool, risk, ok: true, demo: true, ms }, ...h].slice(0, 20);
        try { localStorage.setItem('pg-history', JSON.stringify(next)); } catch { /**/ }
        return next;
      });
      setLoading(false);
      return;
    }

    try {
      const args: Record<string, unknown> = {};
      schema.inputs.forEach(inp => {
        if (formArgs[inp.name] !== undefined && formArgs[inp.name] !== "")
          args[inp.name] = formArgs[inp.name];
      });
      if (activeTool?.requiresConfirm) args['confirm'] = 'CONFIRM_DESTRUCTIVE_OPERATION';
      const data = await callBffTool<unknown>(serverUrl, selectedTool, args, { bearerToken, timeoutMs: 10000 });
      const parsed = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      const ms = Date.now() - t0;
      setResultDisplay(parsed);
      setLatencyMs(ms);
      setHistory(h => {
        const next = [{ ts, tool: selectedTool, risk, ok: true, demo: false, ms }, ...h].slice(0, 20);
        try { localStorage.setItem('pg-history', JSON.stringify(next)); } catch { /**/ }
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      const ms = Date.now() - t0;
      setCallError(msg);
      setLatencyMs(ms);
      setHistory(h => {
        const next = [{ ts, tool: selectedTool, risk, ok: false, error: msg, ms }, ...h].slice(0, 20);
        try { localStorage.setItem('pg-history', JSON.stringify(next)); } catch { /**/ }
        return next;
      });
    }
    setLoading(false);
  };

  const updateArg = (name: string, value: string) => {
    setFormArgs(a => {
      const next = { ...a, [name]: value };
      try { localStorage.setItem(`pg-args-${selectedTool}`, JSON.stringify(next)); } catch { /**/ }
      return next;
    });
  };

  const handleCopy = () => {
    if (!resultDisplay) return;
    navigator.clipboard?.writeText(resultDisplay);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Snippet generators
  const argsForSnippet = useMemo(() => {
    const a: Record<string, unknown> = {};
    schema.inputs.forEach(inp => { if (formArgs[inp.name]) a[inp.name] = formArgs[inp.name]; });
    return a;
  }, [schema.inputs, formArgs]);

  const jsonRpcSnippet = useMemo(() =>
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: selectedTool, arguments: argsForSnippet } }, null, 2),
    [selectedTool, argsForSnippet]
  );

  const curlSnippet = useMemo(() => {
    const url = serverUrl || 'https://your-mcp-server/mcp';
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: selectedTool, arguments: argsForSnippet } });
    return `curl -X POST ${url} \\\n  -H 'Content-Type: application/json' \\\n  -H 'Authorization: Bearer <token>' \\\n  -d '${body}'`;
  }, [selectedTool, argsForSnippet, serverUrl]);

  const lowCount  = allTools.filter(t => t.risk === 'low').length;
  const medCount  = allTools.filter(t => t.risk === 'medium').length;
  const highCount = allTools.filter(t => t.risk === 'high').length;

  return (
    <div className="ca-pg">
      <div className="ca-pg-topbar">
        <div className="ca-pg-topbar-l">
          <span className="mono ca-pg-title">playground</span>
          <span className="ca-pg-sub">
            {allTools.length} tools · <span style={{ color: 'var(--ok)' }}>{lowCount} low</span> · <span style={{ color: 'var(--warn)' }}>{medCount} med</span> · <span style={{ color: 'var(--danger)' }}>{highCount} high</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isDemo && <div className="ca-pg-demo-badge mono">DEMO · configure serverUrl nas Settings para chamadas reais</div>}
          {!isDemo && <div className="ca-pg-live-badge mono">LIVE · {serverUrl}</div>}
          {bffRole && (
            <div style={{ background: RISK_STYLE[bffRole === 'admin' || bffRole === 'operator' ? 'high' : 'low'].bg, border: `1px solid ${RISK_STYLE[bffRole === 'admin' || bffRole === 'operator' ? 'high' : 'low'].border}`, borderRadius: 5, padding: '3px 8px', fontFamily: 'ui-monospace, monospace', fontSize: 10, color: RISK_STYLE[bffRole === 'admin' || bffRole === 'operator' ? 'high' : 'low'].color }}>
              BFF · {bffRole}
            </div>
          )}
          <div style={{ background: RISK_STYLE[mode === 'operator' ? 'high' : mode === 'write_safe' ? 'medium' : 'low'].bg, border: `1px solid ${RISK_STYLE[mode === 'operator' ? 'high' : mode === 'write_safe' ? 'medium' : 'low'].border}`, borderRadius: 5, padding: '3px 8px', fontFamily: 'ui-monospace, monospace', fontSize: 10, color: RISK_STYLE[mode === 'operator' ? 'high' : mode === 'write_safe' ? 'medium' : 'low'].color }}>
            {mode}
          </div>
        </div>
      </div>

      <div className="ca-pg-layout">
        {/* Sidebar */}
        <aside className="ca-pg-sidebar">
          {phaseGroups.map(([phase, tools]) => (
            <div key={phase} className="ca-pg-group">
              <div className="ca-pg-group-label mono">{phase}</div>
              {tools.map(t => (
                <button
                  key={t.name}
                  className={`ca-pg-tool ${selectedTool === t.name ? "is-active" : ""}`}
                  onClick={() => handleSelectTool(t.name)}
                  style={t.risk !== 'low' ? { opacity: mode === 'read_only' && t.risk === 'medium' ? 0.55 : 1 } : {}}
                >
                  <span className="mono ca-pg-tool-name" style={{ flex: 1, textAlign: 'left' }}>{t.name}</span>
                  {t.risk !== 'low' && <RiskBadge risk={t.risk} />}
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Main panel */}
        <div className="ca-pg-main">

          {/* Risk warning banner */}
          {risk === 'medium' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', marginBottom: 12, background: 'rgba(220,180,100,.1)', border: '1px solid rgba(220,180,100,.28)', borderRadius: 8, fontSize: 12, color: 'var(--warn,#f0b429)', fontFamily: 'ui-monospace, monospace' }}>
              <span style={{ flexShrink: 0 }}>⚠</span>
              <span>Tool de escrita — faz mutações no repositório. Verifique os parâmetros antes de executar.{mode === 'read_only' ? ' Mude a postura para write_safe ou operator nas Settings para habilitar.' : ''}</span>
            </div>
          )}
          {risk === 'high' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 14px', marginBottom: 12, background: 'rgba(230,110,100,.1)', border: '1px solid rgba(230,110,100,.28)', borderRadius: 8, fontSize: 12, color: 'var(--danger,#ef5350)', fontFamily: 'ui-monospace, monospace' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ flexShrink: 0 }}>✗</span>
                <span>Tool destrutiva — exige <code style={{ background: 'rgba(255,255,255,.08)', padding: '1px 4px', borderRadius: 3 }}>dangerous_tools_enabled=true</code> no servidor e modo operator.{activeTool?.requiresConfirm ? ' confirm="CONFIRM_DESTRUCTIVE_OPERATION" injetado automaticamente.' : ''}</span>
              </div>
              {mode === 'operator' && !isDemo && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text,#ccc)', paddingLeft: 20 }}>
                  <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                  Confirmo que revisei os parâmetros e entendo o impacto desta operação
                </label>
              )}
            </div>
          )}
          {blockedReason && (
            <div style={{ padding: '8px 12px', marginBottom: 10, background: 'rgba(230,110,100,.08)', border: '1px solid rgba(230,110,100,.22)', borderRadius: 7, fontSize: 11, color: 'var(--danger,#ef5350)', fontFamily: 'ui-monospace, monospace' }}>
              {blockedReason}
            </div>
          )}

          <div className="ca-pg-form">
            <div className="ca-pg-form-h mono" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {selectedTool}
              <RiskBadge risk={risk} />
            </div>
            {schema.inputs.length === 0
              ? <div className="ca-pg-no-inputs mono">— sem parâmetros —</div>
              : schema.inputs.map(inp => (
                <div key={inp.name} className="ca-pg-field">
                  <label className="ca-pg-label mono">{inp.name}{inp.required && <span className="ca-pg-req">*</span>}</label>
                  <input
                    className="ca-pg-input mono"
                    value={formArgs[inp.name] ?? ""}
                    onChange={e => updateArg(inp.name, e.target.value)}
                    placeholder={inp.default ?? inp.type}
                    disabled={!canExecute && !isDemo}
                  />
                  {inp.note && <div className="ca-pg-note mono">{inp.note}</div>}
                </div>
              ))
            }
            <button
              className="ca-pg-run"
              onClick={handleExecute}
              disabled={loading || (!canExecute && !isDemo)}
              style={(!canExecute && !isDemo) ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              {loading ? "executando…" : "▶ executar"}
            </button>
          </div>

          <div className="ca-pg-result">
            {/* Result tabs */}
            <div className="ca-pg-result-h">
              <div style={{ display: 'flex', gap: 4 }}>
                {(['result', 'curl', 'jsonrpc'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setResultTab(t)}
                    style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, padding: '2px 8px', border: '1px solid', borderRadius: 4, cursor: 'pointer', background: resultTab === t ? 'rgba(255,255,255,.1)' : 'transparent', borderColor: resultTab === t ? 'var(--border-strong,#555)' : 'var(--border,#333)', color: resultTab === t ? 'var(--text,#ccc)' : 'var(--text-dim,#888)' }}
                  >
                    {t === 'result' ? 'resultado' : t}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {latencyMs !== null && (
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: latencyMs < 500 ? 'var(--ok,#7ec8a0)' : latencyMs < 2000 ? 'var(--warn,#f0b429)' : 'var(--danger,#ef5350)', background: 'rgba(255,255,255,.05)', border: '1px solid var(--border,#333)', borderRadius: 3, padding: '1px 5px' }}>
                    {latencyMs}ms
                  </span>
                )}
                {resultDisplay && resultTab === 'result' && (
                  <button className="ca-copy" onClick={handleCopy}>{copied ? "✓" : "copy"}</button>
                )}
              </div>
            </div>

            {/* Tab content */}
            {resultTab === 'result' && (
              <>
                {callError && <div className="ca-pg-error mono">{callError}</div>}
                {resultDisplay && (
                  <pre
                    className="ca-pg-pre mono"
                    dangerouslySetInnerHTML={{ __html: syntaxHighlight(resultDisplay) }}
                  />
                )}
                {!resultDisplay && !callError && <div className="ca-pg-empty mono">execute uma tool para ver o resultado</div>}
              </>
            )}
            {resultTab === 'curl' && (
              <pre className="ca-pg-pre mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{curlSnippet}</pre>
            )}
            {resultTab === 'jsonrpc' && (
              <pre
                className="ca-pg-pre mono"
                dangerouslySetInnerHTML={{ __html: syntaxHighlight(jsonRpcSnippet) }}
              />
            )}
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="ca-pg-history">
            <div className="ca-pg-history-h mono" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>histórico</span>
              <button onClick={() => { setHistory([]); localStorage.removeItem('pg-history'); }} style={{ fontFamily: 'monospace', fontSize: 10, background: 'transparent', border: 'none', color: 'var(--text-muted,#666)', cursor: 'pointer' }}>× limpar</button>
            </div>
            {history.map((h, i) => (
              <div key={i} className={`ca-pg-hist-row ${h.ok ? "is-ok" : "is-err"}`}>
                <span className="mono ca-pg-hist-ts">{h.ts}</span>
                <span className="mono ca-pg-hist-tool" style={{ flex: 1 }}>{h.tool}</span>
                {h.ms !== undefined && (
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: h.ms < 500 ? 'var(--ok,#7ec8a0)' : 'var(--warn,#f0b429)', opacity: 0.7 }}>{h.ms}ms</span>
                )}
                {h.risk !== 'low' && <RiskBadge risk={h.risk as 'low' | 'medium' | 'high'} />}
                {h.demo && <span className="mono ca-pg-hist-demo">demo</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
