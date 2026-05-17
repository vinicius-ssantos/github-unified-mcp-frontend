import { useState, useEffect } from 'react';
import ConsoleA from './components/ConsoleA';

type Mode = 'read_only' | 'write_safe' | 'operator';
type Density = 'compact' | 'comfortable';
type Theme = 'dark' | 'light';
type Settings = { serverUrl: string; bearerToken: string; mode: Mode; density: Density; forceError: boolean; vercelToken: string; theme: Theme };
type RuntimeMode = 'development' | 'production';

const STORAGE_KEY = 'mcp-panel-settings';
const RUNTIME_MODE = ((import.meta.env.VITE_RUNTIME_MODE as string | undefined) || (import.meta.env.PROD ? 'production' : 'development')) as RuntimeMode;
const IS_PRODUCTION_RUNTIME = RUNTIME_MODE === 'production';

function defaultSettings(): Settings {
  return { serverUrl: import.meta.env.VITE_MCP_URL || '', bearerToken: '', mode: 'read_only', density: 'compact', forceError: false, vercelToken: '', theme: 'dark' };
}

function stripSensitiveSettings(s: Settings): Settings {
  return { ...s, bearerToken: '', vercelToken: '' };
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const loaded = { ...defaultSettings(), ...JSON.parse(raw) };
      const safe = stripSensitiveSettings(loaded);
      if (loaded.bearerToken || loaded.vercelToken) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
      }
      return safe;
    }
  } catch { /**/ }
  return defaultSettings();
}

function saveSettings(s: Settings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stripSensitiveSettings(s))); } catch { /**/ }
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

const LIGHT_VARS = `
  --bg: oklch(0.97 0.002 240);
  --surface: oklch(0.94 0.004 240);
  --surface-2: oklch(0.90 0.005 240);
  --border: oklch(0.82 0.008 240);
  --border-strong: oklch(0.70 0.012 240);
  --text: oklch(0.18 0.008 240);
  --text-dim: oklch(0.38 0.01 240);
  --text-muted: oklch(0.52 0.012 240);
`;

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<Settings>(settings);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'light') {
      root.setAttribute('style', LIGHT_VARS);
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('style');
      root.removeAttribute('data-theme');
    }
  }, [settings.theme]);

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
        bearerToken={IS_PRODUCTION_RUNTIME ? '' : settings.bearerToken}
        vercelToken={IS_PRODUCTION_RUNTIME ? '' : settings.vercelToken}
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

            <Field label="URL do servidor" hint={IS_PRODUCTION_RUNTIME ? "URL do BFF em produção; deixe vazio apenas para demo local" : "Deixe vazio para modo demo"}>
              <input style={{ fontFamily: 'monospace', fontSize: 12, padding: '5px 8px', background: 'var(--surface-2,#1e1e1e)', border: '1px solid var(--border,#333)', borderRadius: 4, color: 'var(--text,#ccc)', width: '100%', boxSizing: 'border-box' }} value={draft.serverUrl} onChange={e => setDraft(d => ({ ...d, serverUrl: e.target.value }))} placeholder="https://github-unified-mcp-bff.onrender.com" />
            </Field>

            <div style={{ fontFamily: 'monospace', fontSize: 11, color: IS_PRODUCTION_RUNTIME ? 'var(--ok,#4caf50)' : 'var(--warn,#f0b429)', border: '1px solid var(--border,#333)', borderRadius: 4, padding: '7px 8px', background: 'var(--surface-2,#1e1e1e)' }}>
              runtime: {RUNTIME_MODE} · {IS_PRODUCTION_RUNTIME ? 'tokens desabilitados no browser; use o BFF' : 'tokens de dev ficam apenas em memória e não são persistidos'}
            </div>

            {!IS_PRODUCTION_RUNTIME && (
              <>
                <Field label="Bearer token (dev only)" hint="Opcional em dev. Mantido apenas em memória; nunca salvo no localStorage.">
                  <input type="password" style={{ fontFamily: 'monospace', fontSize: 12, padding: '5px 8px', background: 'var(--surface-2,#1e1e1e)', border: '1px solid var(--border,#333)', borderRadius: 4, color: 'var(--text,#ccc)', width: '100%', boxSizing: 'border-box' }} value={draft.bearerToken} onChange={e => setDraft(d => ({ ...d, bearerToken: e.target.value }))} placeholder="mcp_..." />
                </Field>

                <Field label="Vercel token (dev only)" hint="Opcional em dev. Mantido apenas em memória; use BFF para produção.">
                  <input type="password" style={{ fontFamily: 'monospace', fontSize: 12, padding: '5px 8px', background: 'var(--surface-2,#1e1e1e)', border: '1px solid var(--border,#333)', borderRadius: 4, color: 'var(--text,#ccc)', width: '100%', boxSizing: 'border-box' }} value={draft.vercelToken} onChange={e => setDraft(d => ({ ...d, vercelToken: e.target.value }))} placeholder="vercel_..." />
                </Field>
              </>
            )}

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

            <Field label="Tema">
              <div style={{ display: 'flex', gap: 6 }}>
                {(['dark', 'light'] as Theme[]).map(t => (
                  <button key={t} onClick={() => setDraft(d => ({ ...d, theme: t }))}
                    style={{ fontFamily: 'monospace', fontSize: 11, padding: '4px 10px', border: '1px solid var(--border,#333)', borderRadius: 4, cursor: 'pointer', background: draft.theme === t ? 'var(--info,#4a90e2)' : 'transparent', color: draft.theme === t ? '#000' : 'var(--text,#ccc)' }}>
                    {t === 'dark' ? '◑ dark' : '◐ light'}
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
