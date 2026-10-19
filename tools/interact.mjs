import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs=[]; page.on('pageerror',e=>errs.push('PAGEERR '+e.message)); page.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const log = (...a)=>console.log(...a);

await page.goto('http://127.0.0.1:8080/',{waitUntil:'networkidle'}); await page.waitForTimeout(900);
log('theme attr', await page.getAttribute('html','data-theme'));
await page.click('#themeSeg [data-theme-val="ink"]'); await page.waitForTimeout(500);
log('theme after', await page.getAttribute('html','data-theme'));
await page.screenshot({path:'shots/_home-ink.png'});
await page.click('#langSeg [data-lang-val="en"]'); await page.waitForTimeout(600);
log('lang', await page.getAttribute('html','data-lang'), 'hero', (await page.locator('.hero__title').innerText()).replace(/\n/g,' '));
await page.screenshot({path:'shots/_home-ink-en.png'});
await page.click('#langSeg [data-lang-val="zh"]'); await page.waitForTimeout(400);
await page.click('#themeSeg [data-theme-val="paper"]'); await page.waitForTimeout(300);

// search
await page.keyboard.press('Meta+k'); await page.waitForTimeout(300);
log('palette visible', await page.locator('#palette').isVisible());
await page.fill('#paletteInput','视觉通道'); await page.waitForTimeout(300);
log('results', await page.locator('.palette__item').count());
await page.screenshot({path:'shots/_search.png'});
await page.keyboard.press('Enter'); await page.waitForTimeout(700);
log('route after search', await page.evaluate(()=>location.hash), 'h1', await page.locator('.sec-head h1').textContent());

// datajoin
await page.goto('http://127.0.0.1:8080/#/read/1.5',{waitUntil:'networkidle'}); await page.waitForTimeout(700);
await page.locator('#demo').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
const counts = ()=>page.locator('.join__counts').innerText();
log('join initial', await counts());
await page.getByRole('button',{name:/添加一条/}).click(); await page.waitForTimeout(200);
log('join after add', await counts());
await page.getByRole('button',{name:/打乱顺序/}).click(); await page.waitForTimeout(200);
log('join after shuffle', await counts());
await page.screenshot({path:'shots/_join-added.png'});
// key off
await page.locator('.switch').first().click(); await page.waitForTimeout(200);
log('join key off', await counts());

// quiz 1.1
await page.goto('http://127.0.0.1:8080/#/read/1.1',{waitUntil:'networkidle'}); await page.waitForTimeout(600);
await page.locator('.quiz').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
await page.locator('.quiz__opt').nth(1).click(); await page.waitForTimeout(200);
log('quiz verdict', await page.locator('.quiz__verdict').innerText(), 'why hidden', await page.locator('.quiz__why').isHidden());

// tree
await page.goto('http://127.0.0.1:8080/#/read/2.3',{waitUntil:'networkidle'}); await page.waitForTimeout(700);
log('tree children', await page.locator('.widget-mount svg').first().evaluate(el=>el.childElementCount));
await page.locator('.widget-mount .switch').click(); await page.waitForTimeout(400);
await page.locator('#demo').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
await page.screenshot({path:'shots/_tree.png'});

// colormap
await page.goto('http://127.0.0.1:8080/#/read/3.2',{waitUntil:'networkidle'}); await page.waitForTimeout(700);
await page.locator('.widget-mount select').first().selectOption('div'); await page.waitForTimeout(300);
await page.locator('.widget-mount select').nth(1).selectOption('rdbu'); await page.waitForTimeout(300);
log('colormap verdict', await page.locator('.rec-card__name').innerText());
await page.locator('#demo').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
await page.screenshot({path:'shots/_colormap-div.png'});

// quiz card
await page.goto('http://127.0.0.1:8080/#/read/3.6',{waitUntil:'networkidle'}); await page.waitForTimeout(700);
await page.locator('.quiz-card').nth(3).click(); await page.waitForTimeout(300);
log('color quiz verdict', await page.locator('.quiz-verdict').innerText());
await page.locator('#demo').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
await page.screenshot({path:'shots/_colorquiz.png'});

// marching
await page.goto('http://127.0.0.1:8080/#/read/4.5',{waitUntil:'networkidle'}); await page.waitForTimeout(700);
log('march stats', await page.locator('.readout').last().innerText());
await page.locator('.widget-mount input[type=range]').evaluate(el=>{el.value='0.7';el.dispatchEvent(new Event('input',{bubbles:true}))}); await page.waitForTimeout(400);
log('march stats2', await page.locator('.readout').last().innerText());
await page.locator('#demo').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
await page.screenshot({path:'shots/_march2.png'});

// lab color subtabs
await page.goto('http://127.0.0.1:8080/#/lab/color',{waitUntil:'networkidle'}); await page.waitForTimeout(700);
for (let i=0;i<7;i++){
  await page.locator('.lab-subtab').nth(i).click(); await page.waitForTimeout(350);
  log('subtab', i, await page.locator('.lab-subtab.is-on').innerText(), 'nodes', await page.locator('.lab-subpanel svg, .lab-subpanel table, .lab-subpanel .swatches').count());
}
await page.screenshot({path:'shots/_lab-cvdtest.png'});

// map select
await page.goto('http://127.0.0.1:8080/#/map',{waitUntil:'networkidle'}); await page.waitForTimeout(700);
await page.locator('.mapnode--section').nth(4).click(); await page.waitForTimeout(300);
log('map aside', (await page.locator('.map-aside').innerText()).slice(0,80));
await page.screenshot({path:'shots/_map-selected.png'});
await page.getByRole('button',{name:/列表视图/}).click(); await page.waitForTimeout(400);
log('map list items', await page.locator('.maplist__item').count());

// mobile
const m = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
m.on('pageerror',e=>errs.push('MOBILE '+e.message));
await m.goto('http://127.0.0.1:8080/#/read/1.3',{waitUntil:'networkidle'}); await m.waitForTimeout(800);
log('mobile overflow', await m.evaluate(()=>document.documentElement.scrollWidth - window.innerWidth));
await m.screenshot({path:'shots/_mobile-reader.png'});
await m.click('#btnMenu'); await m.waitForTimeout(400);
log('mobile side open', await m.evaluate(()=>document.body.classList.contains('side-open')));
await m.screenshot({path:'shots/_mobile-side.png'});

console.log('ERRORS\n'+[...new Set(errs)].join('\n'));
await b.close();
