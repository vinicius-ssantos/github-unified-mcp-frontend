# GitHub Unified MCP Frontend

Frontend console for `github-unified-mcp`.

## Current state

This repository now contains two tracks:

1. `Painel MCP.html` and the original imported prototype scaffold.
2. A new Vite + React + TypeScript app under `src/`.

The Vite app is the preferred path forward. The original prototype remains as visual/product reference.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The build script runs TypeScript project build before Vite production build.

## Architecture

- `src/adapters/mockAdapter.ts` provides offline demo data.
- `src/adapters/liveMcpAdapter.ts` reads `server_info` from an MCP endpoint.
- `src/types/mcp.ts` contains shared frontend contracts.
- Destructive/write operations must not be executed directly from the browser; they should go through a backend BFF with server-side confirmation and audit.

## Original prototype files

Imported from the initial zip:

- `Painel MCP.html`
- `data/schemas.jsx`
- `data/server-state.jsx`
- `data/tools.jsx`
- `screens/direction-a-drawer.jsx`
- `screens/direction-b.jsx`

Still pending to port or reimplement from the original prototype:

- `styles.css`
- `tweaks-panel.jsx`
- `screens/direction-a.jsx`
- `screens/direction-a-wizard.jsx`
- `design-canvas.jsx`
