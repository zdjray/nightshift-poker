import { test, expect } from '@playwright/test';

const session = page => page.evaluate(() =>
  JSON.parse(localStorage.getItem('nightshift-session-v1')));

// Each test gets a fresh browser context. All actions use the actual UI;
// storage is read only, never seeded with a synthetic game.
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
  // Fixed randomness makes card deals and bot choices reproducible without
  // replacing the engine, AI, timers, or application event handlers.
  await page.addInitScript(() => {
    let seed = 42;
    Math.random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
  await page.goto('/');
  await page.locator('#settings-button').click();
  await page.locator('[data-pace="quick"]').click();
  await page.locator('#settings-dialog [data-close]').click();
  await expect(page.locator('#call-button')).toBeEnabled();
});

test('call changes the game, then reload restores an identical player turn', async ({ page }) => {
  const before = await session(page);
  await page.locator('#call-button').click();
  await expect.poll(async () => (await session(page)).state.logId).toBeGreaterThan(before.state.logId);
  await expect(page.locator('#call-button')).toBeEnabled();
  const saved = await session(page);
  expect(saved.state.hand).toBe(before.state.hand);
  expect(saved.state.players[0].contributed).toBeGreaterThan(before.state.players[0].contributed);
  const cards = await page.locator('#hero-seat .card').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')));
  const pot = await page.locator('#pot-value').textContent();
  await page.reload();
  await expect(page.locator('#call-button')).toBeEnabled();
  expect(await session(page)).toEqual(saved);
  expect(await page.locator('#hero-seat .card').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')))).toEqual(cards);
  await expect(page.locator('#pot-value')).toHaveText(pot);
  await expect(page.locator('#hand-number')).toHaveText('第 01 手');
  // The restored game must still accept a real action.
  await page.locator('#fold-button').click();
  await expect(page.locator('#hero-seat .hero-status')).toHaveText('本局已弃牌');
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`fold → settlement → history → next hand (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const before = await session(page);
    await page.locator('#fold-button').click();
    await expect(page.locator('#hero-seat .hero-status')).toHaveText('本局已弃牌');
    await expect(page.locator('#skip-button')).toBeVisible();
    await page.locator('#skip-button').click();
    await expect(page.locator('#next-button')).toBeVisible();
    const settled = await session(page);
    expect(settled.state.stage).toBe('showdown');
    expect(settled.stats.hands).toBe(1);
    expect(settled.history).toHaveLength(1);
    expect(settled.state.players.reduce((sum, p) => sum + p.chips, 0)).toBe(10000);
    await expect(page.locator('#hands-stat')).toHaveText('01');
    await page.locator('#settlement-button').click();
    await expect(page.locator('#settlement-dialog')).toBeVisible();
    await expect(page.locator('#settlement-body')).toContainText('你的本局净收益');
    await expect(page.locator('#settlement-body .settlement-total b')).toHaveText(settled.state.result.total.toLocaleString('en-US'));
    await page.locator('#settlement-dialog [data-close]').click();
    await page.locator(viewport.width < 600 ? '#mobile-history' : '#history-button').click();
    await expect(page.locator('#history-dialog')).toBeVisible();
    await expect(page.locator('#hand-history .history-hand')).toHaveCount(1);
    await expect(page.locator('#hand-history')).toContainText('第 01 手');
    await page.locator('#history-dialog [data-close]').click();
    await page.locator('#next-button').click();
    await expect(page.locator('#hand-number')).toHaveText('第 02 手');
    await expect(page.locator('#result-actions')).toBeHidden();
    expect((await session(page)).state.hand).toBe(before.state.hand + 1);
    await expect(page.locator('#call-button')).toBeEnabled();
  });
}
