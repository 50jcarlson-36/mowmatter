import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const views=[['index','home','Overview','▦'],['customers','customers','Customers','◉'],['routes','routes','Visits','⌁'],['financials','financials','Accounting','▥'],['crew-live','team','Team','↗'],['billing','billing','Billing','＄'],['growth','growth','Growth','◈']];
const template=readFileSync(path.join(root,'shell.html'),'utf8');
for(const [slug,page,title] of views){const nav='<nav aria-label="Office navigation">'+views.map(([key,,label,icon])=>`<a href="${key}.html" ${key===slug?'aria-current="page"':''}><span aria-hidden="true">${icon}</span>${label}</a>`).join('')+'<a href="https://crew.mowmatter.com/">Open Crew app ↗</a><a href="https://mowmatter.com/">Mow Matter website</a><a href="demo.html">Sample dashboard</a><a href="https://mowmatter.com/legal.html">Legal &amp; privacy</a><button class="button" id="logout">Sign out</button></nav>';writeFileSync(path.join(root,'dist',slug+'.html'),template.replace('{{PAGE}}',page).replace('{{TITLE}}',title).replace('{{NAV}}',nav))}
console.log('Built seven live Office pages.');
