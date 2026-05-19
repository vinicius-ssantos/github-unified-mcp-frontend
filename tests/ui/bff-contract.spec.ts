import { expect, test, type Page, type Request } from '@playwright/test';

const BFF_URL = 'https://bff.test';
const STORAGE_KEY = 'mcp-panel-settings';

type BffRouteOptions = {
  mcpStatus?: number;
  mcpBody?: unknown;
  userStatus?: number;
  userBody?: unknown;
  auditStatus?: number;
  auditBody?: unknown;
};

async function configureBffMode(page: Page, options: BffRouteOptions = {}) {
  const seen: { mcpCalls: Request[] } = { mcpCalls: [] };

  await page.addInitScript(({ storageKey, bffUrl }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      serverUrl: bffUrl,
      bearerToken: '',
      vercelToken: '',
      mode: 'operator',
      density: 'compact',
      forceError: false,
      theme: 'dark',
    }));
    document.cookie = 'csrf_token=test-csrf-token; path=/';
  }, { storageKey: STORAGE_KEY, bffUrl: BFF_URL });

  await page.route(`${BFF_URL}/healthz`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, service: 'github-unified-mcp-bff' }),
    });
  });

  await page.route(`${BFF_URL}/auth/me`, async route => {
    await route.fulfill({
      status: options.userStatus ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(options.userBody ?? { user: 'vinicius-ssantos', role: 'admin' }),
    });
  });

  await page.route(`${BFF_URL}/api/audit?*`, async route => {
    await route.fulfill({
      status: options.auditStatus ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(options.auditBody ?? {
        total: 1,
        events: [{
          id: 1,
          ts: '2026-05-19T03:00:00Z',
          user: 'vinicius-ssantos',
          tool: 'server_info',
          args_hash: 'sha256:abc123',
          result_ok: 1,
          ip: '127.0.0.1',
          duration_ms: 42,
        }],
      }),
    });
  });

  await page.route(`${BFF_URL}/api/mcp/call`, async route => {
    seen.mcpCalls.push(route.request());
    await route.fulfill({
      status: options.mcpStatus ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(options.mcpBody ?? {
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({ server: 'github-unified-mcp', version: 'test', bff: true }),
          }],
        },
      }),
    });
  });

  return seen;
}

async function openPlayground(page: Page) {
  await page.goto('/');
  await expect(page.getByText('github-unified-mcp', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Playground/ }).click();
  await expect(page.getByText('playground', { exact: true })).toBeVisible();
  await expect(page.getByText(`LIVE · ${BFF_URL}`)).toBeVisible();
}

test.describe('BFF production contract', () => {
  test('executes server_info through structured /api/mcp/call with CSRF header', async ({ page }) => {
    const seen = await configureBffMode(page);

    await openPlayground(page);
    await page.getByRole('button', { name: /executar/ }).click();

    await expect(page.getByText('github-unified-mcp')).toBeVisible();
    await expect.poll(() => seen.mcpCalls.length).toBe(1);

    const request = seen.mcpCalls[0];
    expect(request.url()).toBe(`${BFF_URL}/api/mcp/call`);
    expect(request.method()).toBe('POST');
    expect(request.headers()['x-csrf-token']).toBe('test-csrf-token');
    expect(request.postDataJSON()).toEqual({ name: 'server_info', arguments: {} });
  });

  test('renders real BFF audit events without falling back to demo audit data', async ({ page }) => {
    await configureBffMode(page);

    await page.goto('/');
    await page.getByRole('button', { name: /Audit log/ }).click();

    await expect(page.getByText('server_info').first()).toBeVisible();
    await expect(page.getByText('vinicius-ssantos').first()).toBeVisible();
    await expect(page.getByText('chatgpt-connector').first()).not.toBeVisible();
  });

  for (const { status, label } of [
    { status: 403, label: 'role/policy denied' },
    { status: 429, label: 'rate limit exceeded' },
    { status: 502, label: 'MCP server unreachable' },
    { status: 504, label: 'MCP server timeout' },
  ]) {
    test(`maps ${status} from /api/mcp/call to a production-friendly error`, async ({ page }) => {
      await configureBffMode(page, {
        mcpStatus: status,
        mcpBody: { detail: `${label} test detail` },
      });

      await openPlayground(page);
      await page.getByRole('button', { name: /executar/ }).click();

      await expect(page.getByText(new RegExp(label, 'i'))).toBeVisible();
    });
  }

  test('shows login CTA when BFF session is unauthenticated', async ({ page }) => {
    await configureBffMode(page, {
      userStatus: 401,
      userBody: { detail: 'login required' },
    });

    await page.goto('/');

    const login = page.getByRole('link', { name: /login/ });
    await expect(login).toBeVisible();
    await expect(login).toHaveAttribute('href', `${BFF_URL}/auth/login`);
  });
});
