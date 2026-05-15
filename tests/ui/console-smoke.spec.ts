import { expect, test } from '@playwright/test';

test.describe('MCP console UI — smoke', () => {
  test('renders demo mode with brand, DEMO badge and tool count tab', async ({ page }, testInfo) => {
    await page.goto('/');

    await expect(page.getByText('github-unified-mcp', { exact: true })).toBeVisible();
    await expect(page.getByText('DEMO', { exact: true })).toBeVisible();

    // Tool catalog tab shows total count
    await expect(page.getByRole('button', { name: /Tool catalog ·/ })).toBeVisible();

    // Key tools visible in overview/initial render
    await expect(page.getByText('painel de operador · console')).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath(`console-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test('navigates to Tool catalog tab and filters by high risk', async ({ page }) => {
    await page.goto('/');

    // Navigate to tools tab
    await page.getByRole('button', { name: /Tool catalog/ }).click();

    // Tool table should be visible with known tools
    await expect(page.getByText('server_info')).toBeVisible();
    await expect(page.getByText('pr_merge')).toBeVisible();

    // Filter by high risk
    await page.getByRole('button', { name: /^high/ }).click();

    await expect(page.getByText('pr_merge')).toBeVisible();
    await expect(page.getByText('server_info')).not.toBeVisible();

    // Reset to all
    await page.getByRole('button', { name: /^all/ }).first().click();
    await expect(page.getByText('server_info')).toBeVisible();
  });

  test('keyboard shortcut g+t navigates to Tool catalog', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('g');
    await page.keyboard.press('t');

    await expect(page.getByText('server_info')).toBeVisible();
  });

  test('keyboard shortcut g+s navigates to Security posture', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('g');
    await page.keyboard.press('s');

    await expect(page.getByText('Camadas de segurança')).toBeVisible();
  });

  test('keyboard shortcut g+a navigates to Audit log', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('g');
    await page.keyboard.press('a');

    await expect(page.getByText('Audit log').first()).toBeVisible();
    await expect(page.getByText('chatgpt-connector').first()).toBeVisible();
  });

  test('keyboard shortcut ? opens help modal and Esc closes it', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('?');
    await expect(page.getByText('atalhos de teclado')).toBeVisible();
    await expect(page.getByText('Tool catalog', { exact: true })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByText('atalhos de teclado')).not.toBeVisible();
  });

  test('keyboard shortcut g+b navigates to PR Readiness', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('g');
    await page.keyboard.press('b');

    await expect(page.getByText('PR Readiness Cockpit')).toBeVisible();
    await expect(page.getByText(/DEMO · configure serverUrl/)).toBeVisible();
  });

  test('keyboard shortcut g+p navigates to Playground', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('g');
    await page.keyboard.press('p');

    await expect(page.getByText('playground', { exact: true })).toBeVisible();
    await expect(page.getByText(/DEMO · configure serverUrl/)).toBeVisible();
  });
});
