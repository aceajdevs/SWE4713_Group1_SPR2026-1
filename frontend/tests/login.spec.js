import { test, expect } from '@playwright/test';

test.describe('Login flow from welcome', () => {
  test.beforeEach(async ({ page }) => {
    // Make sure your vite dev server is running at http://localhost:5173 before running these tests
    await page.goto('http://localhost:5173/');
  });

  test('shows welcome and navigates to login', async ({ page }) => {
    await expect(page.getByText('Welcome to the App!')).toBeVisible();
    const gotoBtn = page.getByRole('button', { name: 'Go to Login Page' });
    await expect(gotoBtn).toBeVisible();

    await gotoBtn.click();

    // After navigation, the login page elements should be visible
    await expect(page.locator('.logo-placeholder')).toBeVisible();
    await expect(page.getByLabel('username')).toBeVisible();
    await expect(page.getByLabel('password')).toBeVisible();
  });

  test('fills inputs and Clear empties them', async ({ page }) => {
    await page.click('button:has-text("Go to Login Page")');

    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 's3cret');

    await expect(page.locator('input[name="username"]')).toHaveValue('testuser');
    await expect(page.locator('input[name="password"]')).toHaveValue('s3cret');

    await page.getByRole('button', { name: 'Clear' }).click();

    await expect(page.locator('input[name="username"]')).toHaveValue('');
    await expect(page.locator('input[name="password"]')).toHaveValue('');
  });

  test('Help opens the user manual', async ({ page }) => {
    await page.click('button:has-text("Go to Login Page")');
    await page.getByRole('button', { name: 'Open help and user manual' }).click();
    await expect(page.getByRole('heading', { name: 'User manual' })).toBeVisible();
  });

  test('other buttons are clickable', async ({ page }) => {
    await page.click('button:has-text("Go to Login Page")');
    await page.click('button:has-text("Forgot Password?")');
    await page.click('button:has-text("Sign Up")');
    await page.click('button:has-text("Login")');
  });
});
