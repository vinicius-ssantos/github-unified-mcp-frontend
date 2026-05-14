type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

const COLORS: Record<Tone, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  info: 'var(--info)',
  muted: 'var(--text-dim)',
};

export default function StatusDot({ tone = 'ok' }: { tone?: Tone }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: COLORS[tone] ?? COLORS.muted,
    }} />
  );
}
