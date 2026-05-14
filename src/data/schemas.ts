import type { ToolSchema } from '../types/mcp';

const TOOL_SCHEMAS: Record<string, ToolSchema> = {
  server_info: {
    inputs: [],
    example: { name: "server_info", arguments: {} },
    returns: "diagnostics: version, schema, uptime, security flags",
  },
  github_get_me: {
    inputs: [],
    example: { name: "github_get_me", arguments: {} },
    returns: "authenticated user metadata",
  },
  repo_get: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
    ],
    example: { name: "repo_get", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp" } },
    returns: "repository metadata",
  },
  repo_tree: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "ref", type: "string", required: false, default: "default_branch" },
      { name: "path_prefix", type: "string", required: false },
    ],
    example: { name: "repo_tree", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp", ref: "main" } },
    returns: "tree entries (path, type, sha)",
  },
  file_get: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "path", type: "string", required: true },
      { name: "ref", type: "string", required: false },
    ],
    example: { name: "file_get", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp", path: "README.md" } },
    returns: "file content (base64 + decoded)",
  },
  pr_merge: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "pull_number", type: "integer", required: true },
      { name: "sha", type: "string", required: true, note: "head_sha do PR revisado" },
      { name: "merge_method", type: "enum: merge|squash|rebase", required: false },
      { name: "confirm", type: "literal: CONFIRM_DESTRUCTIVE_OPERATION", required: true },
    ],
    example: {
      name: "pr_merge",
      arguments: {
        owner: "vinicius-ssantos", repo: "github-unified-mcp",
        pull_number: 142, sha: "a1b2c3d4",
        merge_method: "squash",
        confirm: "CONFIRM_DESTRUCTIVE_OPERATION",
      },
    },
    returns: "merged: bool, sha: string",
  },
  git_create_commit: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "message", type: "string", required: true },
      { name: "tree", type: "string (sha)", required: true },
      { name: "parents", type: "array<string>", required: true },
      { name: "confirm", type: "literal: CONFIRM_DESTRUCTIVE_OPERATION", required: true },
    ],
    example: {
      name: "git_create_commit",
      arguments: {
        owner: "vinicius-ssantos", repo: "github-unified-mcp",
        message: "chore: bump", tree: "abc123", parents: ["def456"],
        confirm: "CONFIRM_DESTRUCTIVE_OPERATION",
      },
    },
    returns: "commit object",
  },
  actions_run_workflow: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "workflow_id", type: "string|integer", required: true },
      { name: "ref", type: "string", required: true },
      { name: "inputs", type: "object", required: false },
    ],
    example: { name: "actions_run_workflow", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp", workflow_id: "ci.yml", ref: "main" } },
    returns: "204 no content",
  },
  stack_detect: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "ref", type: "string", required: false, default: "default_branch" },
    ],
    example: { name: "stack_detect", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp" } },
    returns: "stacks[], manifest_files[], entrypoints[]",
  },
  repo_context_atlas: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
    ],
    example: { name: "repo_context_atlas", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp" } },
    returns: "stacks, risk_summary, open_prs, open_issues, protected_branches",
  },
  issue_get: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "issue_number", type: "integer", required: true },
    ],
    example: { name: "issue_get", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp", issue_number: 142 } },
    returns: "issue object: number, title, state, labels, body, comments",
  },
  issue_list: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "state", type: "enum: open|closed|all", required: false, default: "open" },
      { name: "labels", type: "string (csv)", required: false },
      { name: "per_page", type: "integer", required: false, default: "30" },
    ],
    example: { name: "issue_list", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp", state: "open" } },
    returns: "issue[] — number, title, state, labels",
  },
  pr_get: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "pull_number", type: "integer", required: true },
    ],
    example: { name: "pr_get", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp", pull_number: 138 } },
    returns: "PR object: number, title, state, mergeable, mergeable_state, head_sha",
  },
  pr_list: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "state", type: "enum: open|closed|all", required: false, default: "open" },
      { name: "base", type: "string", required: false, note: "filtrar por branch base" },
      { name: "per_page", type: "integer", required: false, default: "30" },
    ],
    example: { name: "pr_list", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp", state: "open" } },
    returns: "PR[] — number, title, state, draft, head_sha",
  },
  actions_list_runs: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "workflow_id", type: "string|integer", required: false },
      { name: "branch", type: "string", required: false },
      { name: "per_page", type: "integer", required: false, default: "10" },
    ],
    example: { name: "actions_list_runs", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp" } },
    returns: "workflow_runs[]: id, name, status, conclusion, head_branch",
  },
  actions_get_run: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "run_id", type: "integer", required: true },
    ],
    example: { name: "actions_get_run", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp", run_id: 9001 } },
    returns: "run object: id, status, conclusion, created_at, html_url",
  },
  actions_get_jobs: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "run_id", type: "integer", required: true },
    ],
    example: { name: "actions_get_jobs", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp", run_id: 9001 } },
    returns: "jobs[]: id, name, status, conclusion, steps[]",
  },
  actions_get_job_logs: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "job_id", type: "integer", required: true },
    ],
    example: { name: "actions_get_job_logs", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp", job_id: 1 } },
    returns: "log text (truncated, bounded output)",
  },
  compare_commits: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "base", type: "string", required: true, note: "sha, tag ou branch base" },
      { name: "head", type: "string", required: true, note: "sha, tag ou branch head" },
    ],
    example: { name: "compare_commits", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp", base: "main", head: "feat/policy-43" } },
    returns: "ahead_by, behind_by, status, files[]",
  },
  pr_get_diff: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "pull_number", type: "integer", required: true },
    ],
    example: { name: "pr_get_diff", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp", pull_number: 138 } },
    returns: "diff string (bounded, sem tokens)",
  },
  pr_get_patch: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "pull_number", type: "integer", required: true },
    ],
    example: { name: "pr_get_patch", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp", pull_number: 138 } },
    returns: "patch no formato git",
  },
  pr_list_changed_files: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "pull_number", type: "integer", required: true },
    ],
    example: { name: "pr_list_changed_files", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp", pull_number: 138 } },
    returns: "files[]: filename, status, additions, deletions",
  },
  pr_risk_review: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "pull_number", type: "integer", required: true },
    ],
    example: { name: "pr_risk_review", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp", pull_number: 138 } },
    returns: "risk_level (low|medium|high), summary, checklist[]",
  },
  project_get: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "project_number", type: "integer", required: true },
    ],
    example: { name: "project_get", arguments: { owner: "vinicius-ssantos", project_number: 1 } },
    returns: "project: id, title, number, items_count",
  },
  project_list_fields: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "project_number", type: "integer", required: true },
    ],
    example: { name: "project_list_fields", arguments: { owner: "vinicius-ssantos", project_number: 1 } },
    returns: "fields[]: name, type, options[]",
  },
  project_list_items: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "project_number", type: "integer", required: true },
      { name: "per_page", type: "integer", required: false, default: "20" },
    ],
    example: { name: "project_list_items", arguments: { owner: "vinicius-ssantos", project_number: 1 } },
    returns: "items[]: title, status, assignees, field_values",
  },
  project_list_views: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "project_number", type: "integer", required: true },
    ],
    example: { name: "project_list_views", arguments: { owner: "vinicius-ssantos", project_number: 1 } },
    returns: "views[]: name, layout",
  },
  write_preflight_check: {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
      { name: "operation", type: "string", required: true, note: "ex: file_create_or_update" },
      { name: "target_branch", type: "string", required: false },
    ],
    example: { name: "write_preflight_check", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp", operation: "file_create_or_update", target_branch: "feat/new" } },
    returns: "decision (allowed|blocked), risk, reason",
  },
  injection_detect: {
    inputs: [
      { name: "text", type: "string", required: true, note: "texto de resposta da API a verificar" },
    ],
    example: { name: "injection_detect", arguments: { text: "Sample API response text to check for injection patterns." } },
    returns: "detected: bool, patterns_checked, safe: bool",
  },
};

const DEFAULT_SCHEMA: ToolSchema = {
  inputs: [
    { name: "owner", type: "string", required: true },
    { name: "repo", type: "string", required: true },
  ],
  example: { name: "", arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp" } },
  returns: "ver docs/PLAYBOOKS.md",
};

export function getSchema(name: string): ToolSchema {
  return TOOL_SCHEMAS[name] ?? { ...DEFAULT_SCHEMA, example: { name, arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp" } } };
}

export { TOOL_SCHEMAS };
