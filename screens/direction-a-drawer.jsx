// Drawer + shortcut handling extension to direction A.

function guardChain(tool, state) {
  const chain = [
    { step: "01", name: "Allowlist de repositórios", pass: state.server_info.require_allowed_repos, note: "GITHUB_REQUIRE_ALLOWED_REPOS=true" },
    { step: "02", name: "OAuth válido", pass: true, note: "Bearer token assinado e dentro do TTL" },
    { step: "03", name: "Rate limit OAuth", pass: true, note: "30 req/60s por IP" },
    { step: "04", name: "Read-only check", pass: !(state.server_info.read_only && tool.risk !== "low"), note: state.server_info.read_only ? "GITHUB_READ_ONLY=true bloqueia mutações" : "GITHUB_READ_ONLY=false" },
    { step: "05", name: "Branches protegidas", pass: true, note: "main, master, develop, release/* — verificado por chamada" },
    { step: "06", name: "Dangerous tools", pass: !(tool.requiresDangerous && !state.server_info.dangerous_tools_enabled), note: tool.requiresDangerous ? "Exige GITHUB_ENABLE_DANGEROUS_TOOLS=true" : "Não classificada como destrutiva" },
    { step: "07", name: "Workflow dispatch", pass: !(tool.requiresWorkflowDispatch && !state.server_info.workflow_dispatch_enabled), note: tool.requiresWorkflowDispatch ? "Exige GITHUB_ALLOW_WORKFLOW_DISPATCH=true" : "Não aplica" },
    { step: "08", name: "Confirm destrutivo", pass: !tool.requiresConfirm, note: tool.requiresConfirm ? 'confirm="CONFIRM_DESTRUCTIVE_OPERATION" obrigatório' : "Não exigido" },
    { step: "09", name: "Injection detect", pass: true, note: "Padrões verificados em respostas GET" },
    { step: "10", name: "Audit log", pass: true, note: "Decisão registrada em logs estruturados" },
  ];
  return chain;
}

function ToolDrawer({ tool, mode, onClose, onPlayground }) {
  if (!tool) return null;
  const state = window.SERVER_STATES[mode];
  const schema = window.getSchema(tool.name);
  const chain = guardChain(tool, state);
  const blocked = chain.find(c => !c.pass);
  const r = window.RISK_TONE_A?.[tool.risk] || { label: tool.risk, fg: "var(--ok)" };

  const mcpCall = JSON.stringify(schema.example, null, 2);
  const curlCall = `curl -X POST $MCP_URL/mcp \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: schema.example })}'`;

  const copy = (text) => navigator.clipboard?.writeText(text);

  return (
    <div className="ca-drawer-backdrop" onClick={onClose}>
      <aside className="ca-drawer" onClick={e => e.stopPropagation()}>
        <header className="ca-drawer-h">
          <div>
            <div className="ca-drawer-eyebrow mono">tool · fase {tool.phase}</div>
            <h2 className="ca-drawer-title mono">{tool.name}</h2>
            <div className="ca-drawer-summary">{tool.summary}</div>
          </div>
          <div className="ca-drawer-h-r">
            <span className="ca-risk" style={{
              background: tool.risk === "low" ? "rgba(120,200,160,0.14)" : tool.risk === "medium" ? "rgba(220,180,100,0.14)" : "rgba(230,120,110,0.14)",
              color: tool.risk === "low" ? "var(--ok)" : tool.risk === "medium" ? "var(--warn)" : "var(--danger)",
              borderColor: tool.risk === "low" ? "rgba(120,200,160,0.30)" : tool.risk === "medium" ? "rgba(220,180,100,0.30)" : "rgba(230,120,110,0.30)",
            }}>{tool.risk === "medium" ? "med" : tool.risk}</span>
            {tool.risk === "low" && onPlayground && (
              <button
                className="ca-copy"
                style={{ color: "var(--ok)", borderColor: "color-mix(in oklch, var(--ok) 35%, transparent)", padding: "4px 10px", fontSize: 11 }}
                onClick={() => onPlayground(tool.name)}
                title="Abrir no Playground"
              >▶ playground</button>
            )}
            <button className="ca-drawer-close" onClick={onClose} aria-label="Fechar">×</button>
          </div>
        </header>

        <div className="ca-drawer-body">
          <section className="ca-drawer-sec">
            <div className="ca-drawer-sec-h">
              <span className="mono">guard chain</span>
              {blocked
                ? <span className="ca-drawer-sec-meta ca-drawer-blocked mono">blocked at {blocked.step}</span>
                : <span className="ca-drawer-sec-meta ca-drawer-ok mono">all pass under {state.label.toLowerCase()}</span>}
            </div>
            <ol className="ca-chain">
              {chain.map(c => (
                <li key={c.step} className={`ca-chain-item ${c.pass ? "is-pass" : "is-fail"}`}>
                  <span className="ca-chain-step mono">{c.step}</span>
                  <span className="ca-chain-icon mono">{c.pass ? "✓" : "×"}</span>
                  <span className="ca-chain-name">{c.name}</span>
                  <span className="ca-chain-note mono">{c.note}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="ca-drawer-sec">
            <div className="ca-drawer-sec-h"><span className="mono">inputs</span></div>
            {schema.inputs.length === 0
              ? <div className="ca-drawer-empty mono">— sem parâmetros —</div>
              : (
                <table className="ca-schema-table">
                  <thead><tr><th>name</th><th>type</th><th>req</th><th>note</th></tr></thead>
                  <tbody>
                    {schema.inputs.map(i => (
                      <tr key={i.name}>
                        <td className="mono">{i.name}</td>
                        <td className="mono">{i.type}</td>
                        <td className="mono">{i.required ? "yes" : "no"}</td>
                        <td className="mono ca-schema-note">{i.note || i.default || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            <div className="ca-drawer-returns mono"><span className="ca-drawer-returns-k">returns</span> {schema.returns}</div>
          </section>

          <section className="ca-drawer-sec">
            <div className="ca-drawer-sec-h">
              <span className="mono">MCP call</span>
              <button className="ca-copy" onClick={() => copy(mcpCall)}>copy</button>
            </div>
            <pre className="ca-codeblock mono">{mcpCall}</pre>
          </section>

          <section className="ca-drawer-sec">
            <div className="ca-drawer-sec-h">
              <span className="mono">cURL</span>
              <button className="ca-copy" onClick={() => copy(curlCall)}>copy</button>
            </div>
            <pre className="ca-codeblock mono">{curlCall}</pre>
          </section>
        </div>
      </aside>
    </div>
  );
}

window.ToolDrawer = ToolDrawer;
window.RISK_TONE_A = {
  low: { label: "low" },
  medium: { label: "med" },
  high: { label: "high" },
};
