# GitHub Unified MCP Frontend

Prototype frontend console for `github-unified-mcp`.

## Current state

This repository currently contains the standalone design prototype exported from the original zip.

Open `Painel MCP.html` locally to view the prototype.

## Structure

- `Painel MCP.html` — standalone prototype entrypoint
- `styles.css` — shared styling
- `data/` — mocked server/tool/schema data
- `screens/` — React JSX screen prototypes
- `design-canvas.jsx` and `tweaks-panel.jsx` — design exploration helpers

## Next direction

Recommended migration path:

1. Port the prototype to Vite + React + TypeScript.
2. Split live and mock data into adapters.
3. Add a Python/FastAPI admin BFF in the main MCP project.
4. Consume real `/healthz`, `server_info`, and tool catalog data.
5. Keep destructive/write operations behind server-side confirmation and audit gates.
