// Whitelist the remote response before printing; never echo provider errors.
export function safePageViewMetrics(input){
 const pages=['home','guide-audit','guide-visibility','privacy'];
 if(input?.schemaVersion!==1||input.timeZone!=='Europe/Zurich'||!Array.isArray(input.days)||input.days.length!==7)throw Error('Public GET metrics unavailable');
 const days=input.days.map(row=>{
  if(typeof row?.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||typeof row.truncated!=='boolean')throw Error('Invalid public GET metrics');
  const timestamp=Date.parse(row.date+'T12:00:00Z');
  if(!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==row.date)throw Error('Invalid public GET calendar date');
  const counts=Object.fromEntries(pages.map(page=>{
   const count=row.counts?.[page];if(!Number.isSafeInteger(count)||count<0||count>1000)throw Error('Invalid public GET count');return [page,count];
  }));
  if(Object.values(counts).reduce((a,b)=>a+b)>1000)throw Error('Invalid public GET total');
  return {date:row.date,counts,truncated:row.truncated};
 });
 if(new Set(days.map(row=>row.date)).size!==7)throw Error('Invalid calendar window');
 const first=Date.parse(days[0].date+'T12:00:00Z');
 if(days.some((row,index)=>row.date!==new Date(first-index*86400000).toISOString().slice(0,10)))throw Error('Invalid calendar window');
 return {schemaVersion:1,timeZone:'Europe/Zurich',days,limits:['Stored public page GET events, including bots, repeats and verification traffic; not unique visitors.', 'Upstream cache hits and failed writes absent. First 1000 events per day; truncated counts are lower bounds.', 'Current day incomplete; no backfill, qualified-demand result or visitor conversion rate.']};
}
