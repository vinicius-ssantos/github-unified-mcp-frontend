// Mocked server_info / healthz responses, reflecting README schema.

const SERVER_STATES = {
  read_only: {
    label: "Read-only",
    healthz: {
      ok: true,
      service: "github-unified-mcp",
      version: "0.1.0",
      tool_schema_version: "2026-05-02.1",
      commit_sha: "7ff00f7",
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
      version: "0.1.0",
      tool_schema_version: "2026-05-02.1",
      commit_sha: "7ff00f7",
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
      version: "0.1.0",
      tool_schema_version: "2026-05-02.1",
      commit_sha: "7ff00f7",
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

// Dynamic timestamps relative to now so the timeline chart always has data
const _nowMs = Date.now();
const _ago = (h, m, s = 0) => {
  const d = new Date(_nowMs - h * 3600000 - m * 60000 - s * 1000);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
};

const AUDIT_EVENTS = [
  { ts: _ago(0,2,11),   actor:"chatgpt-connector", tool:"pr_get",              target:"github-unified-mcp#142",            decision:"allowed",      level:"info"  },
  { ts: _ago(0,2,9),    actor:"chatgpt-connector", tool:"repo_tree",            target:"github-unified-mcp@main",           decision:"allowed",      level:"info"  },
  { ts: _ago(0,3,47),   actor:"claude-mcp",        tool:"pr_merge",             target:"github-unified-mcp#138",            decision:"blocked",      level:"warn",  reason:"dangerous_tools_disabled"  },
  { ts: _ago(0,6,2),    actor:"chatgpt-connector", tool:"file_apply_patch",     target:"github-unified-mcp@feat/policy-43", decision:"allowed",      level:"info"  },
  { ts: _ago(0,7,33),   actor:"chatgpt-connector", tool:"branch_create",        target:"github-unified-mcp@feat/policy-43", decision:"allowed",      level:"info"  },
  { ts: _ago(0,13,8),   actor:"inspector-local",   tool:"actions_run_workflow", target:"ci.yml",                            decision:"blocked",      level:"warn",  reason:"workflow_dispatch_disabled" },
  { ts: _ago(0,21,5),   actor:"chatgpt-connector", tool:"issue_comment",        target:"github-unified-mcp#65",             decision:"allowed",      level:"info"  },
  { ts: _ago(0,25,39),  actor:"chatgpt-connector", tool:"pr_get_diff",          target:"github-unified-mcp#142",            decision:"allowed",      level:"info"  },
  { ts: _ago(0,30,58),  actor:"unknown-ip",        tool:"/oauth/token",         target:"—",                                 decision:"rate_limited",  level:"warn",  reason:"rate_limit_exceeded"       },
  { ts: _ago(0,34,46),  actor:"claude-mcp",        tool:"git_update_ref",       target:"main",                              decision:"blocked",      level:"error", reason:"protected_branch"           },
  { ts: _ago(1,5,12),   actor:"chatgpt-connector", tool:"repo_get",             target:"github-unified-mcp",                decision:"allowed",      level:"info"  },
  { ts: _ago(1,22,44),  actor:"claude-mcp",        tool:"pr_risk_review",       target:"github-unified-mcp#137",            decision:"allowed",      level:"info"  },
  { ts: _ago(2,8,0),    actor:"inspector-local",   tool:"server_info",          target:"—",                                 decision:"allowed",      level:"info"  },
  { ts: _ago(2,45,33),  actor:"chatgpt-connector", tool:"pr_create",            target:"github-unified-mcp",                decision:"allowed",      level:"info"  },
  { ts: _ago(3,12,7),   actor:"claude-mcp",        tool:"pr_merge",             target:"github-unified-mcp#136",            decision:"blocked",      level:"warn",  reason:"dangerous_tools_disabled"  },
  { ts: _ago(4,0,22),   actor:"chatgpt-connector", tool:"actions_list_runs",    target:"ci.yml",                            decision:"allowed",      level:"info"  },
  { ts: _ago(4,44,10),  actor:"inspector-local",   tool:"pr_list",              target:"github-unified-mcp",                decision:"allowed",      level:"info"  },
  { ts: _ago(5,33,11),  actor:"inspector-local",   tool:"file_get",             target:"github-unified-mcp@main/README.md", decision:"allowed",      level:"info"  },
  { ts: _ago(6,14,55),  actor:"chatgpt-connector", tool:"issue_list",           target:"github-unified-mcp",                decision:"allowed",      level:"info"  },
  { ts: _ago(7,28,3),   actor:"unknown-ip",        tool:"/oauth/register",      target:"—",                                 decision:"rate_limited",  level:"warn",  reason:"rate_limit_exceeded"       },
  { ts: _ago(8,5,17),   actor:"claude-mcp",        tool:"git_create_commit",    target:"github-unified-mcp",                decision:"blocked",      level:"error", reason:"dangerous_tools_disabled"  },
  { ts: _ago(9,41,9),   actor:"chatgpt-connector", tool:"pr_list",              target:"github-unified-mcp",                decision:"allowed",      level:"info"  },
  { ts: _ago(10,18,33), actor:"chatgpt-connector", tool:"compare_commits",      target:"github-unified-mcp@main",           decision:"allowed",      level:"info"  },
  { ts: _ago(11,0,0),   actor:"inspector-local",   tool:"github_get_me",        target:"—",                                 decision:"allowed",      level:"info"  },
  { ts: _ago(13,15,30), actor:"chatgpt-connector", tool:"repo_tree",            target:"github-unified-mcp@develop",        decision:"allowed",      level:"info"  },
  { ts: _ago(15,22,8),  actor:"claude-mcp",        tool:"actions_run_workflow", target:"deploy.yml",                        decision:"blocked",      level:"warn",  reason:"workflow_dispatch_disabled" },
  { ts: _ago(17,8,44),  actor:"chatgpt-connector", tool:"pr_get",               target:"github-unified-mcp#134",            decision:"allowed",      level:"info"  },
  { ts: _ago(18,50,5),  actor:"claude-mcp",        tool:"git_update_ref",       target:"develop",                           decision:"blocked",      level:"error", reason:"protected_branch"           },
  { ts: _ago(20,33,5),  actor:"inspector-local",   tool:"stack_detect",         target:"github-unified-mcp",                decision:"allowed",      level:"info"  },
  { ts: _ago(21,17,44), actor:"chatgpt-connector", tool:"actions_get_run",      target:"github-unified-mcp#run-9001",       decision:"allowed",      level:"info"  },
  { ts: _ago(22,0,0),   actor:"chatgpt-connector", tool:"issue_create",         target:"github-unified-mcp",                decision:"allowed",      level:"info"  },
  { ts: _ago(23,45,12), actor:"claude-mcp",        tool:"branch_create",        target:"github-unified-mcp@feat/auth",      decision:"allowed",      level:"info"  },
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
