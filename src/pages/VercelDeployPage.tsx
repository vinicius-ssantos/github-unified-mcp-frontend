import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConsoleAdapter, VercelCredentials, VercelDeployStatus, VercelPlan } from '../types/mcp';

type Step = 'idle' | 'validating' | 'planning' | 'deploying' | 'polling';

type FormState = {
  project_name: string;
  github_repo: string;
  branch: string;
  framework: string;
  build_command: string;
  output_dir: string;
};

const DEFAULT_FORM: FormState = {
  project_name: 'deploy-orchestrator-mcp-frontend',
  github_repo: 'vinicius-ssantos/github-unified-mcp-frontend',
  branch: 'main',
  framework: 'vite',
  build_command: 'npm run build',
  output_dir: 'dist',
};

function StatusBadge({ status }: { status: VercelDeployStatus['status'] | 'PENDING' }) {
  const map: Record<string, string> = {
    READY: 'badge-ready',
    ERROR: 'badge-error',
    CANCELED: 'badge-error',
    BUILDING: 'badge-building',
    QUEUED: 'badge-building',
    PENDING: 'badge-building',
  };
  return <span className={`badge ${map[status] ?? 'badge-building'}`}>{status}</span>;
}

function CredentialCard({ creds }: { creds: VercelCredentials }) {
  return (
    <div className={`cred-card ${creds.valid ? 'cred-ok' : 'cred-err'}`}>
      <span className="cred-icon">{creds.valid ? '✓' : '✗'}</span>
      {creds.valid ? (
        <span>
          Token valid · <strong>{creds.user}</strong>
          {creds.team && <> · team <strong>{creds.team}</strong></>}
        </span>
      ) : (
        <span>Invalid credentials: {creds.error}</span>
      )}
    </div>
  );
}

function EnvCheck({ plan }: { plan: VercelPlan }) {
  const { found, warnings } = plan.public_env_check;
  if (found.length === 0) return <p className="env-ok">No sensitive VITE_* variables detected.</p>;
  return (
    <div className="env-warn">
      <p>Detected public env vars: {found.map((v) => <code key={v}>{v}</code>)}</p>
      {warnings.map((w) => <p key={w} className="env-warning-text">{w}</p>)}
    </div>
  );
}

type Props = { adapter: ConsoleAdapter };

