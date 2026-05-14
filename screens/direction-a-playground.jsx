// Direction A — Tool Playground (Phase 3)
// Read-only tools only. Executes MCP JSON-RPC calls against serverUrl.
// Demo mode: returns plausible mock responses when no server is configured.

const DEMO_RESPONSES = {
  server_info: {
    service: "github-unified-mcp", version: "0.1.0",
    tool_schema_version: "2026-05-02.1", uptime_seconds: 184223,
    read_only: true, dangerous_tools_enabled: false,
    workflow_dispatch_enabled: false, require_allowed_repos: true,
    protected_branches_configured: true, oauth_rate_limit_enabled: true,
  },
  github_get_me: {
    login: "vinicius-ssantos", name: "Vinicius Santos",
    public_repos: 42, followers: 12, following: 8,
    html_url: "https://github.com/vinicius-ssantos",
  },
  stack_detect: {
    stacks: ["Java", "Spring Boot", "Maven"],
    manifest_files: ["pom.xml", "src/main/resources/application.yml"],
    entrypoints: ["src/main/java/com/example/Application.java"],
  },
  repo_context_atlas: {
    repo: "vinicius-ssantos/github-unified-mcp",
    stacks: ["Python", "FastMCP"],
    risk_summary: "low",
    open_prs: 3, open_issues: 7,
    protected_branches: ["main", "develop"],
  },
};

function generateDemoResponse(toolName, args) {
  if (DEMO_RESPONSES[toolName]) return DEMO_RESPONSES[toolName];
  const owner = args.owner || "vinicius-ssantos";
  const repo = args.repo || "github-unified-mcp";
  const dynamic = {
    repo_get: { full_name: `${owner}/${repo}`, default_branch: "main", stargazers_count: 7, open_issues_count: 3, visibility: "private" },
    repo_tree: { entries: [{ path: "README.md", type: "blob", sha: "7ff00f7" }, { path: "src/", type: "tree" }, { path: "tests/", type: "tree" }] },
    file_get: { path: args.path || "README.md", size: 8828, content: "# github-unified-mcp\n\nOperator console...", encoding: "utf-8" },
    issue_get: { number: args.issue_number || 142, title: "feat: add ci_gate_check", state: "open", labels: ["enhancement"], comments: 3 },
    issue_list: [
      { number: 65, title: "feat: ci_gate_check tool", state: "open", labels: ["planned"] },
      { number: 62, title: "feat: injection_detect", state: "closed", labels: ["security"] },
    ],
    pr_get: { number: args.pull_number || 138, title: "fix: allowlist enforcement", state: "open", draft: false, mergeable: true, mergeable_state: "clean" },
    pr_list: [
      { number: 142, title: "feat/policy-43: add allowlist", state: "open", draft: false },
      { number: 138, title: "fix: protected branch guard", state: "open", draft: false },
    ],
    actions_list_runs: { workflow_runs: [
      { id: 9001, name: "CI", status: "completed", conclusion: "success", head_branch: "main" },
      { id: 9000, name: "CI", status: "completed", conclusion: "failure", head_branch: "feat/policy-43" },
    ]},
    actions_get_run: { id: args.run_id || 9001, status: "completed", conclusion: "success", run_attempt: 1, html_url: `https://github.com/${owner}/${repo}/actions/runs/9001` },
    actions_get_jobs: { jobs: [{ id: 1, name: "build", status: "completed", conclusion: "success", steps: 7 }] },
    actions_get_job_logs: { log: "[2026-05-14 14:22:01] ✓ Setup Java\n[2026-05-14 14:22:12] ✓ Build\n[2026-05-14 14:22:45] ✓ Tests" },
    compare_commits: { ahead_by: 3, behind_by: 0, status: "ahead", files: [{ filename: "src/guard.py", additions: 12, deletions: 4 }] },
    pr_get_diff: { diff: `diff --git a/src/guard.py b/src/guard.py\n--- a/src/guard.py\n+++ b/src/guard.py\n@@ -1,4 +1,8 @@\n+# allowlist check\n+if not allowed(repo):` },
    pr_list_changed_files: { files: [{ filename: "src/guard.py", status: "modified", additions: 12, deletions: 4 }, { filename: "tests/test_guard.py", status: "added", additions: 28 }] },
    pr_risk_review: { risk_level: "medium", summary: "Modifica guard de segurança — revisar cuidadosamente", requires_confirmation: false, checklist: ["Revisar lógica de allowlist", "Confirmar testes passando", "Verificar proteção de branches"] },
    project_get: { id: "PVT_xxx", title: "github-unified-mcp roadmap", number: 1, items_count: 24 },
    project_list_fields: { fields: [{ name: "Status", type: "single_select", options: ["Todo", "In Progress", "Done"] }, { name: "Priority", type: "single_select" }] },
    project_list_items: { items: [{ title: "ci_gate_check tool", status: "In Progress" }, { title: "schema drift detection", status: "Todo" }] },
    project_list_views: { views: [{ name: "Board", layout: "board_layout" }, { name: "Roadmap", layout: "roadmap_layout" }] },
    write_preflight_check: { decision: "allowed", risk: "low", reason: "read-only operation — no guard checks required" },
    injection_detect: { detected: false, patterns_checked: 12, safe: true, note: "No prompt injection patterns found in response" },
  };
  return dynamic[toolName] || { demo: true, tool: toolName, args: { ...args }, note: "configure serverUrl nos Tweaks para dados reais" };
}

