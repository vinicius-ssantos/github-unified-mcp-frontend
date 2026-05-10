import { expect, test } from '@playwright/test';

test.describe('MCP console visual regression', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(process.env.VISUAL_REGRESSION !== '1', 'visual snapshots run only when VISUAL_REGRESSION=1');
    await page.addStyleTag({ content: `*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; caret-color: transparent !important; }` });
  });

  test('home console mock mode', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'MCP Console' })).toBeVisible();
    await expect(page).toHaveScreenshot('home-console-mock.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('high-risk filter state', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox').selectOption('high');
    await expect(page.getByText('pr_merge')).toBeVisible();
    await expect(page).toHaveScreenshot('high-risk-filter.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('live fallback notice state', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('MCP URL').fill('http://127.0.0.1:9');
    await expect(page.getByText(/Live mode failed, using mock data/i)).toBeVisible();
    await expect(page).toHaveScreenshot('live-fallback-notice.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });
});
