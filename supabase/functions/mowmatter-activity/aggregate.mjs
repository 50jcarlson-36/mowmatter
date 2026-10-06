// Public output contains only lower-bound aggregate counts, never personal data.
export function aggregate(leads, requests) {
  const events=[];
  const distinct=rows=>new Set(rows.map(r=>String(r.email||'').trim().toLowerCase()).filter(Boolean)).size;
  const signups=distinct(leads.filter(r=>r.marketing_consent===true));
  if(signups>=3)events.push({type:'signup',title:'Operators are exploring Mow Matter',place:'Across the United States',value:'',detail:`At least ${signups} businesses requested early access in the past 7 days.`,href:'early-access.html',cta:'Join early access'});
  const groups=new Map();
  for(const row of requests){if(!row.request_consent||!/^[A-Z]{2}$/.test(row.state||'')||!row.city)continue;const place=String(row.city).trim().slice(0,80)+', '+row.state;const group=groups.get(place)||[];group.push(row);groups.set(place,group);}
  for(const [place,rows] of groups){const count=distinct(rows);if(count>=3)events.push({type:'lead',title:'Homeowners are looking for lawn care',place,value:'',detail:`At least ${count} homeowners submitted lawn-care requests here in the past 7 days.`,href:'early-access.html',cta:'Explore Mow Matter'});}
  return events.slice(0,30);
}