function PlaygroundA({ serverUrl, mode, initialTool, bearerToken = "" }) {
  const { useState, useMemo, useEffect } = React;

  const safeTools = useMemo(() =>
    window.TOOL_CATALOG
      .flatMap(p => p.tools.map(t => ({ ...t, phase: p.phase })))
      .filter(t => t.risk === "low" && !t.planned),
    []
  );

  const phaseGroups = useMemo(() => {
    const map = {};
    safeTools.forEach(t => { if (!map[t.phase]) map[t.phase] = []; map[t.phase].push(t); });
    return Object.entries(map);
  }, [safeTools]);

  const [selectedTool, setSelectedTool] = useState(safeTools[0]?.name || "");
  const [formArgs, setFormArgs] = useState({});
  const [loading, setLoading] = useState(false);
  const [resultDisplay, setResultDisplay] = useState(null);
  const [callError, setCallError] = useState(null);
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(false);

  // Jump to tool when coming from the drawer
  useEffect(() => {
    if (initialTool && safeTools.some(t => t.name === initialTool)) {
      setSelectedTool(initialTool);
      setFormArgs({});
      setResultDisplay(null);
      setCallError(null);
    }
  }, [initialTool]);

  const schema = useMemo(() => window.getSchema(selectedTool), [selectedTool]);
  const selectedToolObj = useMemo(() => safeTools.find(t => t.name === selectedTool), [selectedTool, safeTools]);
  const isDemo = !serverUrl;

  const handleSelectTool = (name) => {
    setSelectedTool(name);
    setFormArgs({});
    setResultDisplay(null);
    setCallError(null);
  };

  const handleExecute = async () => {
    if (loading) return;
    setLoading(true);
    setResultDisplay(null);
    setCallError(null);
    const ts = new Date().toISOString().slice(11, 19);

    if (isDemo) {
      await new Promise(r => setTimeout(r, 320));
      const mock = generateDemoResponse(selectedTool, formArgs);
      const text = JSON.stringify(mock, null, 2);
      setResultDisplay(text);
      setHistory(h => [{ ts, tool: selectedTool, ok: true, demo: true }, ...h].slice(0, 20));
      setLoading(false);
      return;
    }

    try {
      const args = {};
      schema.inputs.forEach(inp => {
        if (formArgs[inp.name] !== undefined && formArgs[inp.name] !== "") {
          args[inp.name] = formArgs[inp.name];
        }
      });
      const authHeaders = bearerToken ? { "Authorization": `Bearer ${bearerToken}` } : {};
      const resp = await fetch(`${serverUrl}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: selectedTool, arguments: args } }),
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      const data = await resp.json();
      if (data.error) throw new Error(`MCP error ${data.error.code}: ${data.error.message}`);
      const raw = data?.result?.content?.[0]?.text || JSON.stringify(data.result, null, 2);
      let parsed;
      try { parsed = JSON.stringify(JSON.parse(raw), null, 2); } catch { parsed = raw; }
      setResultDisplay(parsed);
      setHistory(h => [{ ts, tool: selectedTool, ok: true, demo: false }, ...h].slice(0, 20));
    } catch (e) {
      setCallError(e.message || "Network error");
      setHistory(h => [{ ts, tool: selectedTool, ok: false, error: e.message }, ...h].slice(0, 20));
    }
    setLoading(false);
  };

  const updateArg = (name, value) => setFormArgs(a => ({ ...a, [name]: value }));

  const handleCopy = () => {
    if (!resultDisplay) return;
    navigator.clipboard?.writeText(resultDisplay);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="ca-pg">
      <div className="ca-pg-topbar">
        <div className="ca-pg-topbar-l">
          <span className="mono ca-pg-title">playground</span>
          <span className="ca-pg-sub">fase 3 · ferramentas read-only · {safeTools.length} tools disponíveis</span>
        </div>
        {isDemo && (
          <div className="ca-pg-demo-badge mono">DEMO · configure serverUrl nos Tweaks para chamadas reais</div>
        )}
        {!isDemo && (
          <div className="ca-pg-live-badge mono">LIVE · {serverUrl}</div>
        )}
      </div>

      <div className="ca-pg-layout">

        {/* LEFT — Tool picker */}
        <div className="ca-pg-sidebar">
          {phaseGroups.map(([phase, tools]) => (
            <div key={phase} className="ca-pg-group">
              <div className="ca-pg-group-label mono">{phase}</div>
              {tools.map(t => (
                <button
                  key={t.name}
                  className={`ca-pg-tool-btn ${selectedTool === t.name ? "is-active" : ""}`}
                  onClick={() => handleSelectTool(t.name)}
                >
                  <span className="mono ca-pg-btn-name">{t.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* CENTER — Form + result */}
        <div className="ca-pg-center">
          <div className="ca-pg-form-header">
            <div>
              <div className="mono ca-pg-tool-name">{selectedTool}</div>
              {selectedToolObj && <div className="ca-pg-tool-summary">{selectedToolObj.summary}</div>}
            </div>
            <button
              className={`ca-pg-run ${loading ? "is-loading" : ""}`}
              onClick={handleExecute}
              disabled={loading}
            >
              {loading
                ? <span className="ca-pg-spin">◌</span>
                : isDemo ? "▶ run demo" : "▶ run"}
            </button>
          </div>

          <div className="ca-pg-inputs-section">
            {schema.inputs.length === 0 ? (
              <div className="ca-pg-no-params mono">— sem parâmetros — {isDemo ? "clique run demo" : "pronto para executar"}</div>
            ) : (
              <div className="ca-pg-fields">
                {schema.inputs.map(inp => (
                  <div key={inp.name} className="ca-pg-field">
                    <div className="ca-pg-field-meta">
                      <span className="mono ca-pg-field-name">{inp.name}</span>
                      {inp.required && <span className="ca-pg-req">*</span>}
                      <span className="mono ca-pg-field-type">{inp.type}</span>
                    </div>
                    {(inp.note || inp.default) && <div className="ca-pg-field-hint">{inp.note || inp.default}</div>}
                    <input
                      className="wiz-input mono"
                      value={formArgs[inp.name] || ""}
                      onChange={e => updateArg(inp.name, e.target.value)}
                      placeholder={inp.default || inp.note || (isDemo ? "demo — pode deixar vazio" : "")}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {callError && (
            <div className="ca-pg-error">
              <span className="mono ca-pg-error-k">error</span>
              <span className="mono ca-pg-error-msg">{callError}</span>
            </div>
          )}

          {resultDisplay && (
            <div className="ca-pg-result">
              <div className="ca-pg-result-header">
                <span className="mono ca-pg-result-k">{isDemo ? "response · demo" : "response · live"}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="mono ca-pg-returns-hint">{schema.returns}</span>
                  <button className="ca-copy" onClick={handleCopy}>{copied ? "✓" : "copy"}</button>
                </div>
              </div>
              <pre className="ca-codeblock mono ca-pg-codeblock">{resultDisplay}</pre>
            </div>
          )}
        </div>

        {/* RIGHT — Session history */}
        <div className="ca-pg-history">
          <div className="ca-pg-hist-header mono">session</div>
          {history.length === 0 ? (
            <div className="ca-pg-hist-empty mono">nenhuma chamada</div>
          ) : (
            history.map((h, i) => (
              <div
                key={i}
                className={`ca-pg-hist-row ${!h.ok ? "is-err" : ""}`}
                onClick={() => { setSelectedTool(h.tool); setResultDisplay(null); setCallError(h.ok ? null : h.error); }}
                title="clique para selecionar tool"
              >
                <span className="mono ca-pg-hist-ts">{h.ts}</span>
                <span className="mono ca-pg-hist-name">{h.tool}</span>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {h.demo && <span className="mono ca-pg-hist-demo">D</span>}
                  <span className={`ca-pg-hist-dot ${h.ok ? "is-ok" : "is-err"}`} />
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}

window.PlaygroundA = PlaygroundA;