export function VercelDeployPage({ adapter }: Props) {
  const [step, setStep] = useState<Step>('idle');
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [creds, setCreds] = useState<VercelCredentials | null>(null);
  const [plan, setPlan] = useState<VercelPlan | null>(null);
  const [deployStatus, setDeployStatus] = useState<VercelDeployStatus | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const setField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function handleValidate() {
    setError(null);
    setStep('validating');
    try {
      const result = await adapter.callTool<VercelCredentials>('vercel_validate_credentials', {});
      setCreds(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStep('idle');
    }
  }

  async function handlePlan() {
    setError(null);
    setStep('planning');
    setPlan(null);
    try {
      const result = await adapter.callTool<VercelPlan>('vercel_project_plan', { ...form });
      setPlan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStep('idle');
    }
  }

  async function handleDeploy() {
    setError(null);
    setStep('deploying');
    setDeployStatus(null);
    stopPolling();
    try {
      const result = await adapter.callTool<{ deployment_id: string; url: string; status: string }>(
        'vercel_deploy_preview',
        { ...form, approval: 'APPROVED', ci_gate: true },
      );
      setDeploymentId(result.deployment_id);
      setDeployStatus({ id: result.deployment_id, status: result.status as VercelDeployStatus['status'], url: result.url });
      setStep('polling');
      let pollErrors = 0;
      pollRef.current = setInterval(async () => {
        try {
          const status = await adapter.callTool<VercelDeployStatus>('vercel_get_deploy_status', { deployment_id: result.deployment_id });
          pollErrors = 0;
          setDeployStatus(status);
          if (status.status === 'READY' || status.status === 'ERROR' || status.status === 'CANCELED') {
            stopPolling();
            setStep('idle');
          }
        } catch (err) {
          pollErrors += 1;
          if (pollErrors >= 3) {
            stopPolling();
            setStep('idle');
            setError(`Polling stopped after repeated failures: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('idle');
    }
  }

  async function handleRefreshStatus() {
    if (!deploymentId) return;
    try {
      const status = await adapter.callTool<VercelDeployStatus>('vercel_get_deploy_status', { deployment_id: deploymentId });
      setDeployStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const busy = step !== 'idle';
  const canPlan = !busy && !!creds?.valid;
  const canDeploy = !busy && !!plan && !!creds?.valid;

  return (
    <div className="vercel-page">
      <div className="vercel-header">
        <div className="vercel-logo">▲</div>
        <div>
          <h2>Vercel Preview Deploy</h2>
          <p className="sub">Validate credentials → generate plan → deploy preview → track status</p>
        </div>
      </div>

      {error && <div className="notice">{error}</div>}

      {/* Step 1: Credentials */}
      <section className="panel deploy-section">
        <div className="section-label">1 · Credentials</div>
        {creds && <CredentialCard creds={creds} />}
        <button className="btn" onClick={handleValidate} disabled={busy}>
          {step === 'validating' ? 'Validating…' : 'Validate VERCEL_TOKEN'}
        </button>
      </section>

      {/* Step 2: Project config & plan */}
      <section className="panel deploy-section">
        <div className="section-label">2 · Project plan</div>
        <div className="form-grid">
          {([
            ['project_name', 'Project name'],
            ['github_repo', 'GitHub repo'],
            ['branch', 'Branch'],
            ['framework', 'Framework'],
            ['build_command', 'Build command'],
            ['output_dir', 'Output dir'],
          ] as [keyof FormState, string][]).map(([key, label]) => (
            <label key={key} className="field">
              <span>{label}</span>
              <input value={form[key]} onChange={setField(key)} disabled={busy} />
            </label>
          ))}
        </div>
        <button className="btn" onClick={handlePlan} disabled={!canPlan}>
          {step === 'planning' ? 'Generating plan…' : 'Generate plan (dry-run)'}
        </button>
        {!creds?.valid && <p className="field-hint">Validate credentials first.</p>}

        {plan && (
          <div className="plan-result">
            <div className="plan-grid">
              {([
                ['project_name', 'Project'],
                ['github_repo', 'Repo'],
                ['branch', 'Branch'],
                ['framework', 'Framework'],
                ['build_command', 'Build command'],
                ['output_dir', 'Output dir'],
              ] as [keyof VercelPlan, string][]).map(([key, label]) => (
                <div key={key} className="plan-row">
                  <span className="plan-key">{label}</span>
                  <span className="plan-val mono">{String(plan[key])}</span>
                </div>
              ))}
            </div>
            <div className="env-section">
              <div className="section-sublabel">Public env check</div>
              <EnvCheck plan={plan} />
            </div>
          </div>
        )}
      </section>

      {/* Step 3: Deploy */}
      <section className="panel deploy-section">
        <div className="section-label">3 · Deploy preview</div>
        <p className="sub">Sends <code>approval="APPROVED"</code> + <code>ci_gate=true</code> to the backend.</p>
        <button className="btn btn-deploy" onClick={handleDeploy} disabled={!canDeploy}>
          {step === 'deploying' ? 'Triggering deploy…' : 'Deploy Preview ▲'}
        </button>
        {!plan && <p className="field-hint">Generate a plan first.</p>}
      </section>

      {/* Step 4: Status */}
      {deployStatus && (
        <section className="panel deploy-section">
          <div className="section-label">4 · Deployment status</div>
          <div className="status-row">
            <StatusBadge status={deployStatus.status} />
            <span className="mono status-id">{deployStatus.id}</span>
            {step === 'polling' && <span className="polling-indicator">polling every 5s…</span>}
          </div>

          {deployStatus.status === 'READY' && (deployStatus.preview_url ?? deployStatus.url) && (
            <div className="preview-url-box">
              <span>Preview URL</span>
              <a
                href={deployStatus.preview_url ?? deployStatus.url}
                target="_blank"
                rel="noopener noreferrer"
                className="preview-url"
              >
                {deployStatus.preview_url ?? deployStatus.url}
              </a>
            </div>
          )}

          {deployStatus.status === 'ERROR' && deployStatus.error && (
            <div className="notice">{deployStatus.error}</div>
          )}

          <button className="btn btn-secondary" onClick={handleRefreshStatus} disabled={busy}>
            Refresh status
          </button>
        </section>
      )}
    </div>
  );
}
