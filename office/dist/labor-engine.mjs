/** Cost planning, not payroll. Never expose compensation in Crew/customer payloads. */
const finite=(n,label,max=1e8)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>max)throw Error(`${label} is invalid.`);return n;};
const cents=(n,label)=>{finite(n,label);if(!Number.isSafeInteger(n))throw Error(`${label} must be whole cents.`);return n;};
export function loadedHourlyCents(person) {
  let base;
  if(person.payBasis==='salary') {
    const hours=finite(person.annualPaidHours,'Annual paid hours',8760);if(!hours)throw Error('Enter annual paid hours.');
    base=cents(person.annualSalaryCents,'Annual salary')/hours;
  } else if(['hourly','owner'].includes(person.payBasis)) base=cents(person.hourlyCents,'Hourly cost');
  else throw Error('Choose hourly, salary or owner cost.');
  const burden=finite(person.burdenBps??0,'Labor burden',10000);
  const benefits=cents(person.benefitsHourlyCents??0,'Hourly benefits');
  return Math.round(base*(1+burden/10000)+benefits);
}
export function validateLabor(labor) {
  if(!Array.isArray(labor?.people)||!labor.people.length||labor.people.length>100||!Array.isArray(labor.crews)||!labor.crews.length||labor.crews.length>50)throw Error('Add personnel and crews.');
  const ids=new Set();
  for(const p of labor.people){if(!p.id||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>80)throw Error('Personnel need unique IDs and names.');ids.add(p.id);loadedHourlyCents(p);finite(p.weeklyHours,'Weekly hours',168);}
  const crews=new Set();
  for(const c of labor.crews){if(!c.id||crews.has(c.id)||!c.name?.trim()||!Array.isArray(c.personIds)||!c.personIds.length||new Set(c.personIds).size!==c.personIds.length||c.personIds.some(id=>!ids.has(id)))throw Error('Each crew needs a unique ID and distinct personnel.');crews.add(c.id);}
  return labor;
}
export function estimateLabor(labor,crewId,{onsiteMinutes,travelMinutes=0,otherCostCents=0}) {
  validateLabor(labor);
  const crew=labor.crews.find(c=>c.id===crewId);if(!crew)throw Error('Choose a crew.');
  finite(onsiteMinutes,'On-site minutes',1440);finite(travelMinutes,'Travel minutes',1440);cents(otherCostCents,'Other job costs');
  const people=crew.personIds.map(id=>labor.people.find(p=>p.id===id));
  if(people.some(p=>p.active===false))throw Error('An assigned person is inactive.');
  const lines=people.map(p=>({personId:p.id,name:p.name,loadedHourlyCents:loadedHourlyCents(p),onsiteCents:Math.round(loadedHourlyCents(p)*onsiteMinutes/60),travelCents:Math.round(loadedHourlyCents(p)*travelMinutes/60)}));
  const crewHourlyCents=lines.reduce((n,l)=>n+l.loadedHourlyCents,0);
  return {lines,crewHourlyCents,crewClockMinutes:onsiteMinutes,workerMinutes:onsiteMinutes*people.length,travelWorkerMinutes:travelMinutes*people.length,
    laborCents:lines.reduce((n,l)=>n+l.onsiteCents+l.travelCents,0),totalCostCents:lines.reduce((n,l)=>n+l.onsiteCents+l.travelCents,otherCostCents),
    theoreticalWeeklyCrewHours:Math.min(...people.map(p=>p.weeklyHours)),warnings:['Weekly capacity is a ceiling; shared availability, travel, breaks and time off still require scheduling checks.']};
}
/** Actual entries snapshot rates; personnel changes never reprice recorded work. */
export function actualLabor(entries) {
  if(!Array.isArray(entries))throw Error('Invalid time entries.');
  const ids=new Set(),byPerson=new Map();let workerMinutes=0,totalCents=0;
  for(const entry of entries) {
    if(!entry.id||ids.has(entry.id))throw Error('Duplicate time entry.');ids.add(entry.id);
    const start=Date.parse(entry.startedAt),end=Date.parse(entry.endedAt);
    if(!entry.personId||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>86400000)throw Error('Check time entry timestamps.');
    cents(entry.loadedHourlyCents,'Snapshot labor rate');
    const spans=byPerson.get(entry.personId)||[];if(spans.some(([a,b])=>start<b&&end>a))throw Error('Overlapping personnel time entries.');spans.push([start,end]);byPerson.set(entry.personId,spans);
    const minutes=(end-start)/60000;workerMinutes+=minutes;totalCents+=Math.round(entry.loadedHourlyCents*minutes/60);
  }
  return {workerMinutes,totalCents};
}
