const { test, expect } = require('@playwright/test');

test('root redirects to login.html', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('login');
    await expect(page.locator('#login-form')).toBeVisible();
    const robots = await page.getAttribute('meta[name="robots"]', 'content');
    expect(robots).toContain('noindex');
});
