import { expect, test } from '@playwright/test';

test.describe('MCP console visual regression', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(process.env.VISUAL_REGRESSION !== '1', 'visual snapshots run only when VISUAL_REGRESSION=1');
    await page.addStyleTag({ content: `*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; caret-color: transparent !important; }` });
  });

  test('home console demo mode', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('github-unified-mcp', { exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot('home-console-mock.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('high-risk filter state', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Tool catalog/ }).click();
    await page.getByRole('button', { name: /^high/ }).click();
    await expect(page.getByText('pr_merge').first()).toBeVisible();
    await expect(page).toHaveScreenshot('high-risk-filter.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('settings panel open state', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Configurações').click({ force: true });
    await expect(page.getByText('configurações do painel')).toBeVisible();
    await expect(page).toHaveScreenshot('settings-panel-open.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });
});
