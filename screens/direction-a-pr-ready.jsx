// Direction A — PR Readiness Cockpit (Phase 5)
// Agrega pr_risk_review + pr_get + pr_list_changed_files + actions_list_runs
// numa visão única de operador. Demo mode com dados mock realistas.

const PR_DEMO = {
  pr: {
    number: 138,
    title: "fix: allowlist enforcement — add repo guard",
    state: "open", draft: false,
    mergeable: true, mergeable_state: "clean",
    head_sha: "a1b2c3d4e5f6",
    base: "main", head_branch: "feat/policy-43",
    additions: 40, deletions: 8, changed_files: 3,
  },
  risk: {
    risk_level: "medium",
    summary: "Modifica guard de segurança central. Revisar lógica de allowlist com atenção.",
    checklist: [
      "Verificar cobertura de testes para novos casos de allowlist",
      "Confirmar que CI está verde no branch feat/policy-43",
      "Revisar impacto em repos fora da allowlist configurada",
    ],
  },
  files: [
    { filename: "src/guard.py", status: "modified", additions: 12, deletions: 4 },
    { filename: "src/allowlist.py", status: "modified", additions: 18, deletions: 4 },
    { filename: "tests/test_guard.py", status: "added", additions: 28, deletions: 0 },
  ],
  runs: [
    { name: "CI", status: "completed", conclusion: "success", head_branch: "main" },
    { name: "CI", status: "completed", conclusion: "failure", head_branch: "feat/policy-43" },
    { name: "Lint", status: "completed", conclusion: "success", head_branch: "feat/policy-43" },
  ],
};

function deriveRecommendation({ pr, risk, runs }) {
  const branch = pr.head_branch || "";
  const ciOnBranch = runs.find(r => r.head_branch === branch);

  if (risk.risk_level === "high") {
    return { tone: "danger", icon: "✗", label: "BLOQUEADO", msg: "Risco alto — revisão manual obrigatória antes do merge" };
  }
  if (!pr.mergeable || pr.mergeable_state === "dirty") {
    return { tone: "danger", icon: "✗", label: "CONFLITO", msg: "Branch com conflito — resolver antes de prosseguir" };
  }
  if (ciOnBranch?.conclusion === "failure") {
    return { tone: "warn", icon: "⚠", label: "CI FALHOU", msg: `Último run em ${branch} terminou com falha — verificar logs` };
  }
  if (risk.risk_level === "medium") {
    return { tone: "warn", icon: "⚠", label: "REVISAR", msg: "Risco médio — checar checklist antes de aprovar o merge" };
  }
  if (ciOnBranch?.conclusion === "success" && risk.risk_level === "low" && pr.mergeable) {
    return { tone: "ok", icon: "✓", label: "PRONTO", msg: "CI verde, risco baixo, mergeável — pode prosseguir com merge" };
  }
  return { tone: "info", icon: "·", label: "VERIFICAR", msg: "Analise os dados acima antes de tomar uma decisão" };
}

function riskStyle(level) {
  const map = {
    low:    { background: "rgba(120,200,160,0.14)", color: "var(--ok)",     borderColor: "rgba(120,200,160,0.30)" },
    medium: { background: "rgba(220,180,100,0.14)", color: "var(--warn)",   borderColor: "rgba(220,180,100,0.30)" },
    high:   { background: "rgba(230,120,110,0.14)", color: "var(--danger)", borderColor: "rgba(230,120,110,0.30)" },
  };
  return map[level] || map.low;
}

