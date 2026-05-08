// Tool schemas — input params + example payloads + guard chain.
// Used by the detail drawer.

const TOOL_SCHEMAS = {
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
};

// Default schema for tools we didn't enumerate explicitly.
function getSchema(name) {
  return TOOL_SCHEMAS[name] || {
    inputs: [
      { name: "owner", type: "string", required: true },
      { name: "repo", type: "string", required: true },
    ],
    example: { name, arguments: { owner: "vinicius-ssantos", repo: "github-unified-mcp" } },
    returns: "ver docs/PLAYBOOKS.md",
  };
}

window.TOOL_SCHEMAS = TOOL_SCHEMAS;
window.getSchema = getSchema;
