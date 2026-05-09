/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MCP_URL?: string;
  readonly VITE_MCP_TOKEN?: string;
  readonly VITE_MCP_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
