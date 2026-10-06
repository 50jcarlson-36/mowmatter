const {JSDOM}=require('jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
const code=fs.readFileSync('activity-toast.js','utf8');
const dom=new JSDOM('<body><input></body>',{url:'https://mowmatter.com',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window; let now=0,id=0,tasks=new Map();
w.Date.now=()=>now; w.Math.random=()=>0;
w.setInterval=(fn,ms)=>{tasks.set(++id,{fn,ms,due:now+ms,repeat:true});return id};
w.setTimeout=(fn,ms)=>{tasks.set(++id,{fn,ms,due:now+ms});return id};
w.clearInterval=w.clearTimeout=(key)=>tasks.delete(key);
function advance(ms){const end=now+ms; while(true){const next=[...tasks].sort((a,b)=>a[1].due-b[1].due)[0];if(!next||next[1].due>end)break;now=next[1].due;if(next[1].repeat)next[1].due+=next[1].ms;else tasks.delete(next[0]);next[1].fn()}now=end;}
w.eval(code);const h=w.document.getElementById('mm-activity-toast');assert(h.hidden);advance(10000);assert(!h.hidden);assert(h.textContent.includes('Build a business worth growing'));assert(h.textContent.includes('Explore the Growth Lab'));assert.equal(w.localStorage.getItem('mowmatter.marketing.v2'),'1');advance(6000);assert(!h.classList.contains('mm-toast-visible'));advance(250);assert(h.hidden);advance(3750);assert(h.textContent.includes('Your next chapter starts here'));h.querySelector('button').click();assert(h.hidden);assert.equal(w.sessionStorage.getItem('mowmatter.activity.paused'),'1');assert.equal(tasks.size,0);advance(30000);assert(h.hidden);dom.window.close();
console.log('PASS: delay, 6-second visibility, fade, 10-second cycle, sequence persistence, CTA, dismissal and timer cleanup.');
