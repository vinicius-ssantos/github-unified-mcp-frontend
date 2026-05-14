import { useState, useMemo } from 'react';

type Cfg = {
  GITHUB_TOKEN: string;
  GITHUB_ALLOWED_REPOS: string;
  GITHUB_REQUIRE_ALLOWED_REPOS: boolean;
  GITHUB_READ_ONLY: boolean;
  GITHUB_PROTECTED_BRANCHES: string;
  GITHUB_ENABLE_DANGEROUS_TOOLS: boolean;
  GITHUB_ALLOW_WORKFLOW_DISPATCH: boolean;
  GITHUB_DESTRUCTIVE_CONFIRMATION: boolean;
  FASTMCP_PORT: string;
  FASTMCP_HOST: string;
  FASTMCP_ALLOW_REMOTE_HOSTS: boolean;
  FASTMCP_ALLOWED_HOSTS: string;
  FASTMCP_ALLOWED_ORIGINS: string;
  MCP_OAUTH_ALLOWED_REDIRECT_URIS: string;
  MCP_OAUTH_RATE_LIMIT_ENABLED: boolean;
  MCP_OAUTH_RATE_LIMIT_WINDOW_SECONDS: string;
  MCP_OAUTH_RATE_LIMIT_MAX_REQUESTS: string;
  MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS: string;
  MCP_OAUTH_SIGNING_KEY: string;
  GITHUB_MIN_REQUEST_INTERVAL_SECONDS: string;
  deployTarget: string;
};

function WizSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="wiz-section">
      <div className="wiz-section-h mono">{title}</div>
      <div className="wiz-section-body">{children}</div>
    </div>
  );
}

function WizField({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="wiz-field">
      <label className="wiz-label mono">{label}</label>
      {children}
      {hint && <div className="wiz-hint">{hint}</div>}
    </div>
  );
}

