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

  test('navigates to Tool catalog from nav', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Tool catalog/ }).click();

    await expect(page.getByText('server_info')).toBeVisible();
  });

  test('navigates to Security posture from nav', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Security posture/ }).click();

    await expect(page.getByText('Camadas de segurança')).toBeVisible();
  });

  test('navigates to Audit log from nav', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Audit log/ }).click();

    await expect(page.getByText('Audit log').first()).toBeVisible();
    await expect(page.getByText('chatgpt-connector').first()).toBeVisible();
  });

  test('navigates to PR Readiness from nav', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /PR Readiness/ }).click();

    await expect(page.getByText('PR Readiness Cockpit')).toBeVisible();
    await expect(page.getByText(/DEMO · configure serverUrl/)).toBeVisible();
  });

  test('navigates to Playground from nav', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Playground/ }).click();

    await expect(page.getByText('playground', { exact: true })).toBeVisible();
    await expect(page.getByText(/DEMO · configure serverUrl/)).toBeVisible();
  });
});
