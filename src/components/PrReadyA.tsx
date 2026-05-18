import { useState } from 'react';
import { callBffTool } from '../adapters/bffClient';
import StatusDot from './StatusDot';

type PrData = { number: number; title: string; state: string; draft: boolean; mergeable: boolean; mergeable_state: string; head_sha: string; base: string; head_branch: string; additions: number; deletions: number; changed_files: number };
type RiskData = { risk_level: string; summary: string; checklist: string[] };
type FileData = { filename: string; status: string; additions: number; deletions: number };
type RunData = { name: string; status: string; conclusion: string; head_branch: string };
type ResultData = { pr: PrData; risk: RiskData; files: FileData[]; runs: RunData[] };

const PR_DEMO: ResultData = {
  pr: { number: 138, title: "fix: allowlist enforcement — add repo guard", state: "open", draft: false, mergeable: true, mergeable_state: "clean", head_sha: "a1b2c3d4e5f6", base: "main", head_branch: "feat/policy-43", additions: 40, deletions: 8, changed_files: 3 },
  risk: { risk_level: "medium", summary: "Modifica guard de segurança central. Revisar lógica de allowlist com atenção.", checklist: ["Verificar cobertura de testes para novos casos de allowlist", "Confirmar que CI está verde no branch feat/policy-43", "Revisar impacto em repos fora da allowlist configurada"] },
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

function deriveRecommendation({ pr, risk, runs }: ResultData) {
  const branch = pr.head_branch ?? "";
  const ciOnBranch = runs.find(r => r.head_branch === branch);
  if (risk.risk_level === "high") return { tone: "danger", icon: "✗", label: "BLOQUEADO", msg: "Risco alto — revisão manual obrigatória antes do merge" };
  if (!pr.mergeable || pr.mergeable_state === "dirty") return { tone: "danger", icon: "✗", label: "CONFLITO", msg: "Branch com conflito — resolver antes de prosseguir" };
  if (ciOnBranch?.conclusion === "failure") return { tone: "warn", icon: "⚠", label: "CI FALHOU", msg: `Último run em ${branch} terminou com falha — verificar logs` };
  if (risk.risk_level === "medium") return { tone: "warn", icon: "⚠", label: "REVISAR", msg: "Risco médio — checar checklist antes de aprovar o merge" };
  if (ciOnBranch?.conclusion === "success" && risk.risk_level === "low" && pr.mergeable) return { tone: "ok", icon: "✓", label: "PRONTO", msg: "CI verde, risco baixo, mergeável — pode prosseguir com merge" };
  return { tone: "info", icon: "·", label: "VERIFICAR", msg: "Analise os dados acima antes de tomar uma decisão" };
}

const riskStyle = (level: string) => {
  if (level === 'low') return { background: "rgba(120,200,160,0.14)", color: "var(--ok)", borderColor: "rgba(120,200,160,0.30)" };
  if (level === 'medium') return { background: "rgba(220,180,100,0.14)", color: "var(--warn)", borderColor: "rgba(220,180,100,0.30)" };
  return { background: "rgba(230,120,110,0.14)", color: "var(--danger)", borderColor: "rgba(230,120,110,0.30)" };
};

type Props = { serverUrl: string; bearerToken?: string; mode?: string };

export default function PrReadyA({ serverUrl, bearerToken = "" }: Props) {
  const isDemo = !serverUrl;
  const [owner, setOwner] = useState("vinicius-ssantos");
  const [repo, setRepo] = useState("github-unified-mcp");
  const [prNum, setPrNum] = useState("138");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callTool = async <T = unknown>(name: string, args: Record<string, unknown>) =>
    callBffTool<T>(serverUrl, name, args, { bearerToken, timeoutMs: 8000 });

  const handleAnalyze = async () => {
    if (loading) return;
    setLoading(true); setResult(null); setError(null);
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
        callTool<PrData>("pr_get", { ...args, pull_number: num }),
        callTool<RiskData>("pr_risk_review", { ...args, pull_number: num }),
        callTool<FileData[] | { files: FileData[] }>("pr_list_changed_files", { ...args, pull_number: num }),
        callTool<RunData[] | { workflow_runs: RunData[] }>("actions_list_runs", { ...args, per_page: 6 }),
      ]);
      const files = Array.isArray(changedFiles) ? changedFiles : changedFiles.files;
      const runs = Array.isArray(runsData) ? runsData : runsData.workflow_runs;
      setResult({ pr, risk, files, runs });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    }
    setLoading(false);
  };

  const rec = result ? deriveRecommendation(result) : null;

  return (
    <div className="ca-prc">
      <div className="ca-prc-head">
        <div className="ca-prc-title">PR Readiness Cockpit</div>
        <div className="ca-prc-sub">Agrega pr_get · pr_risk_review · pr_list_changed_files · actions_list_runs</div>
        {isDemo && <span className="mono ca-prc-demo-note">DEMO · configure serverUrl para dados reais</span>}
      </div>

      <div className="ca-prc-form">
        <input className="ca-prc-input mono" placeholder="owner" value={owner} onChange={e => setOwner(e.target.value)} />
        <span className="mono" style={{ color: "var(--text-dim)" }}>/</span>
        <input className="ca-prc-input mono" placeholder="repo" value={repo} onChange={e => setRepo(e.target.value)} />
        <span className="mono" style={{ color: "var(--text-dim)" }}>#</span>
        <input className="ca-prc-input mono ca-prc-num" placeholder="PR" value={prNum} onChange={e => setPrNum(e.target.value)} style={{ width: 80 }} />
        <button className="ca-prc-btn" onClick={handleAnalyze} disabled={loading}>
          {loading ? "analisando…" : isDemo ? "▶ analyze demo" : "▶ analyze"}
        </button>
      </div>

      {error && <div className="ca-prc-error mono">{error}</div>}

      {result && rec && (
        <div className="ca-prc-result">
          <div className={`ca-prc-rec ca-prc-rec-${rec.tone}`}>
            <span className="ca-prc-rec-icon">{rec.icon}</span>
            <div>
              <div className="ca-prc-rec-label mono">{rec.label}</div>
              <div className="ca-prc-rec-msg">{rec.msg}</div>
            </div>
          </div>

          <div className="ca-prc-grid">
            <div className="ca-prc-card">
              <div className="ca-prc-card-h mono">PR #{result.pr.number}</div>
              <div className="ca-prc-pr-title">{result.pr.title}</div>
              <div className="ca-prc-meta mono">
                <span>{result.pr.head_branch} → {result.pr.base}</span>
                <span>+{result.pr.additions} -{result.pr.deletions}</span>
                <span>{result.pr.changed_files} files</span>
                <span style={result.pr.mergeable ? {} : { color: "var(--danger)" }}>
                  {result.pr.mergeable_state}
                </span>
              </div>
            </div>

            <div className="ca-prc-card">
              <div className="ca-prc-card-h mono">risk review</div>
              <span className="ca-risk mono" style={riskStyle(result.risk.risk_level)}>{result.risk.risk_level}</span>
              <div className="ca-prc-risk-summary">{result.risk.summary}</div>
              <ul className="ca-prc-checklist">
                {result.risk.checklist.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>

            <div className="ca-prc-card">
              <div className="ca-prc-card-h mono">changed files · {result.files.length}</div>
              <table className="ca-prc-files">
                <tbody>
                  {result.files.map(f => (
                    <tr key={f.filename}>
                      <td className="mono ca-prc-fname">{f.filename}</td>
                      <td className="mono" style={{ color: "var(--ok)" }}>+{f.additions}</td>
                      <td className="mono" style={{ color: "var(--danger)" }}>-{f.deletions}</td>
                      <td className="mono ca-prc-fstatus">{f.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ca-prc-card">
              <div className="ca-prc-card-h mono">CI runs</div>
              <div className="ca-prc-runs">
                {result.runs.map((r, i) => (
                  <div key={i} className="ca-prc-run">
                    <StatusDot tone={r.conclusion === "success" ? "ok" : r.conclusion === "failure" ? "danger" : "warn"} />
                    <span className="mono ca-prc-run-name">{r.name}</span>
                    <span className="mono ca-prc-run-branch">{r.head_branch}</span>
                    <span className="mono" style={{ color: r.conclusion === "success" ? "var(--ok)" : r.conclusion === "failure" ? "var(--danger)" : "var(--warn)" }}>
                      {r.conclusion ?? r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
