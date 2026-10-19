import { chromium } from 'playwright';import { pathToFileURL } from 'node:url';
const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});const p=await c.newPage();
const U=pathToFileURL('/Users/lianshi/作业/可视化导论/作业4/index.html').href;
await p.goto(U+'#/read/1.3',{waitUntil:'load'});await p.waitForTimeout(700);
await p.click('#btnMenu');await p.waitForTimeout(500);
const info=await p.evaluate(()=>{
 const s=document.querySelector('.sidenav'), f=document.querySelector('.sidenav__foot'), m=document.querySelector('#mTheme'), body=document.querySelector('.sidenav__body');
 const r=e=>{const x=e.getBoundingClientRect();return {x:x.x,y:x.y,w:x.width,h:x.height,b:x.bottom}};
 return {cls:document.body.className, side:r(s), foot:r(f), m:r(m), body:r(body), transform:getComputedStyle(s).transform, vh:innerHeight};
});
console.log(JSON.stringify(info,null,2));
await p.screenshot({path:'shots/_drawer.png'});
await b.close();
