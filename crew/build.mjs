import {access} from 'node:fs/promises';
for(const file of ['index.html','jobs.html','job.html','crew.js','mm-client.js','_headers']) await access(new URL('dist/'+file,import.meta.url));
console.log('Crew source assets verified.');
