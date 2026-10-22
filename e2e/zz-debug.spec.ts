import { test, expect } from '@playwright/test';
import { TOUR_CHART } from '../client/src/utils/onboarding';
import { oeffneWerkzeug } from './werkzeug';
test.use({ viewport: { width: 390, height: 420 } });
test('dbg', async ({ page }) => {
  const K = 'worship_docdraw_song999001_a999001_voriginal_0_text';
  await page.addInitScript(({ tour, K }) => {
    localStorage.setItem(`worship:onboard-${tour}`, '1');
    localStorage.setItem('worship:liedansicht', 'scrollen');
    if (!sessionStorage.getItem('x')) {
      sessionStorage.setItem('x', '1');
      localStorage.setItem(K, JSON.stringify([{ id: 3, fx: 0.5, fy: 0.85, text: 'Schluss!', color: '#d92d20', sizeCqh: 1.2 }]));
    }
    (window as any).__log = [];
    const si = Storage.prototype.setItem, ri = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === K || k.includes('rolle-entwurf')) (window as any).__log.push(['set', k.slice(0, 50), String(v).slice(0, 120), (new Error().stack ?? '').split('\n').slice(2, 9).map((s) => s.trim().replace(/http:\/\/localhost:\d+/g, '').replace(/\?[^:]*/g, '')).join(' < ')]);
      return si.call(this, k, v);
    };
    Storage.prototype.removeItem = function (k: string) {
      if (k === K) (window as any).__log.push(['remove', k, (new Error().stack ?? '').split('\n').slice(2, 9).map((s) => s.trim().replace(/http:\/\/localhost:\d+/g, '').replace(/\?[^:]*/g, '')).join(' < ')]);
      return ri.call(this, k);
    };
  }, { tour: TOUR_CHART, K });
  await page.goto('/?demo=chart');
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  console.log('VOR', await page.evaluate((K) => localStorage.getItem(K), K));
  await oeffneWerkzeug(page, 'Anmerken');
  await expect(page.getByTestId('rollen-malen')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  console.log('NACH', await page.evaluate((K) => localStorage.getItem(K), K));
  for (const l of await page.evaluate(() => (window as any).__log)) console.log(JSON.stringify(l));
});
