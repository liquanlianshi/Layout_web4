import { chromium } from 'playwright';
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
p.on('console',m=>console.log('console',m.type(),m.text()));p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://127.0.0.1:8080/#/read/2.3',{waitUntil:'networkidle'});await p.waitForTimeout(1200);
const info=await p.evaluate(()=>{
 const w=document.querySelector('.widget-mount'); const svg=w.querySelector('svg');
 return {html:w.innerHTML.slice(0,600), svg:svg?{w:svg.getBoundingClientRect().width,h:svg.getBoundingClientRect().height, vb:svg.getAttribute('viewBox'), children:svg.childElementCount, inner:svg.innerHTML.slice(0,500)}:null, canvas:w.querySelector('.viz__stack')?.getBoundingClientRect()};
});
console.log(JSON.stringify(info,null,2));
await b.close();
