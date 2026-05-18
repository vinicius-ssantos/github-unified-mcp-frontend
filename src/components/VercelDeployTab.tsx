import { useState, useEffect, useCallback, useRef } from 'react';
import { callBffTool } from '../adapters/bffClient';

// ── Types ────────────────────────────────────────────────────────────────────

type VercelCreds   = { valid: boolean; user?: string; team?: string; error?: string };
type VercelPlan    = { project_name: string; github_repo: string; branch: string; framework: string; build_command: string; output_dir: string; public_env_check: { found: string[]; warnings: string[] } };
type DeployStatus  = { id: string; status: 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED'; url?: string; preview_url?: string; error?: string };
type FormState     = { project_name: string; github_repo: string; branch: string; framework: string; build_command: string; output_dir: string };
type Step          = 'idle' | 'validating' | 'planning' | 'deploying' | 'polling';

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_CREDS: VercelCreds  = { valid: true, user: 'vinicius-ssantos', team: undefined };
const DEMO_PLAN: VercelPlan    = {
  project_name: 'github-unified-mcp-frontend',
  github_repo: 'vinicius-ssantos/github-unified-mcp-frontend',
  branch: 'main', framework: 'vite',
  build_command: 'npm run build', output_dir: 'dist',
  public_env_check: { found: ['VITE_MCP_URL'], warnings: ['VITE_MCP_URL é exposto client-side — certifique-se de que é um endpoint público'] },
};
const DEMO_DEPLOY_ID    = 'dpl_Abc7X9mR2kPsE1nYqZw3';
const DEMO_PREVIEW_URL  = 'https://github-unified-mcp-frontend-git-main.vercel.app';
const DEMO_STATUS_SEQ: DeployStatus['status'][] = ['QUEUED', 'BUILDING', 'BUILDING', 'READY'];

// ── Sub-components ────────────────────────────────────────────────────────────

function VBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; border: string }> = {
    READY:    { bg: 'rgba(58,190,120,.18)',  color: '#3abe78',  border: 'rgba(58,190,120,.35)'  },
    ERROR:    { bg: 'rgba(255,90,90,.14)',   color: '#ff7070',  border: 'rgba(255,90,90,.3)'    },
    CANCELED: { bg: 'rgba(255,90,90,.14)',   color: '#ff7070',  border: 'rgba(255,90,90,.3)'    },
    BUILDING: { bg: 'rgba(255,183,77,.14)',  color: '#ffc040',  border: 'rgba(255,183,77,.3)'   },
    QUEUED:   { bg: 'rgba(255,183,77,.14)',  color: '#ffc040',  border: 'rgba(255,183,77,.3)'   },
    PENDING:  { bg: 'rgba(255,183,77,.14)',  color: '#ffc040',  border: 'rgba(255,183,77,.3)'   },
  };
  const c = cfg[status] ?? { bg: 'rgba(180,180,200,.1)', color: '#8392b5', border: 'rgba(145,166,216,.2)' };
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, display: 'inline-block', borderRadius: 999, padding: '3px 11px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>
      {status}
    </span>
  );
}

function VPanel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--surface-2,#0d131f)', border: '1px solid var(--border,#1c2538)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--text-muted,#555)', letterSpacing: '.08em' }}>{n}</span>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--text-dim,#888)' }}>{children}</span>
    </div>
  );
}

function VField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 5, fontSize: 13, color: 'var(--text-dim,#888)' }}>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{label}</span>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = { serverUrl: string; bearerToken?: string };