function PrReadyA({ serverUrl, bearerToken = "" }) {
  const { useState } = React;
  const isDemo = !serverUrl;

  const [owner, setOwner]     = useState("vinicius-ssantos");
  const [repo,  setRepo]      = useState("github-unified-mcp");
  const [prNum, setPrNum]     = useState("138");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  const callTool = async (name, args) => {
    const authHeaders = bearerToken ? { "Authorization": `Bearer ${bearerToken}` } : {};
    const resp = await fetch(`${serverUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name, arguments: args } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    const raw = data?.result?.content?.[0]?.text;
    return raw ? JSON.parse(raw) : data.result;
  };

  const handleAnalyze = async () => {
    if (loading) return;
    setLoading(true); setResult(null); setError(null);
    // Persist last used PR
    try { localStorage.setItem('mcp-pr-owner', owner); localStorage.setItem('mcp-pr-repo', repo); localStorage.setItem('mcp-pr-num', prNum); } catch {}

    if (isDemo) {
      await new Promise(r => setTimeout(r, 550));
      setResult(PR_DEMO);
      setLoading(false);
      return;
    }

    try {
      const num = parseInt(prNum, 10);
      const args = { owner, repo };
      const [pr, risk, changedFiles, runsData] = await Promise.all([
        callTool("pr_get",               { ...args, pull_number: num }),
        callTool("pr_risk_review",       { ...args, pull_number: num }),
        callTool("pr_list_changed_files",{ ...args, pull_number: num }),
        callTool("actions_list_runs",    { ...args, per_page: 6 }),
      ]);
      setResult({
        pr,
        risk,
        files: changedFiles?.files || [],
        runs:  runsData?.workflow_runs || [],
      });
    } catch (e) {
      setError(e.message || "Falha ao contatar o servidor");
    }
    setLoading(false);
  };

  const rec = result ? deriveRecommendation(result) : null;
  const SD = window.StatusDot || (() => null);

  return (
    <div className="ca-prc">

      {/* ── Input form ── */}
      <div className="ca-prc-form">
        <div className="ca-prc-fields">
          <div className="ca-prc-field">
            <label className="mono ca-prc-label">owner</label>
            <input className="wiz-input mono" value={owner} onChange={e => setOwner(e.target.value)} />
          </div>
          <div className="ca-prc-field">
            <label className="mono ca-prc-label">repo</label>
            <input className="wiz-input mono" value={repo} onChange={e => setRepo(e.target.value)} />
          </div>
          <div className="ca-prc-field ca-prc-field-sm">
            <label className="mono ca-prc-label">pull #</label>
            <input className="wiz-input mono" value={prNum} onChange={e => setPrNum(e.target.value)} type="number" min="1" />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <button
            className={`ca-prc-btn ${loading ? "is-loading" : ""}`}
            onClick={handleAnalyze}
            disabled={loading}
          >
            {loading ? <span className="ca-pg-spin">◌</span> : isDemo ? "▶ analyze demo" : "▶ analyze"}
          </button>
          {isDemo && <span className="mono ca-prc-demo-note">DEMO · configure serverUrl para dados reais</span>}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="ca-pg-error">
          <span className="mono ca-pg-error-k">error</span>
          <span className="mono ca-pg-error-msg">{error}</span>
        </div>
      )}

      {/* ── Empty state ── */}
      {!result && !loading && !error && (
        <div className="ca-prc-empty">
          <div className="ca-prc-empty-eyebrow mono">fase 5 do roadmap</div>
          <div className="ca-prc-empty-title">PR Readiness Cockpit</div>
          <div className="ca-prc-empty-sub">
            Agrega <span className="mono">pr_risk_review</span>, <span className="mono">pr_get</span>,{" "}
            <span className="mono">pr_list_changed_files</span> e <span className="mono">actions_list_runs</span>{" "}
            numa visão única de operador. Identifica blockers antes do merge.
          </div>
          <button className="ca-prc-btn" onClick={handleAnalyze} style={{ marginTop: 8 }}>
            ▶ ver demo
          </button>
          <div className="ca-prc-recents">
            <div className="ca-prc-recents-label mono">PRs recentes (demo)</div>
            {[
              { owner:"vinicius-ssantos", repo:"github-unified-mcp", num:"138", title:"fix: allowlist enforcement — add repo guard" },
              { owner:"vinicius-ssantos", repo:"github-unified-mcp", num:"142", title:"feat: pr_risk_review tool" },
              { owner:"vinicius-ssantos", repo:"github-unified-mcp", num:"136", title:"chore: bump tool_schema_version" },
            ].map(pr => (
              <button key={pr.num} className="ca-prc-recent-btn" onClick={() => {
                setOwner(pr.owner); setRepo(pr.repo); setPrNum(pr.num);
              }}>
                <span className="ca-prc-recent-num mono">#{pr.num}</span>
                <span className="ca-prc-recent-title">{pr.title}</span>
                <span className="ca-prc-recent-repo mono">{pr.repo}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div className="ca-prc-results">

          {/* Recommendation banner */}
          <div className={`ca-prc-rec ca-prc-rec-${rec.tone}`}>
            <div className="ca-prc-rec-icon">{rec.icon}</div>
            <div>
              <div className="ca-prc-rec-label mono">{rec.label}</div>
              <div className="ca-prc-rec-msg">{rec.msg}</div>
            </div>
          </div>

          <div className="ca-prc-grid">

            {/* PR summary card */}
            <div className="ca-card">
              <div className="ca-card-h">
                <span className="ca-card-h-num mono">PR</span>
                <span className="ca-card-h-title">#{result.pr.number} — {result.pr.title}</span>
              </div>
              <div className="ca-prc-meta-list">
                {[
                  ["state",     result.pr.state],
                  ["draft",     String(!!result.pr.draft)],
                  ["mergeable", result.pr.mergeable_state || String(result.pr.mergeable)],
                  ["base ← head", `${result.pr.base} ← ${result.pr.head_branch || "—"}`],
                  ["head sha",  (result.pr.head_sha || "—").slice(0, 8)],
                  ["+/- linhas",`+${result.pr.additions || 0} / -${result.pr.deletions || 0}`],
                ].map(([k, v]) => (
                  <div key={k} className="ca-prc-meta-row">
                    <span className="mono ca-prc-meta-k">{k}</span>
                    <span className="mono ca-prc-meta-v">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk card */}
            <div className="ca-card">
              <div className="ca-card-h">
                <span className="ca-card-h-num mono">RISK</span>
                <span className="ca-risk" style={riskStyle(result.risk.risk_level)}>
                  {result.risk.risk_level}
                </span>
              </div>
              <div className="ca-prc-risk-summary">{result.risk.summary}</div>
              {result.risk.checklist?.length > 0 && (
                <ul className="ca-prc-checklist">
                  {result.risk.checklist.map((item, i) => (
                    <li key={i} className="ca-prc-check-item">
                      <span className="mono" style={{ color: "var(--text-muted)" }}>·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>

          <div className="ca-prc-grid ca-prc-grid-65">

            {/* Changed files */}
            <div className="ca-card">
              <div className="ca-card-h">
                <span className="ca-card-h-num mono">FILES</span>
                <span className="ca-card-h-title">
                  {result.files.length} arquivo{result.files.length !== 1 ? "s" : ""} alterado{result.files.length !== 1 ? "s" : ""}
                </span>
              </div>
              <table className="ca-prc-files">
                <tbody>
                  {result.files.map((f, i) => (
                    <tr key={i}>
                      <td className="mono ca-prc-fname">{f.filename}</td>
                      <td className="mono ca-prc-fstatus">{f.status}</td>
                      <td className="mono ca-prc-fadd">+{f.additions}</td>
                      <td className="mono ca-prc-fdel">-{f.deletions}</td>
                    </tr>
                  ))}
                  {result.files.length === 0 && (
                    <tr><td colSpan={4} className="mono" style={{ color: "var(--text-muted)", padding: "10px 0", fontSize: 12 }}>sem arquivos alterados</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* CI runs */}
            <div className="ca-card">
              <div className="ca-card-h">
                <span className="ca-card-h-num mono">CI</span>
                <span className="ca-card-h-title">workflow runs</span>
              </div>
              <div className="ca-prc-runs">
                {result.runs.slice(0, 6).map((r, i) => {
                  const tone = r.conclusion === "success" ? "ok" : r.conclusion === "failure" ? "danger" : "warn";
                  return (
                    <div key={i} className="ca-prc-run">
                      <SD tone={tone} />
                      <span className="mono ca-prc-run-name">{r.name}</span>
                      <span className="mono ca-prc-run-branch">{r.head_branch}</span>
                      <span className={`mono ca-prc-run-concl ca-prc-run-${tone}`}>
                        {r.conclusion || r.status}
                      </span>
                    </div>
                  );
                })}
                {result.runs.length === 0 && (
                  <div className="mono" style={{ color: "var(--text-muted)", fontSize: 12 }}>sem runs encontrados</div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

window.PrReadyA = PrReadyA;
