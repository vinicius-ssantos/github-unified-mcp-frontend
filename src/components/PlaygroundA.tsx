import { useState, useMemo, useEffect } from 'react';
import { TOOL_CATALOG } from '../data/tools';
import { getSchema } from '../data/schemas';

type Props = { serverUrl: string; mode?: string; initialTool?: string | null; bearerToken?: string };

const DEMO_RESPONSES: Record<string, unknown> = {
  server_info: { service: "github-unified-mcp", version: "0.1.0", tool_schema_version: "2026-05-02.1", uptime_seconds: 184223, read_only: true, dangerous_tools_enabled: false, workflow_dispatch_enabled: false, require_allowed_repos: true, protected_branches_configured: true, oauth_rate_limit_enabled: true },
  github_get_me: { login: "vinicius-ssantos", name: "Vinicius Santos", public_repos: 42, followers: 12, following: 8, html_url: "https://github.com/vinicius-ssantos" },
  stack_detect: { stacks: ["Java", "Spring Boot", "Maven"], manifest_files: ["pom.xml", "src/main/resources/application.yml"], entrypoints: ["src/main/java/com/example/Application.java"] },
  repo_context_atlas: { repo: "vinicius-ssantos/github-unified-mcp", stacks: ["Python", "FastMCP"], risk_summary: "low", open_prs: 3, open_issues: 7, protected_branches: ["main", "develop"] },
};

function generateDemoResponse(toolName: string, args: Record<string, unknown>): unknown {
  if (DEMO_RESPONSES[toolName]) return DEMO_RESPONSES[toolName];
  const owner = (args.owner as string) || "vinicius-ssantos";
  const repo = (args.repo as string) || "github-unified-mcp";
  const dynamic: Record<string, unknown> = {
    repo_get: { full_name: `${owner}/${repo}`, default_branch: "main", stargazers_count: 7, open_issues_count: 3, visibility: "private" },
    repo_tree: { entries: [{ path: "README.md", type: "blob", sha: "7ff00f7" }, { path: "src/", type: "tree" }, { path: "tests/", type: "tree" }] },
    file_get: { path: args.path || "README.md", size: 8828, content: "# github-unified-mcp\n\nOperator console...", encoding: "utf-8" },
    pr_get: { number: args.pull_number || 138, title: "fix: allowlist enforcement", state: "open", draft: false, mergeable: true, mergeable_state: "clean" },
    pr_list: [{ number: 142, title: "feat/policy-43: add allowlist", state: "open", draft: false }, { number: 138, title: "fix: protected branch guard", state: "open", draft: false }],
    actions_list_runs: { workflow_runs: [{ id: 9001, name: "CI", status: "completed", conclusion: "success", head_branch: "main" }, { id: 9000, name: "CI", status: "completed", conclusion: "failure", head_branch: "feat/policy-43" }] },
    pr_risk_review: { risk_level: "medium", summary: "Modifica guard de segurança — revisar cuidadosamente", requires_confirmation: false, checklist: ["Revisar lógica de allowlist", "Confirmar testes passando", "Verificar proteção de branches"] },
    pr_list_changed_files: { files: [{ filename: "src/guard.py", status: "modified", additions: 12, deletions: 4 }, { filename: "tests/test_guard.py", status: "added", additions: 28 }] },
    injection_detect: { detected: false, patterns_checked: 12, safe: true, note: "No prompt injection patterns found in response" },
  };
  return dynamic[toolName] ?? { demo: true, tool: toolName, args, note: "configure serverUrl nos Tweaks para dados reais" };
}

