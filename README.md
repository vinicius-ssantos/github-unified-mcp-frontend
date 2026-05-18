# GitHub Unified MCP Frontend

Operator console for observing, debugging, and safely operating `github-unified-mcp`.

This repository is **not** a replacement for GitHub's own UI and it is **not** intended to be a generic MCP Inspector clone. Its role is to provide a project-specific admin/developer console for the GitHub Unified MCP server: health, runtime posture, tool discovery, security/audit visibility, PR readiness, and eventually controlled operations through a backend gate.

## Product identity

Think of this project as:

```text
Swagger UI for the MCP server contract
+ Portainer-style operator console
+ PR/security cockpit for github-unified-mcp
```

The MCP Inspector remains the best generic developer tool for testing and debugging MCP servers. This frontend should add value by understanding the `github-unified-mcp` domain: GitHub tools, risk levels, allowlists, protected branches, CI gates, audit events, schema drift, and safe operator workflows.

## What this frontend is

- A developer/operator admin panel.
- A read-first console for MCP runtime health and tool discovery.
- A project-specific view over GitHub Unified MCP configuration and safety posture.
- A UI for debugging which tools are registered, which schemas are exposed, and how the runtime is configured.
- A future home for PR readiness, CI/audit dashboards, and controlled operation previews.

## What this frontend is not

- It is not a user-facing GitHub client.
- It is not a replacement for github.com.
- It is not a generic MCP Inspector clone.
- It should not execute destructive/write operations directly from the browser.
- It should not store GitHub tokens, MCP secrets, or destructive confirmation tokens in frontend code.

## Safety model

The first production-grade version should remain read-only from the browser.

Allowed early browser-side capabilities:

- Runtime health/status reads.
- Tool catalog reads.
- Schema inspection.
- Read-only tool playground calls.
- CI/risk/readiness reads.

Blocked until there is a backend/BFF:

- `pr_merge`
- `git_update_ref`
- `file_create_or_update`
- `file_apply_patch`
- `actions_run_workflow`
- any write/destructive tool
- any operation requiring privileged tokens or destructive confirmation

Target architecture for controlled operations:

```text
React / Vite frontend
  -> Python/FastAPI admin BFF
      -> github-unified-mcp
      -> GitHub API
```

The BFF should own session handling, RBAC, CSRF protection, rate limiting, confirmation gates, audit logging, and policy enforcement.

## Roadmap

### Phase 0 — Quality foundation

Status: mostly implemented.

- Vite + React + TypeScript scaffold.
- GitHub Actions CI.
- Playwright multi-browser UI smoke tests.
- Visual regression infrastructure.
- Visual baseline PR flow.

Next step:

- Merge the visual baseline PNGs.
- Make `npm run test:visual` a required CI gate.

### Phase 1 — Health + runtime posture

Goal: answer "is this MCP server running the version and posture I expect?"

Planned UI:

- `/healthz` status
- `server_info`
- `version`
- `tool_schema_version`
- `commit_sha`
- `uptime`
- `tool_count`
- `read_only`
- `dangerous_tools_enabled`
- `workflow_dispatch_enabled`
- allowed repos status
- protected branches status
- OAuth/rate-limit safety flags

Acceptance criteria:

- Works in mock mode without a live MCP server.
- Works in live mode against a configured MCP URL.
- Clearly shows runtime mode: `read_only`, `write_safe`, or `operator`.
- Shows degraded/error states without crashing the UI.

### Phase 2 — Tool discovery

Goal: make the registered MCP tools understandable and searchable.

Planned UI:

- real tool list from runtime
- grouping by domain/phase
- search
- risk filter: `low`, `medium`, `high`
- badges for:
  - read-only
  - write-safe
  - destructive
  - requires confirmation
  - requires dangerous tools
  - requires workflow dispatch
- schema/input parameter viewer
- example payloads
- copyable MCP call/cURL snippets

Acceptance criteria:

- No hardcoded catalog as source of truth in live mode.
- New/unknown tools are visible instead of hidden.
- Missing expected tools are flagged as schema drift.
- Tool risk metadata is visible before any playground execution.

### Phase 3 — Read-only tool playground

Goal: allow safe exploratory calls from the console.

Allowed first tools:

- `server_info`
- `github_get_me`
- `repo_get`
- `repo_tree`
- `file_get`
- `pr_get`
- `pr_list`
- `actions_list_runs`
- `actions_get_run`
- `ci_gate_check`
- `pr_ready_to_merge`
- `pr_risk_review`

