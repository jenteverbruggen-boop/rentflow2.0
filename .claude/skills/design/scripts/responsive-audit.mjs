import { chromium } from 'playwright';
import fs from 'fs';
// Usage: node responsive-audit.mjs <outDir>   (BASE defaults to the QA server on :3100)
const B=process.env.BASE||'http://127.0.0.1:3100', S=process.argv[2];
if(!S) throw new Error('usage: node responsive-audit.mjs <outDir>');
fs.mkdirSync(S+'/shots',{recursive:true});
const LOGIN={email:'admin@rentflow.dev',password:'admin123'};
const vps=[[360,740],[390,844],[768,1024],[1024,768],[1280,800],[1440,900],[1920,1080]];
const browser=await chromium.launch();
// Detail routes use the first id the API returns, so the audit works on any seed.
const probe=await browser.newContext();
if(!(await probe.request.post(B+'/api/auth/login',{data:LOGIN})).ok()) throw new Error('login failed');
const firstId=async api=>{const r=await probe.request.get(B+api);const a=r.ok()?await r.json():[];return Array.isArray(a)&&a[0]?a[0].id:null};
const [P,F,O]=await Promise.all(['/api/projects','/api/invoices','/api/quotes'].map(firstId));
await probe.close();
const routes=['/','/projects','/people','/materials','/materials/labels','/materials/prijslijst','/planning','/clients','/locations','/leveranciers','/notes','/facturen','/offertes','/cijfers','/import','/users','/settings','/profile',
  ...(P?[`/projects/${P}`,`/projects/${P}/pakbon`,`/projects/${P}/kosten`,`/projects/${P}/callsheet`]:[]),
  ...(F?[`/facturen/${F}`,`/facturen/${F}/print`]:[]),
  ...(O?[`/offertes/${O}`,`/offertes/${O}/print`]:[])];
const out=[];
for(const [w,h] of vps){
  const ctx=await browser.newContext({viewport:{width:w,height:h}});
  const page=await ctx.newPage();
  await page.goto(B+'/login');
  const r=await ctx.request.post(B+'/api/auth/login',{data:LOGIN});
  if(!r.ok()) throw new Error('login '+r.status());
  for(const route of routes){
    try{
      await page.goto(B+route,{waitUntil:'networkidle',timeout:60000});
      await page.waitForTimeout(500);
      const m=await page.evaluate(()=>{
        const de=document.documentElement, vw=innerWidth, vh=innerHeight;
        const sel=e=>{let s=e.tagName.toLowerCase();if(e.id)s+='#'+e.id;const c=(e.getAttribute('class')||'').split(/\s+/).filter(Boolean).slice(0,3).join('.');if(c)s+='.'+c;const t=(e.textContent||'').trim().slice(0,30);return s+(t?` "${t}"`:'')};
        const inner=[];
        for(const e of document.querySelectorAll('body *')){
          const cs=getComputedStyle(e);
          if(cs.display==='none'||cs.visibility==='hidden')continue;
          const ox=/(auto|scroll)/.test(cs.overflowX), oy=/(auto|scroll)/.test(cs.overflowY);
          if(oy&&e.scrollHeight>e.clientHeight+1&&e.clientHeight>0)inner.push('V '+sel(e)+` ${e.clientHeight}/${e.scrollHeight}`);
          if(ox&&e.scrollWidth>e.clientWidth+1&&e.clientWidth>0)inner.push('H '+sel(e)+` ${e.clientWidth}/${e.scrollWidth}`);
        }
        const off=[];
        for(const e of document.querySelectorAll('body *')){
          const r=e.getBoundingClientRect();
          if(r.width>0&&r.height>0&&(r.right>vw+1||r.left<-1)){
            // skip if inside an element that scrolls horizontally / fixed hidden
            let p=e.parentElement,clipped=false;while(p&&p!==document.body){const c=getComputedStyle(p);if(/(auto|scroll|hidden|clip)/.test(c.overflowX)&&p.getBoundingClientRect().right<=vw+1){clipped=true;break}p=p.parentElement}
            if(!clipped)off.push(sel(e)+` r=${Math.round(r.right)}`);
          }
        }
        return {docH:de.scrollWidth>vw+1,docV:de.scrollHeight>vh+1,sw:de.scrollWidth,sh:de.scrollHeight,inner:inner.slice(0,12),off:off.slice(0,6)};
      });
      out.push({w,h,route,...m});
      if(w===390||w===768||w===1280) await page.screenshot({path:`${S}/shots/${w}${route.replace(/\//g,'_')||'_'}.png`,fullPage:false});
    }catch(e){out.push({w,h,route,error:String(e).slice(0,120)})}
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(S+'/audit.json',JSON.stringify(out,null,1));
