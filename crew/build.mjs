import { access } from 'node:fs/promises';
// Crew serves its maintained static sources directly.
for (const name of ['index.html','jobs.html','job.html','route.html','messages.html','more.html','crew.js','mm-client.js','sw.js']) await access(new URL('./dist/'+name,import.meta.url));
console.log('Crew static assets verified');
