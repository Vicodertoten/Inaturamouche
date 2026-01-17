import { test, expect } from '@playwright/test';

test('home page loads', async ({ page, baseURL }) => {
  await page.goto(baseURL || '/');
  // ensure we are on the base URL
  await expect(page).toHaveURL(/\/?$/);
});
