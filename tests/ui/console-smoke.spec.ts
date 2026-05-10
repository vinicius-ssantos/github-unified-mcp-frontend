import { expect, test } from '@playwright/test';

test.describe('MCP console UI', () => {
  test('renders mock dashboard and filters high-risk tools', async ({ page }, testInfo) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'MCP Console' })).toBeVisible();
    await expect(page.getByText('mock', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tool catalog' })).toBeVisible();

    await expect(page.getByText('server_info')).toBeVisible();
    await expect(page.getByText('pr_merge')).toBeVisible();

    await page.getByRole('combobox').selectOption('high');

    await expect(page.getByText('pr_merge')).toBeVisible();
    await expect(page.getByText('server_info')).not.toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath(`console-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test('falls back to mock mode when live MCP URL fails', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('MCP URL').fill('http://127.0.0.1:9');
    await expect(page.getByText(/Live mode failed, using mock data/i)).toBeVisible();
    await expect(page.getByText('mock', { exact: true })).toBeVisible();
  });
});
