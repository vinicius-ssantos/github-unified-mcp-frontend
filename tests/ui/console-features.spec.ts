import { expect, test } from '@playwright/test';

test.describe('Activity stats strip (Overview)', () => {
  test('shows 5 metrics on Overview tab', async ({ page }) => {
    await page.goto('/');

    // Should already be on overview
    await expect(page.getByText('bloqueadas')).toBeVisible();
    await expect(page.getByText('eventos audit')).toBeVisible();
    await expect(page.getByText('atores únicos')).toBeVisible();
    await expect(page.getByText('top tool')).toBeVisible();
    await expect(page.getByText('último aviso')).toBeVisible();
  });
});

test.describe('Schema drift detection (Tool catalog)', () => {
  test('shows drift banner in demo mode', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Tool catalog/ }).click();

    await expect(page.getByText(/schema drift/i)).toBeVisible();
    await expect(page.getByText('github_assign_issue')).toBeVisible();
    await expect(page.getByText('pr_add_label')).toBeVisible();
  });
});

test.describe('PR Readiness Cockpit', () => {
  test('runs demo analysis and shows recommendation banner', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /PR Readiness/ }).click();

    await expect(page.getByText('PR Readiness Cockpit')).toBeVisible();

    // Trigger demo analysis
    await page.getByRole('button', { name: /analyze demo/ }).click();

    // Demo data should show PR #138
    await expect(page.getByText(/PR #138/)).toBeVisible();

    // Recommendation banner should appear
    await expect(page.getByText(/REVISAR|PRONTO|CI FALHOU|BLOQUEADO|CONFLITO/)).toBeVisible();

    // Risk review section
    await expect(page.getByText('risk review')).toBeVisible();

    // Changed files section
    await expect(page.getByText('changed files')).toBeVisible();
    await expect(page.getByText('src/guard.py')).toBeVisible();

    // CI runs section
    await expect(page.getByText('CI runs')).toBeVisible();
  });

  test('shows field inputs for owner, repo and PR number', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /PR Readiness/ }).click();

    await expect(page.getByPlaceholder('owner')).toBeVisible();
    await expect(page.getByPlaceholder('repo')).toBeVisible();
    await expect(page.getByPlaceholder('PR')).toBeVisible();
  });
});

test.describe('Playground', () => {
  test('shows tool list and executes demo', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Playground/ }).click();

    // Tool list sidebar
    await expect(page.getByText('server_info').first()).toBeVisible();
    await expect(page.getByText('github_get_me').first()).toBeVisible();

    // Execute button
    await expect(page.getByRole('button', { name: /executar/ })).toBeVisible();

    // Execute demo
    await page.getByRole('button', { name: /executar/ }).click();

    // Result should appear (demo response)
    await expect(page.getByText(/github-unified-mcp/)).toBeVisible();
  });

  test('switches tool and clears result', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Playground/ }).click();

    // Execute first tool
    await page.getByRole('button', { name: /executar/ }).click();
    await expect(page.getByText(/github-unified-mcp/)).toBeVisible();

    // Click another tool to clear result
    await page.getByText('github_get_me').first().click();
    await expect(page.getByText('execute uma tool para ver o resultado')).toBeVisible();
  });
});

test.describe('Tool drawer', () => {
  test('opens drawer on tool row click and shows guard chain', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('g');
    await page.keyboard.press('t');

    // Click on server_info tool row
    await page.locator('.ca-tools-row', { hasText: 'server_info' }).first().click();

    // Drawer should open
    await expect(page.getByText('guard chain')).toBeVisible();
    await expect(page.getByText('all pass under')).toBeVisible();
    await expect(page.getByText('Allowlist de repositórios')).toBeVisible();

    // Inputs section
    await expect(page.getByText('inputs')).toBeVisible();
    await expect(page.getByText('— sem parâmetros —')).toBeVisible();

    // MCP call example
    await expect(page.getByText('MCP call')).toBeVisible();
  });

  test('drawer has Playground button for low-risk tools', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('g');
    await page.keyboard.press('t');

    await page.locator('.ca-tools-row', { hasText: 'server_info' }).first().click();

    await expect(page.getByRole('button', { name: /playground/ })).toBeVisible();
  });

  test('drawer closes on Escape key', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('g');
    await page.keyboard.press('t');

    await page.locator('.ca-tools-row', { hasText: 'server_info' }).first().click();
    await expect(page.getByText('guard chain')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByText('guard chain')).not.toBeVisible();
  });
});

test.describe('Security posture tab', () => {
  test('shows 10 security layers', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('g');
    await page.keyboard.press('s');

    await expect(page.getByText('Camadas de segurança')).toBeVisible();
    await expect(page.getByText('10 camadas independentes')).toBeVisible();
    await expect(page.getByText('Allowlist de repositórios')).toBeVisible();
    await expect(page.getByText('Token redaction')).toBeVisible();
    await expect(page.getByText('Injection detect')).toBeVisible();
  });
});

test.describe('Runbook tab', () => {
  test('shows runbook picker and checklist steps', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('g');
    await page.keyboard.press('r');

    await expect(page.getByText(/Runbook · pr_merge/)).toBeVisible();
    await expect(page.getByText('rollback de ref')).toBeVisible();
    await expect(page.getByText('branch → arquivo → PR')).toBeVisible();

    // Steps should be listed
    await expect(page.getByText('Verificar PR aberto')).toBeVisible();
  });

  test('checkmark toggles on step click', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('g');
    await page.keyboard.press('r');

    const firstStep = page.locator('.ca-runbook-step').first();
    await expect(firstStep).not.toHaveClass(/is-done/);
    await firstStep.click();
    await expect(firstStep).toHaveClass(/is-done/);
  });
});

test.describe('.env wizard tab', () => {
  test('shows mode indicator and output', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('g');
    await page.keyboard.press('e');

    await expect(page.getByText('modo resultante')).toBeVisible();
    await expect(page.locator('.ca-wiz-mode-value')).toContainText('Read-only');
    await expect(page.getByText('GITHUB_READ_ONLY=true', { exact: true })).toBeVisible();
  });
});

test.describe('Settings panel', () => {
  test('opens and closes settings', async ({ page }) => {
    await page.goto('/');

    await page.getByTitle('Configurações').click({ force: true });
    await expect(page.getByText('configurações do painel')).toBeVisible();
    await expect(page.getByPlaceholder('https://github-unified-mcp-bff.onrender.com')).toBeVisible();

    await page.getByRole('button', { name: 'cancelar' }).click();
    await expect(page.getByText('configurações do painel')).not.toBeVisible();
  });
});