export default function VercelDeployTab({ serverUrl, bearerToken = '' }: Props) {
  const isDemo = !serverUrl;

  const [form, setForm] = useState<FormState>({
    project_name: 'github-unified-mcp-frontend',
    github_repo: 'vinicius-ssantos/github-unified-mcp-frontend',
    branch: 'main', framework: 'vite',
    build_command: 'npm run build', output_dir: 'dist',
  });

  const [step, setStep]                     = useState<Step>('idle');
  const [creds, setCreds]                   = useState<VercelCreds | null>(null);
  const [plan, setPlan]                     = useState<VercelPlan | null>(null);
  const [deployStatus, setDeployStatus]     = useState<DeployStatus | null>(null);
  const [deploymentId, setDeploymentId]     = useState<string | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const pollRef                             = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoSeqRef                          = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const callTool = async <T = unknown>(name: string, args: Record<string, unknown>): Promise<T> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
    const resp = await fetch(`${serverUrl}/mcp`, {
      method: 'POST', headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }),
      signal: AbortSignal.timeout(12000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    const data = await resp.json();
    if (data.error) throw new Error(`MCP ${data.error.code}: ${data.error.message}`);
    const raw = data?.result?.content?.[0]?.text;
    return (raw ? JSON.parse(raw) : data.result) as T;
  };

  const handleValidate = async () => {
    setError(null); setStep('validating');
    if (isDemo) {
      await new Promise(r => setTimeout(r, 700));
      setCreds(DEMO_CREDS); setStep('idle'); return;
    }
    try { setCreds(await callTool<VercelCreds>('vercel_validate_credentials', {})); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro desconhecido'); }
    setStep('idle');
  };

  const handlePlan = async () => {
    setError(null); setPlan(null); setStep('planning');
    if (isDemo) {
      await new Promise(r => setTimeout(r, 900));
      setPlan(DEMO_PLAN); setStep('idle'); return;
    }
    try { setPlan(await callTool<VercelPlan>('vercel_project_plan', { ...form })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro desconhecido'); }
    setStep('idle');
  };

  const handleDeploy = async () => {
    setError(null); setDeployStatus(null); stopPolling(); setStep('deploying');

    if (isDemo) {
      await new Promise(r => setTimeout(r, 800));
      demoSeqRef.current = 1;
      setDeploymentId(DEMO_DEPLOY_ID);
      setDeployStatus({ id: DEMO_DEPLOY_ID, status: 'QUEUED', url: DEMO_PREVIEW_URL });
      setStep('polling');
      pollRef.current = setInterval(() => {
        const idx = demoSeqRef.current;
        if (idx >= DEMO_STATUS_SEQ.length - 1) {
          clearInterval(pollRef.current!); pollRef.current = null;
          setDeployStatus(s => s ? { ...s, status: 'READY', preview_url: DEMO_PREVIEW_URL } : s);
          setStep('idle');
        } else {
          demoSeqRef.current = idx + 1;
          setDeployStatus(s => s ? { ...s, status: DEMO_STATUS_SEQ[demoSeqRef.current] } : s);
        }
      }, 2000);
      return;
    }

    try {
      const result = await callTool<{ deployment_id: string; url: string; status: string }>('vercel_deploy_preview', { ...form, approval: 'APPROVED', ci_gate: true });
      setDeploymentId(result.deployment_id);
      setDeployStatus({ id: result.deployment_id, status: result.status as DeployStatus['status'], url: result.url });
      setStep('polling');
      let pollErrors = 0;
      pollRef.current = setInterval(async () => {
        try {
          const st = await callTool<DeployStatus>('vercel_get_deploy_status', { deployment_id: result.deployment_id });
          pollErrors = 0; setDeployStatus(st);
          if (['READY', 'ERROR', 'CANCELED'].includes(st.status)) { stopPolling(); setStep('idle'); }
        } catch (e) {
          if (++pollErrors >= 3) { stopPolling(); setStep('idle'); setError(`Polling interrompido: ${e instanceof Error ? e.message : 'erro'}`); }
        }
      }, 5000);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro desconhecido'); setStep('idle'); }
  };

  const handleRefreshStatus = async () => {
    if (!deploymentId) return;
    try { setDeployStatus(await callTool<DeployStatus>('vercel_get_deploy_status', { deployment_id: deploymentId })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro desconhecido'); }
  };

  const busy      = step !== 'idle';
  const canPlan   = !busy && !!creds?.valid;
  const canDeploy = !busy && !!plan && !!creds?.valid;

  const inputSt: React.CSSProperties = {
    border: '1px solid var(--border,#1c2538)', borderRadius: 7,
    padding: '8px 10px', background: 'var(--surface,#080d16)',
    color: 'var(--text,#c8d8f8)', fontSize: 12,
    fontFamily: 'ui-monospace, monospace',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  const btnSt = (disabled: boolean, variant: 'default' | 'deploy' | 'secondary' = 'default'): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '9px 18px', borderRadius: 9, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? .4 : 1, fontFamily: 'inherit', transition: 'background .15s, border-color .15s', alignSelf: 'start',
    ...(variant === 'deploy'
      ? { background: 'rgba(14,18,28,.9)', border: '1px solid rgba(200,200,215,.55)', color: '#eef3ff', fontWeight: 600, fontSize: 14, padding: '11px 24px' }
      : variant === 'secondary'
        ? { background: 'rgba(255,255,255,.05)', border: '1px solid var(--border,#1c2538)', color: 'var(--text-dim,#888)' }
        : { background: 'rgba(64,113,255,.14)', border: '1px solid rgba(64,113,255,.4)', color: '#a8beff' }
    ),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 820, padding: '0 0 48px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: 'var(--text,#c8d8f8)', lineHeight: 1 }}>▲</div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--text,#c8d8f8)' }}>Vercel Preview Deploy</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim,#888)', marginTop: 3 }}>
            validate credentials → gerar plano → deploy preview → monitorar status
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          {isDemo
            ? <span style={{ background: 'rgba(220,180,100,.12)', border: '1px solid rgba(220,180,100,.25)', borderRadius: 6, padding: '4px 9px', fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--warn,#f0b429)', textTransform: 'uppercase', letterSpacing: '.08em' }}>DEMO · configure serverUrl</span>
            : <span style={{ background: 'rgba(58,190,120,.1)', border: '1px solid rgba(58,190,120,.25)', borderRadius: 6, padding: '4px 9px', fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#3abe78', textTransform: 'uppercase', letterSpacing: '.08em', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3abe78', display: 'inline-block' }} />
                LIVE
              </span>
          }
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(230,80,80,.1)', border: '1px solid rgba(230,80,80,.28)', borderRadius: 10, padding: '11px 15px', color: '#ff8080', fontFamily: 'ui-monospace, monospace', fontSize: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0 }}>✗</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ff8080', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
        </div>
      )}

      {/* Step 1: Credentials */}
      <VPanel>
        <SectionLabel n="01">Credentials</SectionLabel>
        {creds && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderRadius: 9, fontSize: 13, background: creds.valid ? 'rgba(58,190,120,.09)' : 'rgba(255,90,90,.09)', border: `1px solid ${creds.valid ? 'rgba(58,190,120,.28)' : 'rgba(255,90,90,.28)'}`, color: creds.valid ? '#3abe78' : '#ff7070' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{creds.valid ? '✓' : '✗'}</span>
            {creds.valid
              ? <span>Token válido · <strong>{creds.user}</strong>{creds.team ? ` · team ${creds.team}` : ''}</span>
              : <span>Credenciais inválidas: {creds.error}</span>
            }
          </div>
        )}
        <button style={btnSt(busy)} onClick={handleValidate} disabled={busy}>
          {step === 'validating' ? 'Validando…' : 'Validar VERCEL_TOKEN'}
        </button>
      </VPanel>

      {/* Step 2: Project plan */}
      <VPanel>
        <SectionLabel n="02">Project plan</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
          {([
            ['project_name', 'Project name',  ''],
            ['github_repo',  'GitHub repo',   'owner/repo'],
            ['branch',       'Branch',        'main'],
            ['framework',    'Framework',     'vite | next | react | …'],
            ['build_command','Build command', 'npm run build'],
            ['output_dir',   'Output dir',   'dist'],
          ] as [keyof FormState, string, string][]).map(([key, label, placeholder]) => (
            <VField key={key} label={label}>
              <input style={inputSt} value={form[key]} placeholder={placeholder}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} disabled={busy} />
            </VField>
          ))}
        </div>
        <button style={btnSt(!canPlan)} onClick={handlePlan} disabled={!canPlan}>
          {step === 'planning' ? 'Gerando plano…' : 'Gerar plano (dry-run)'}
        </button>
        {!creds && <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted,#555)' }}>Valide as credenciais primeiro.</p>}
        {plan && (
          <div style={{ borderTop: '1px solid var(--border,#1c2538)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              {(['project_name','github_repo','branch','framework','build_command','output_dir'] as (keyof VercelPlan)[]).map(k => (
                <div key={String(k)} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-dim,#888)' }}>{String(k).replace(/_/g, ' ')}</span>
                  <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text,#c8d8f8)' }}>{String(plan[k]) || '—'}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border,#1c2538)', paddingTop: 10 }}>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-muted,#555)', marginBottom: 7 }}>Public env check</div>
              {plan.public_env_check.found.length === 0
                ? <p style={{ margin: 0, fontSize: 12, color: '#3abe78' }}>Nenhuma variável VITE_* sensível detectada.</p>
                : <div style={{ background: 'rgba(220,180,100,.09)', border: '1px solid rgba(220,180,100,.22)', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#f0b429' }}>
                    <div style={{ marginBottom: 5 }}>Vars públicas: {plan.public_env_check.found.map(v => <code key={v} style={{ background: 'rgba(220,180,100,.14)', borderRadius: 3, padding: '1px 5px', margin: '0 3px', fontFamily: 'ui-monospace, monospace' }}>{v}</code>)}</div>
                    {plan.public_env_check.warnings.map((w, i) => <div key={i} style={{ opacity: .8, lineHeight: 1.4 }}>{w}</div>)}
                  </div>
              }
            </div>
          </div>
        )}
      </VPanel>

      {/* Step 3: Deploy */}
      <VPanel>
        <SectionLabel n="03">Deploy preview</SectionLabel>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim,#888)', lineHeight: 1.5 }}>
          Envia <code style={{ fontFamily: 'ui-monospace, monospace', background: 'rgba(255,255,255,.07)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>approval="APPROVED"</code>
          {' + '}<code style={{ fontFamily: 'ui-monospace, monospace', background: 'rgba(255,255,255,.07)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>ci_gate=true</code> para o backend.
        </p>
        <button style={btnSt(!canDeploy, 'deploy')} onClick={handleDeploy} disabled={!canDeploy}>
          {step === 'deploying' ? 'Disparando deploy…' : 'Deploy Preview ▲'}
        </button>
        {!plan && <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted,#555)' }}>Gere um plano primeiro.</p>}
      </VPanel>

      {/* Step 4: Status */}
      {deployStatus && (
        <VPanel>
          <SectionLabel n="04">Deployment status</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <VBadge status={deployStatus.status} />
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--text-dim,#888)' }}>{deployStatus.id}</span>
            {step === 'polling' && <span style={{ fontSize: 11, color: 'var(--text-muted,#555)', fontStyle: 'italic' }}>{isDemo ? 'simulando progressão…' : 'polling a cada 5s…'}</span>}
          </div>
          {deployStatus.status === 'READY' && (deployStatus.preview_url ?? deployStatus.url) && (
            <div style={{ background: 'rgba(58,190,120,.07)', border: '1px solid rgba(58,190,120,.2)', borderRadius: 9, padding: '11px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: '#3abe78' }}>Preview URL</span>
              <a href={deployStatus.preview_url ?? deployStatus.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#7dd3fc', wordBreak: 'break-all' }}>
                {deployStatus.preview_url ?? deployStatus.url}
              </a>
            </div>
          )}
          {deployStatus.status === 'ERROR' && deployStatus.error && (
            <div style={{ background: 'rgba(230,80,80,.09)', border: '1px solid rgba(230,80,80,.25)', borderRadius: 8, padding: '9px 12px', color: '#ff7070', fontSize: 12 }}>{deployStatus.error}</div>
          )}
          {!isDemo && <button style={btnSt(busy, 'secondary')} onClick={handleRefreshStatus} disabled={busy}>Atualizar status</button>}
        </VPanel>
      )}
    </div>
  );
}
