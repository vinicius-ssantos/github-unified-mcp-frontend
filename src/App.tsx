import { useState } from 'react';
import ConsoleA from './components/ConsoleA';

type Mode = 'read_only' | 'write_safe' | 'operator';
type Density = 'compact' | 'comfortable';
type Settings = { serverUrl: string; bearerToken: string; mode: Mode; density: Density; forceError: boolean; vercelToken: string };

const STORAGE_KEY = 'mcp-panel-settings';

function defaultSettings(): Settings {
  return { serverUrl: import.meta.env.VITE_MCP_URL || '', bearerToken: '', mode: 'read_only', density: 'compact', forceError: false, vercelToken: '' };
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch { /**/ }
  return defaultSettings();
}

function saveSettings(s: Settings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /**/ }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-dim,#888)' }}>{label}</label>
      {children}
      {hint && <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted,#555)' }}>{hint}</div>}
    </div>
  );
}

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<Settings>(settings);

  const applySettings = () => {
    setSettings(draft);
    saveSettings(draft);
    setSettingsOpen(false);
  };

  return (
    <>
      <ConsoleA
        mode={settings.mode}
        density={settings.density}
        forceError={settings.forceError}
        serverUrl={settings.serverUrl}
        bearerToken={settings.bearerToken}
        vercelToken={settings.vercelToken}
      />

      <button
        onClick={() => { setDraft(settings); setSettingsOpen(true); }}
        title="Configurações"
        style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 900, background: 'var(--surface-2,#1e1e1e)', border: '1px solid var(--border,#333)', borderRadius: 6, color: 'var(--text,#ccc)', padding: '6px 12px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12 }}
      >⚙ settings</button>

      {settingsOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSettingsOpen(false)}>
          <div style={{ background: 'var(--surface,#141414)', border: '1px solid var(--border,#333)', borderRadius: 8, padding: 24, minWidth: 360, maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 14 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'monospace', fontSize: 14, color: 'var(--text,#ccc)', marginBottom: 4 }}>configurações do painel</div>

            <Field label="URL do servidor" hint="Deixe vazio para modo demo">
              <input style={{ fontFamily: 'monospace', fontSize: 12, padding: '5px 8px', background: 'var(--surface-2,#1e1e1e)', border: '1px solid var(--border,#333)', borderRadius: 4, color: 'var(--text,#ccc)', width: '100%', boxSizing: 'border-box' }} value={draft.serverUrl} onChange={e => setDraft(d => ({ ...d, serverUrl: e.target.value }))} placeholder="https://github-unified-mcp.onrender.com" />
            </Field>

            <Field label="Bearer token" hint="Necessário quando MCP_AUTH_MODE=bearer">
              <input type="password" style={{ fontFamily: 'monospace', fontSize: 12, padding: '5px 8px', background: 'var(--surface-2,#1e1e1e)', border: '1px solid var(--border,#333)', borderRadius: 4, color: 'var(--text,#ccc)', width: '100%', boxSizing: 'border-box' }} value={draft.bearerToken} onChange={e => setDraft(d => ({ ...d, bearerToken: e.target.value }))} placeholder="mcp_..." />
            </Field>

            <Field label="Vercel token" hint="Opcional — para a aba Vercel ▲">
              <input type="password" style={{ fontFamily: 'monospace', fontSize: 12, padding: '5px 8px', background: 'var(--surface-2,#1e1e1e)', border: '1px solid var(--border,#333)', borderRadius: 4, color: 'var(--text,#ccc)', width: '100%', boxSizing: 'border-box' }} value={draft.vercelToken} onChange={e => setDraft(d => ({ ...d, vercelToken: e.target.value }))} placeholder="vercel_..." />
            </Field>

            <Field label="Postura (demo)">
              <div style={{ display: 'flex', gap: 6 }}>
                {(['read_only', 'write_safe', 'operator'] as Mode[]).map(m => (
                  <button key={m} onClick={() => setDraft(d => ({ ...d, mode: m }))}
                    style={{ fontFamily: 'monospace', fontSize: 11, padding: '4px 10px', border: '1px solid var(--border,#333)', borderRadius: 4, cursor: 'pointer', background: draft.mode === m ? 'var(--ok,#4caf50)' : 'transparent', color: draft.mode === m ? '#000' : 'var(--text,#ccc)' }}>
                    {m}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Densidade">
              <div style={{ display: 'flex', gap: 6 }}>
                {(['compact', 'comfortable'] as Density[]).map(d => (
                  <button key={d} onClick={() => setDraft(s => ({ ...s, density: d }))}
                    style={{ fontFamily: 'monospace', fontSize: 11, padding: '4px 10px', border: '1px solid var(--border,#333)', borderRadius: 4, cursor: 'pointer', background: draft.density === d ? 'var(--info,#4a90e2)' : 'transparent', color: draft.density === d ? '#000' : 'var(--text,#ccc)' }}>
                    {d}
                  </button>
                ))}
              </div>
            </Field>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'monospace', fontSize: 12, color: 'var(--text,#ccc)', cursor: 'pointer' }}>
              <input type="checkbox" checked={draft.forceError} onChange={e => setDraft(d => ({ ...d, forceError: e.target.checked }))} />
              simular incidente (healthz 503)
            </label>

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={applySettings} style={{ fontFamily: 'monospace', fontSize: 12, padding: '6px 18px', border: 'none', borderRadius: 4, background: 'var(--ok,#4caf50)', color: '#000', cursor: 'pointer' }}>aplicar</button>
              <button onClick={() => setSettingsOpen(false)} style={{ fontFamily: 'monospace', fontSize: 12, padding: '6px 18px', border: '1px solid var(--border,#333)', borderRadius: 4, background: 'transparent', color: 'var(--text,#ccc)', cursor: 'pointer' }}>cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