function WizToggle({ label, value, onChange, hint, tone = 'ok', disabled = false }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
  hint: string; tone?: string; disabled?: boolean;
}) {
  const toneColor = tone === 'warn' ? 'var(--warn)' : tone === 'danger' ? 'var(--danger)' : 'var(--ok)';
  return (
    <div className={`wiz-field wiz-toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <label className="wiz-label mono">{label}</label>
      <button
        className={`wiz-toggle ${value ? 'is-on' : ''}`}
        style={value ? { background: toneColor, borderColor: toneColor } : {}}
        onClick={() => !disabled && onChange(!value)}
        aria-pressed={value}
      >
        <span className="wiz-toggle-thumb" />
        <span className="wiz-toggle-val mono">{String(value)}</span>
      </button>
      {hint && <div className="wiz-hint">{hint}</div>}
    </div>
  );
}

function WizRow2({ children }: { children: React.ReactNode }) {
  return <div className="wiz-row2">{children}</div>;
}

export default function EnvWizard() {
  const [cfg, setCfg] = useState<Cfg>({
    GITHUB_TOKEN: "ghp_••••••••••••••••••••••",
    GITHUB_ALLOWED_REPOS: "vinicius-ssantos/github-unified-mcp,vinicius-ssantos/jobHunterAgent",
    GITHUB_REQUIRE_ALLOWED_REPOS: true,
    GITHUB_READ_ONLY: true,
    GITHUB_PROTECTED_BRANCHES: "main,master,release/*",
    GITHUB_ENABLE_DANGEROUS_TOOLS: false,
    GITHUB_ALLOW_WORKFLOW_DISPATCH: false,
    GITHUB_DESTRUCTIVE_CONFIRMATION: false,
    FASTMCP_PORT: "8765",
    FASTMCP_HOST: "0.0.0.0",
    FASTMCP_ALLOW_REMOTE_HOSTS: false,
    FASTMCP_ALLOWED_HOSTS: "",
    FASTMCP_ALLOWED_ORIGINS: "",
    MCP_OAUTH_ALLOWED_REDIRECT_URIS: "https://chatgpt.com/aip/g-*/oauth/callback,https://chat.openai.com/aip/g-*/oauth/callback",
    MCP_OAUTH_RATE_LIMIT_ENABLED: true,
    MCP_OAUTH_RATE_LIMIT_WINDOW_SECONDS: "60",
    MCP_OAUTH_RATE_LIMIT_MAX_REQUESTS: "30",
    MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS: "2592000",
    MCP_OAUTH_SIGNING_KEY: "— gere com: openssl rand -hex 32 —",
    GITHUB_MIN_REQUEST_INTERVAL_SECONDS: "0",
    deployTarget: "render",
  });

  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setCfg(p => ({ ...p, [k]: v }));

  const mode = cfg.GITHUB_READ_ONLY ? "read_only" : !cfg.GITHUB_ENABLE_DANGEROUS_TOOLS ? "write_safe" : "operator";
  const modeLabel = { read_only: "Read-only", write_safe: "Write-safe pessoal", operator: "Operador" }[mode];
  const modeColor = { read_only: "var(--ok)", write_safe: "var(--info)", operator: "var(--warn)" }[mode];

  const warnings = useMemo(() => {
    const w: { key: string; msg: string }[] = [];
    if (cfg.GITHUB_ENABLE_DANGEROUS_TOOLS && cfg.GITHUB_READ_ONLY)
      w.push({ key: "conflict", msg: "GITHUB_ENABLE_DANGEROUS_TOOLS=true ignorado quando GITHUB_READ_ONLY=true." });
    if (!cfg.GITHUB_REQUIRE_ALLOWED_REPOS && !cfg.GITHUB_ALLOWED_REPOS.trim())
      w.push({ key: "allowlist", msg: "GITHUB_REQUIRE_ALLOWED_REPOS=false sem ALLOWED_REPOS — qualquer repo pode ser acessado." });
    if (cfg.FASTMCP_ALLOW_REMOTE_HOSTS && !cfg.FASTMCP_ALLOWED_HOSTS.trim())
      w.push({ key: "remote", msg: "ALLOW_REMOTE_HOSTS=true sem ALLOWED_HOSTS — aceita qualquer host. Use só para validação por túnel." });
    if (cfg.GITHUB_DESTRUCTIVE_CONFIRMATION && !cfg.GITHUB_ENABLE_DANGEROUS_TOOLS && !cfg.GITHUB_READ_ONLY)
      w.push({ key: "dangerous_confirm", msg: "DESTRUCTIVE_CONFIRMATION está ativo mas ENABLE_DANGEROUS_TOOLS=false — confirm nunca será exigido." });
    if (cfg.MCP_OAUTH_SIGNING_KEY.startsWith("—"))
      w.push({ key: "signing_key", msg: "MCP_OAUTH_SIGNING_KEY não configurado — gere um segredo antes de fazer deploy." });
    return w;
  }, [cfg]);

  const envOutput = useMemo(() => [
    `# github-unified-mcp · ${modeLabel}`,
    `# gerado em ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
    "",
    "# GitHub",
    `GITHUB_TOKEN=${cfg.GITHUB_TOKEN}`,
    `GITHUB_ALLOWED_REPOS=${cfg.GITHUB_ALLOWED_REPOS}`,
    `GITHUB_REQUIRE_ALLOWED_REPOS=${cfg.GITHUB_REQUIRE_ALLOWED_REPOS}`,
    `GITHUB_READ_ONLY=${cfg.GITHUB_READ_ONLY}`,
    `GITHUB_PROTECTED_BRANCHES=${cfg.GITHUB_PROTECTED_BRANCHES}`,
    `GITHUB_ENABLE_DANGEROUS_TOOLS=${cfg.GITHUB_ENABLE_DANGEROUS_TOOLS}`,
    `GITHUB_ALLOW_WORKFLOW_DISPATCH=${cfg.GITHUB_ALLOW_WORKFLOW_DISPATCH}`,
    cfg.GITHUB_DESTRUCTIVE_CONFIRMATION ? "GITHUB_DESTRUCTIVE_CONFIRMATION=CONFIRM_DESTRUCTIVE_OPERATION" : "GITHUB_DESTRUCTIVE_CONFIRMATION=",
    `GITHUB_MIN_REQUEST_INTERVAL_SECONDS=${cfg.GITHUB_MIN_REQUEST_INTERVAL_SECONDS}`,
    "",
    "# FastMCP",
    `FASTMCP_PORT=${cfg.FASTMCP_PORT}`,
    `FASTMCP_HOST=${cfg.FASTMCP_HOST}`,
    `FASTMCP_ALLOW_REMOTE_HOSTS=${cfg.FASTMCP_ALLOW_REMOTE_HOSTS}`,
    cfg.FASTMCP_ALLOWED_HOSTS ? `FASTMCP_ALLOWED_HOSTS=${cfg.FASTMCP_ALLOWED_HOSTS}` : "FASTMCP_ALLOWED_HOSTS=",
    cfg.FASTMCP_ALLOWED_ORIGINS ? `FASTMCP_ALLOWED_ORIGINS=${cfg.FASTMCP_ALLOWED_ORIGINS}` : "FASTMCP_ALLOWED_ORIGINS=",
    "",
    "# OAuth",
    `MCP_OAUTH_ALLOWED_REDIRECT_URIS=${cfg.MCP_OAUTH_ALLOWED_REDIRECT_URIS}`,
    `MCP_OAUTH_RATE_LIMIT_ENABLED=${cfg.MCP_OAUTH_RATE_LIMIT_ENABLED}`,
    `MCP_OAUTH_RATE_LIMIT_WINDOW_SECONDS=${cfg.MCP_OAUTH_RATE_LIMIT_WINDOW_SECONDS}`,
    `MCP_OAUTH_RATE_LIMIT_MAX_REQUESTS=${cfg.MCP_OAUTH_RATE_LIMIT_MAX_REQUESTS}`,
    `MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS=${cfg.MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS}`,
    `MCP_OAUTH_SIGNING_KEY=${cfg.MCP_OAUTH_SIGNING_KEY}`,
  ].join("\n"), [cfg, modeLabel]);

  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText(envOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const handleDownload = () => {
    const blob = new Blob([envOutput], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = ".env";
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 500);
  };

  return (
    <div className="ca-wizard">
      <div className="ca-wizard-layout">
        <div className="ca-wizard-controls">
          <div className="ca-wiz-mode" style={{ borderColor: modeColor }}>
            <div className="ca-wiz-mode-dot" style={{ background: modeColor }} />
            <div>
              <div className="ca-wiz-mode-label mono">modo resultante</div>
              <div className="ca-wiz-mode-value" style={{ color: modeColor }}>{modeLabel}</div>
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="ca-wiz-warnings">
              {warnings.map(w => (
                <div key={w.key} className="ca-wiz-warn">
                  <span className="ca-wiz-warn-icon">⚠</span>
                  <span>{w.msg}</span>
                </div>
              ))}
            </div>
          )}

          <WizSection title="01 · GitHub — identidade & acesso">
            <WizField label="GITHUB_TOKEN" hint="Fine-grained PAT — nunca exposto nos outputs do servidor.">
              <input className="wiz-input mono" type="password" value={cfg.GITHUB_TOKEN} onChange={e => set("GITHUB_TOKEN", e.target.value)} />
            </WizField>
            <WizField label="GITHUB_ALLOWED_REPOS" hint="Separado por vírgula. Repos fora desta lista são recusados.">
              <textarea className="wiz-input mono wiz-textarea" value={cfg.GITHUB_ALLOWED_REPOS} onChange={e => set("GITHUB_ALLOWED_REPOS", e.target.value)} rows={2} />
            </WizField>
            <WizToggle label="GITHUB_REQUIRE_ALLOWED_REPOS" value={cfg.GITHUB_REQUIRE_ALLOWED_REPOS} onChange={v => set("GITHUB_REQUIRE_ALLOWED_REPOS", v)} hint="Falha quando ALLOWED_REPOS está vazio." />
          </WizSection>

          <WizSection title="02 · Postura de escrita">
            <WizToggle label="GITHUB_READ_ONLY" value={cfg.GITHUB_READ_ONLY}
              onChange={v => { set("GITHUB_READ_ONLY", v); if (v) { set("GITHUB_ENABLE_DANGEROUS_TOOLS", false); set("GITHUB_DESTRUCTIVE_CONFIRMATION", false); } }}
              hint="true = nenhuma mutação possível. Recomendado para primeiro deploy." tone={cfg.GITHUB_READ_ONLY ? "ok" : "warn"} />
            <WizField label="GITHUB_PROTECTED_BRANCHES" hint="Glob suportado (release/*). Escrita direta bloqueada nestes branches.">
              <input className="wiz-input mono" value={cfg.GITHUB_PROTECTED_BRANCHES} onChange={e => set("GITHUB_PROTECTED_BRANCHES", e.target.value)} />
            </WizField>
            <WizToggle label="GITHUB_ENABLE_DANGEROUS_TOOLS" value={cfg.GITHUB_ENABLE_DANGEROUS_TOOLS}
              onChange={v => { set("GITHUB_ENABLE_DANGEROUS_TOOLS", v); if (v && cfg.GITHUB_READ_ONLY) set("GITHUB_READ_ONLY", false); }}
              hint="Habilita pr_merge, git_create_*, pr_dismiss_review. Exige read_only=false."
              tone={cfg.GITHUB_ENABLE_DANGEROUS_TOOLS ? "warn" : "ok"} disabled={cfg.GITHUB_READ_ONLY} />
            <WizToggle label="GITHUB_ALLOW_WORKFLOW_DISPATCH" value={cfg.GITHUB_ALLOW_WORKFLOW_DISPATCH}
              onChange={v => set("GITHUB_ALLOW_WORKFLOW_DISPATCH", v)}
              hint="Habilita actions_run_workflow. Manter false como padrão." tone={cfg.GITHUB_ALLOW_WORKFLOW_DISPATCH ? "warn" : "ok"} />
            <WizToggle label="GITHUB_DESTRUCTIVE_CONFIRMATION" value={cfg.GITHUB_DESTRUCTIVE_CONFIRMATION}
              onChange={v => set("GITHUB_DESTRUCTIVE_CONFIRMATION", v)}
              hint='Emite valor CONFIRM_DESTRUCTIVE_OPERATION. Necessário para tools com confirm obrigatório.'
              tone={cfg.GITHUB_DESTRUCTIVE_CONFIRMATION ? "warn" : "ok"} />
          </WizSection>

          <WizSection title="03 · FastMCP — rede">
            <WizRow2>
              <WizField label="FASTMCP_HOST" hint=""><input className="wiz-input mono" value={cfg.FASTMCP_HOST} onChange={e => set("FASTMCP_HOST", e.target.value)} /></WizField>
              <WizField label="FASTMCP_PORT" hint=""><input className="wiz-input mono" value={cfg.FASTMCP_PORT} onChange={e => set("FASTMCP_PORT", e.target.value)} style={{ width: 90 }} /></WizField>
            </WizRow2>
            <WizToggle label="FASTMCP_ALLOW_REMOTE_HOSTS" value={cfg.FASTMCP_ALLOW_REMOTE_HOSTS}
              onChange={v => set("FASTMCP_ALLOW_REMOTE_HOSTS", v)}
              hint="Use só para validação por túnel. Para deploy fixo, use ALLOWED_HOSTS." tone={cfg.FASTMCP_ALLOW_REMOTE_HOSTS ? "warn" : "ok"} />
            <WizField label="FASTMCP_ALLOWED_HOSTS" hint="Ex: github-unified-mcp.onrender.com">
              <input className="wiz-input mono" value={cfg.FASTMCP_ALLOWED_HOSTS} onChange={e => set("FASTMCP_ALLOWED_HOSTS", e.target.value)} placeholder="vazio = qualquer host" />
            </WizField>
            <WizField label="FASTMCP_ALLOWED_ORIGINS" hint="Ex: https://chat.openai.com">
              <input className="wiz-input mono" value={cfg.FASTMCP_ALLOWED_ORIGINS} onChange={e => set("FASTMCP_ALLOWED_ORIGINS", e.target.value)} placeholder="vazio = qualquer origin" />
            </WizField>
          </WizSection>

          <WizSection title="04 · OAuth & rate limit">
            <WizField label="MCP_OAUTH_SIGNING_KEY" hint="openssl rand -hex 32 — mude para invalidar todos os tokens.">
              <input className="wiz-input mono" type="password" value={cfg.MCP_OAUTH_SIGNING_KEY} onChange={e => set("MCP_OAUTH_SIGNING_KEY", e.target.value)} />
            </WizField>
            <WizField label="MCP_OAUTH_ALLOWED_REDIRECT_URIS" hint="Glob suportado. Inclua ChatGPT e Claude callbacks.">
              <textarea className="wiz-input mono wiz-textarea" value={cfg.MCP_OAUTH_ALLOWED_REDIRECT_URIS} onChange={e => set("MCP_OAUTH_ALLOWED_REDIRECT_URIS", e.target.value)} rows={2} />
            </WizField>
            <WizToggle label="MCP_OAUTH_RATE_LIMIT_ENABLED" value={cfg.MCP_OAUTH_RATE_LIMIT_ENABLED}
              onChange={v => set("MCP_OAUTH_RATE_LIMIT_ENABLED", v)} hint="Desabilitar apenas em dev local." tone={cfg.MCP_OAUTH_RATE_LIMIT_ENABLED ? "ok" : "warn"} />
            <WizRow2>
              <WizField label="WINDOW_SECONDS" hint=""><input className="wiz-input mono" value={cfg.MCP_OAUTH_RATE_LIMIT_WINDOW_SECONDS} onChange={e => set("MCP_OAUTH_RATE_LIMIT_WINDOW_SECONDS", e.target.value)} style={{ width: 80 }} /></WizField>
              <WizField label="MAX_REQUESTS" hint=""><input className="wiz-input mono" value={cfg.MCP_OAUTH_RATE_LIMIT_MAX_REQUESTS} onChange={e => set("MCP_OAUTH_RATE_LIMIT_MAX_REQUESTS", e.target.value)} style={{ width: 80 }} /></WizField>
              <WizField label="TOKEN_TTL_SECONDS" hint=""><input className="wiz-input mono" value={cfg.MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS} onChange={e => set("MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS", e.target.value)} style={{ width: 100 }} /></WizField>
            </WizRow2>
          </WizSection>
        </div>

        <div className="ca-wizard-output">
          <div className="ca-wiz-out-h">
            <div>
              <div className="mono ca-wiz-out-title">.env</div>
              <div className="ca-wiz-out-sub">{warnings.length === 0 ? "sem conflitos detectados" : `${warnings.length} aviso${warnings.length > 1 ? "s" : ""} — revise antes de usar`}</div>
            </div>
            <button className="ca-wiz-copy" onClick={handleCopy}>{copied ? "✓ copiado" : "copy .env"}</button>
            <button className="ca-wiz-copy ca-wiz-download" onClick={handleDownload}>↓ .env</button>
          </div>
          <pre className="ca-wiz-pre mono">{envOutput}</pre>
          <div className="ca-wiz-deploy">
            <div className="ca-wiz-deploy-h mono">deploy no Render</div>
            <ol className="ca-wiz-deploy-steps">
              <li>Conecte o repo <span className="mono">github-unified-mcp</span> ao Render.</li>
              <li>Em <em>Environment</em>, cole as variáveis acima uma a uma (não o arquivo .env).</li>
              <li>Confirme que <span className="mono">GITHUB_READ_ONLY=true</span> no primeiro deploy.</li>
              <li>Após deploy, acesse <span className="mono">GET /healthz</span> e confirme <span className="mono">commit_sha</span>.</li>
              <li>Conecte o conector no ChatGPT e valide com <span className="mono">server_info</span>.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