export default function PlaygroundA({ serverUrl, initialTool, bearerToken = "" }: Props) {
  const safeTools = useMemo(() =>
    TOOL_CATALOG.flatMap(p => p.tools.map(t => ({ ...t, phase: p.phase }))).filter(t => t.risk === "low" && !t.planned),
    []
  );
  const phaseGroups = useMemo(() => {
    const map: Record<string, typeof safeTools> = {};
    safeTools.forEach(t => { if (!map[t.phase]) map[t.phase] = []; map[t.phase].push(t); });
    return Object.entries(map);
  }, [safeTools]);

  const [selectedTool, setSelectedTool] = useState(safeTools[0]?.name ?? "");
  const [formArgs, setFormArgs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [resultDisplay, setResultDisplay] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ ts: string; tool: string; ok: boolean; demo?: boolean; error?: string }[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialTool && safeTools.some(t => t.name === initialTool)) {
      setSelectedTool(initialTool);
      setFormArgs({});
      setResultDisplay(null);
      setCallError(null);
    }
  }, [initialTool, safeTools]);

  const schema = useMemo(() => getSchema(selectedTool), [selectedTool]);
  const isDemo = !serverUrl;

  const handleSelectTool = (name: string) => {
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
      setResultDisplay(JSON.stringify(mock, null, 2));
      setHistory(h => [{ ts, tool: selectedTool, ok: true, demo: true }, ...h].slice(0, 20));
      setLoading(false);
      return;
    }

    try {
      const args: Record<string, unknown> = {};
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
      const raw = data?.result?.content?.[0]?.text ?? JSON.stringify(data.result, null, 2);
      let parsed: string;
      try { parsed = JSON.stringify(JSON.parse(raw), null, 2); } catch { parsed = raw; }
      setResultDisplay(parsed);
      setHistory(h => [{ ts, tool: selectedTool, ok: true, demo: false }, ...h].slice(0, 20));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setCallError(msg);
      setHistory(h => [{ ts, tool: selectedTool, ok: false, error: msg }, ...h].slice(0, 20));
    }
    setLoading(false);
  };

  const updateArg = (name: string, value: string) => setFormArgs(a => ({ ...a, [name]: value }));

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
        {isDemo && <div className="ca-pg-demo-badge mono">DEMO · configure serverUrl nos Tweaks para chamadas reais</div>}
        {!isDemo && <div className="ca-pg-live-badge mono">LIVE · {serverUrl}</div>}
      </div>

      <div className="ca-pg-layout">
        <aside className="ca-pg-sidebar">
          {phaseGroups.map(([phase, tools]) => (
            <div key={phase} className="ca-pg-group">
              <div className="ca-pg-group-label mono">{phase}</div>
              {tools.map(t => (
                <button key={t.name} className={`ca-pg-tool ${selectedTool === t.name ? "is-active" : ""}`} onClick={() => handleSelectTool(t.name)}>
                  <span className="mono ca-pg-tool-name">{t.name}</span>
                </button>
              ))}
            </div>
          ))}
        </aside>

        <div className="ca-pg-main">
          <div className="ca-pg-form">
            <div className="ca-pg-form-h mono">{selectedTool}</div>
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
                  />
                  {inp.note && <div className="ca-pg-note mono">{inp.note}</div>}
                </div>
              ))
            }
            <button className="ca-pg-run" onClick={handleExecute} disabled={loading}>
              {loading ? "executando…" : "▶ executar"}
            </button>
          </div>

          <div className="ca-pg-result">
            <div className="ca-pg-result-h">
              <span className="mono">resultado</span>
              {resultDisplay && <button className="ca-copy" onClick={handleCopy}>{copied ? "✓" : "copy"}</button>}
            </div>
            {callError && <div className="ca-pg-error mono">{callError}</div>}
            {resultDisplay && <pre className="ca-pg-pre mono">{resultDisplay}</pre>}
            {!resultDisplay && !callError && <div className="ca-pg-empty mono">execute uma tool para ver o resultado</div>}
          </div>
        </div>

        {history.length > 0 && (
          <div className="ca-pg-history">
            <div className="ca-pg-history-h mono">histórico</div>
            {history.map((h, i) => (
              <div key={i} className={`ca-pg-hist-row ${h.ok ? "is-ok" : "is-err"}`}>
                <span className="mono ca-pg-hist-ts">{h.ts}</span>
                <span className="mono ca-pg-hist-tool">{h.tool}</span>
                {h.demo && <span className="mono ca-pg-hist-demo">demo</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
