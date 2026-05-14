// Mocked server_info / healthz responses, reflecting README schema.

const SERVER_STATES = {
  read_only: {
    label: "Read-only",
    healthz: {
      ok: true,
      service: "github-unified-mcp",
      version: "1.31.1",
      tool_schema_version: "2026-05-14.1",
      commit_sha: "bb13cea",
      uptime_seconds: 184_223,
    },
    server_info: {
      read_only: true,
      dangerous_tools_enabled: false,
      workflow_dispatch_enabled: false,
      require_allowed_repos: true,
      protected_branches_configured: true,
      oauth_redirect_allowlist_configured: true,
      classic_pat_for_projects_configured: true,
      allowed_repos_configured: true,
      tool_catalog_refresh_supported: true,
      oauth_rate_limit_enabled: true,
    },
    posture: "safe",
  },
  write_safe: {
    label: "Write-safe pessoal",
    healthz: {
      ok: true,
      service: "github-unified-mcp",
      version: "1.31.1",
      tool_schema_version: "2026-05-14.1",
      commit_sha: "bb13cea",
      uptime_seconds: 184_223,
    },
    server_info: {
      read_only: false,
      dangerous_tools_enabled: false,
      workflow_dispatch_enabled: false,
      require_allowed_repos: true,
      protected_branches_configured: true,
      oauth_redirect_allowlist_configured: true,
      classic_pat_for_projects_configured: true,
      allowed_repos_configured: true,
      tool_catalog_refresh_supported: true,
      oauth_rate_limit_enabled: true,
    },
    posture: "balanced",
  },
  operator: {
    label: "Operador",
    healthz: {
      ok: true,
      service: "github-unified-mcp",
      version: "1.31.1",
      tool_schema_version: "2026-05-14.1",
      commit_sha: "bb13cea",
      uptime_seconds: 184_223,
    },
    server_info: {
      read_only: false,
      dangerous_tools_enabled: true,
      workflow_dispatch_enabled: false,
      require_allowed_repos: true,
      protected_branches_configured: true,
      oauth_redirect_allowlist_configured: true,
      classic_pat_for_projects_configured: true,
      allowed_repos_configured: true,
      tool_catalog_refresh_supported: true,
      oauth_rate_limit_enabled: true,
    },
    posture: "elevated",
  },
};

const ENV_CONFIG = {
  GITHUB_ALLOWED_REPOS: ["vinicius-ssantos/github-unified-mcp", "vinicius-ssantos/jobHunterAgent"],
  GITHUB_PROTECTED_BRANCHES: ["main", "master", "develop", "release/*", "prod", "staging"],
  GITHUB_DESTRUCTIVE_CONFIRMATION: "CONFIRM_DESTRUCTIVE_OPERATION",
  FASTMCP_PORT: 8765,
  FASTMCP_ALLOWED_HOSTS: ["github-unified-mcp.onrender.com"],
  FASTMCP_ALLOWED_ORIGINS: ["https://chat.openai.com", "https://github-unified-mcp.onrender.com"],
  MCP_OAUTH_RATE_LIMIT_WINDOW_SECONDS: 60,
  MCP_OAUTH_RATE_LIMIT_MAX_REQUESTS: 30,
  MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS: 2_592_000,
};

const AUDIT_EVENTS = [
  { ts: "2026-05-14 23:06:03", actor: "claude-mcp", tool: "ref_get", target: "github-unified-mcp@main", decision: "allowed", level: "info" },
  { ts: "2026-05-14 22:52:08", actor: "claude-mcp", tool: "file_patch_preview", target: "github-unified-mcp@feat/fix", decision: "allowed", level: "info" },
  { ts: "2026-05-14 22:36:16", actor: "claude-mcp", tool: "branch_create", target: "github-unified-mcp@feat/vercel-deploy-tab", decision: "allowed", level: "info" },
  { ts: "2026-05-14 22:35:51", actor: "claude-mcp", tool: "file_apply_patch", target: "github-unified-mcp@feat/vercel-deploy-tab", decision: "allowed", level: "info" },
  { ts: "2026-05-14 22:35:21", actor: "claude-mcp", tool: "file_create_or_update", target: "github-unified-mcp@feat/vercel-deploy-tab", decision: "allowed", level: "info" },
  { ts: "2026-05-14 14:22:11", actor: "chatgpt-connector", tool: "pr_get", target: "github-unified-mcp#142", decision: "allowed", level: "info" },
  { ts: "2026-05-14 14:21:47", actor: "claude-mcp", tool: "pr_merge", target: "github-unified-mcp#138", decision: "blocked", level: "warn", reason: "dangerous_tools_disabled" },
  { ts: "2026-05-14 14:11:08", actor: "inspector-local", tool: "actions_run_workflow", target: "ci.yml", decision: "blocked", level: "warn", reason: "workflow_dispatch_disabled" },
  { ts: "2026-05-14 13:54:02", actor: "unknown-ip", tool: "/oauth/token", target: "—", decision: "rate_limited", level: "warn", reason: "rate_limit_exceeded" },
  { ts: "2026-05-14 13:50:14", actor: "claude-mcp", tool: "git_update_ref", target: "main", decision: "blocked", level: "error", reason: "protected_branch" },
];

const RATE_LIMITS = [
  { endpoint: "/oauth/register", used: 4, max: 30, window: 60 },
  { endpoint: "/oauth/authorize", used: 12, max: 30, window: 60 },
  { endpoint: "/oauth/token", used: 27, max: 30, window: 60 },
  { endpoint: "GitHub REST", used: 1247, max: 5000, window: 3600 },
  { endpoint: "GitHub GraphQL", used: 312, max: 5000, window: 3600 },
];

window.SERVER_STATES = SERVER_STATES;
window.ENV_CONFIG = ENV_CONFIG;
window.AUDIT_EVENTS = AUDIT_EVENTS;
window.RATE_LIMITS = RATE_LIMITS;
