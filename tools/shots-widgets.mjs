import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const ids=['1.1','1.2','1.3','1.5','2.1','2.3','2.4','3.2','3.3','3.4','3.6','3.8','4.2','4.5','5.2','5.3','5.4','5.5'];
for (const id of ids) {
  await page.goto('http://127.0.0.1:8080/#/read/'+id,{waitUntil:'networkidle'});
  await page.waitForTimeout(500);
  await page.locator('#demo').scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await page.screenshot({path:`shots/_w-${id}.png`});
}
console.log(errs.join('\n'));
await browser.close();