Planned UI:

- form generated from tool schema
- execution result viewer
- session history
- copy request/response
- clear warning when a tool is blocked by policy

Acceptance criteria:

- Only read-only tools are executable from the browser.
- Write/destructive tools render as disabled with explanation.
- No secrets are stored in localStorage/sessionStorage.
- Tool errors are displayed in a debuggable but redacted way.

### Phase 4 — Observability and audit

Goal: make MCP operations observable.

Planned UI:

- audit event stream
- denied operations
- actor/tool/repo/branch filters
- risk level filter
- injection-risk events
- CI gate blocked events
- destructive confirmation failures
- rate-limit or OAuth-related events

Acceptance criteria:

- Audit data is redacted.
- Tokens, secrets, connection strings, and credentials are never displayed.
- Empty audit backend is represented clearly.
- Filtering works for repo, tool, actor, and decision.

### Phase 5 — PR readiness cockpit

Goal: provide an operator-focused view that GitHub's generic PR page does not provide.

Planned UI:

- `pr_ready_to_merge`
- `ci_gate_check`
- `pr_risk_review`
- changed files summary
- mergeable state
- blockers
- recommendation
- expected head SHA
- required confirmations
- visual CI status where applicable

Acceptance criteria:

- Shows "ready / blocked / needs review" clearly.
- Does not merge PRs directly in the browser.
- Links back to the GitHub PR for human review.
- Makes risk and CI blockers more explicit than the default GitHub UI.

### Phase 6 — Controlled operations via BFF

Goal: enable safe operations only after server-side gates exist.

Possible operations:

- create issue
- create PR
- request reviewers
- run selected workflows
- merge PR

Required flow:

```text
preview
  -> risk review
  -> explicit confirmation
  -> server-side execution
  -> audit event
```

Acceptance criteria:

- All writes go through backend/BFF.
- Browser never receives GitHub tokens.
- Destructive operations require explicit confirmation.
- Every operation produces an audit event.
- Policy failures are visible and actionable.

## Development

```bash
npm install
npm run dev
```

Create a local `.env` from `.env.example` and set:

```bash
VITE_RUNTIME_MODE=development
VITE_MCP_URL=/
VITE_MCP_PROXY_TARGET=https://github-unified-mcp.onrender.com
```

In local dev (`npm run dev`), Vite proxies `/mcp` to `VITE_MCP_PROXY_TARGET` to avoid browser CORS issues.

For production, the frontend must run in BFF-only mode:

```bash
VITE_RUNTIME_MODE=production
VITE_MCP_URL=https://<github-unified-mcp-bff>.onrender.com
```

Do not put MCP, GitHub, or Vercel tokens in frontend environment variables. Production credentials belong in the BFF. The browser-side settings panel does not persist bearer or Vercel tokens.

Live tool execution should use the BFF structured endpoint:

```http
POST /api/mcp/call
Content-Type: application/json

{ "name": "server_info", "arguments": {} }
```

The raw `/mcp` JSON-RPC endpoint is reserved for dev/debug or lower-level runtime methods until the BFF capabilities/tool-policy contract is complete.

## Build

```bash
npm run build
```

The build script runs TypeScript project build before Vite production build.

## UI tests

```bash
npm run test:ui
```

The UI smoke suite runs against Chromium, Firefox, WebKit, and a mobile Chrome viewport in CI.

## Visual regression

Generate visual baselines with:

```bash
npm run test:visual:update
```

Validate existing baselines with:

```bash
npm run test:visual
```

Visual tests are based on Playwright screenshot assertions. Browser rendering can vary by OS, fonts, hardware, headless mode, and browser engine, so baselines should be generated and compared in a consistent CI environment.

Current staged flow:

1. Generate baselines through the **Generate Visual Baselines** workflow.
2. Review the generated PNGs in the baseline PR.
3. Merge baseline PNGs.
4. Enable `npm run test:visual` as a required CI gate.

## Architecture

- `src/adapters/mockAdapter.ts` provides offline demo data.
- `src/adapters/liveMcpAdapter.ts` reads runtime data from a configured MCP endpoint.
- `src/types/mcp.ts` contains frontend contracts.
- Browser-side code must stay read-only until there is a backend/BFF for privileged operations.

## Original prototype files

Imported from the initial prototype zip:

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

## Design principle

If a feature does not help an operator understand, debug, or safely operate `github-unified-mcp`, it probably does not belong here.
