import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
let errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
const ids = ['1.1','1.2','1.3','1.4','1.5','2.1','2.2','2.3','2.4','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8','4.1','4.2','4.3','4.4','4.5','5.1','5.2','5.3','5.4','5.5'];
const shots = new Set(['1.3','1.5','2.3','3.2','3.3','3.6','4.5','5.3','5.5']);
for (const id of ids) {
  await page.goto('http://127.0.0.1:8080/#/read/' + id, { waitUntil: 'networkidle' });
  await page.waitForTimeout(450);
  const h1 = await page.locator('.sec-head h1').textContent().catch(()=>'MISSING');
  const nodes = await page.locator('.widget-mount svg, .widget-mount canvas, .widget-mount table, .widget-mount button').count();
  const bodyLen = (await page.locator('.prose').innerText().catch(()=>''))?.length || 0;
  console.log(id, '|', h1, '| widget nodes', nodes, '| prose', bodyLen);
  if (nodes === 0) errs.push('NO WIDGET ' + id);
  if (bodyLen < 100) errs.push('SHORT PROSE ' + id);
  if (shots.has(id)) await page.screenshot({ path: `shots/_sec-${id}.png` });
}
// tabs
for (const tab of ['channel','time']) {
  await page.goto('http://127.0.0.1:8080/#/lab/' + tab, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  console.log('lab', tab, 'cards', await page.locator('.viz').count(), 'svg', await page.locator('.viz svg').count());
  await page.screenshot({ path: `shots/_lab-${tab}.png` });
}
console.log('ERRORS:\n' + [...new Set(errs)].join('\n'));
await browser.close();
