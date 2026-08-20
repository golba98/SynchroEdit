const { test, expect } = require('@playwright/test');
const { registerVerifyAndLogin } = require('./helpers/auth');

test.describe('Shared document collaboration', () => {
  test('two independent users edit and chat in the same document across reconnect', async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Two-user socket proof runs once on Chromium.');
    testInfo.setTimeout(120000);
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const suffix = Math.random().toString(36).slice(2, 9);

    try {
      await registerVerifyAndLogin(pageA, `owner_${suffix}`);
      await registerVerifyAndLogin(pageB, `guest_${suffix}`);

      await pageA.locator('#createNewDoc').click();
      await expect(pageA.locator('.ql-editor').first()).toHaveAttribute('contenteditable', 'true', {
        timeout: 30000,
      });
      const documentUrl = pageA.url();
      const documentId = new URL(documentUrl).searchParams.get('doc');
      expect(documentId).toBeTruthy();

      await pageA.locator('#shareBtn').first().click();
      await expect(pageA.locator('#shareModal')).toBeVisible();
      const publicToggle = pageA.locator('#linkSharingToggle');
      if (!(await publicToggle.isChecked())) {
        await pageA.locator('label.switch', { has: publicToggle }).click();
      }
      await expect(pageA.locator('#linkSharingStatus')).toContainText('Updated successfully');
      await pageA.locator('#closeShareModal').click();

      await pageA.locator('.ql-editor').first().fill('Owner starts here');
      await pageB.goto(documentUrl);
      await expect(pageB.locator('.ql-editor').first()).toContainText('Owner starts here', {
        timeout: 30000,
      });

      await pageB.locator('.ql-editor').first().press('End');
      await pageB.keyboard.type(' and guest continues');
      await expect(pageA.locator('.ql-editor').first()).toContainText(
        'Owner starts here and guest continues',
        { timeout: 15000 }
      );

      await pageA.locator('#chatToggle').click();
      await pageB.locator('#chatToggle').click();
      await pageA.locator('#chatInput').fill('Hello from owner');
      await pageA.locator('#chatForm').evaluate((form) => form.requestSubmit());
      await expect(pageB.locator('#chatMessages')).toContainText('Hello from owner');

      await pageB.locator('#chatInput').fill('Hello from guest');
      await pageB.locator('#chatForm').evaluate((form) => form.requestSubmit());
      await expect(pageA.locator('#chatMessages')).toContainText('Hello from guest');

      await pageB.locator('#chatClose').click();
      await expect(pageB.locator('#documentChat')).toBeHidden();
      expect(
        await pageB.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true);

      await contextB.setOffline(true);
      await pageB.locator('.ql-editor').first().press('End');
      await pageB.keyboard.type(' after reconnect');
      await contextB.setOffline(false);
      await expect(pageA.locator('.ql-editor').first()).toContainText(
        'Owner starts here and guest continues after reconnect',
        { timeout: 30000 }
      );

      await pageA.waitForTimeout(2500);
      await pageB.reload();
      await expect(pageB.locator('.ql-editor').first()).toContainText(
        'Owner starts here and guest continues after reconnect',
        { timeout: 30000 }
      );
      await pageB.locator('#chatToggle').click();
      await expect(pageB.locator('#chatMessages')).toContainText('Hello from owner');
      await expect(pageB.locator('#chatMessages')).toContainText('Hello from guest');
    } finally {
      await contextA.close().catch(() => {});
      await contextB.close().catch(() => {});
    }
  });
});
