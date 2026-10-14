// Retained operator inventory, not lifetime acquisition or a customer cohort.
const statuses=['requested','prepared','needs_review','payment_pending','ineligible','delivered'];
export function summarizeFunnel(queue, observedAt=new Date().toISOString()) {
 if(!Array.isArray(queue?.requests)||queue.requests.length>50)throw Error('Invalid bounded inventory');
 const counts=Object.fromEntries(statuses.map(s=>[s,0]));let unknownStatus=0,reviewedSummaries=0;
 const byEntry=Object.fromEntries(['home','guide','guide-audit','guide-visibility','linkedin','unknown'].map(k=>[k,{total:0,reviewedSummaries:0,statuses:Object.fromEntries(statuses.map(s=>[s,0]))}]));
 for(const r of queue.requests){
  if(!r||typeof r!=='object')throw Error('Invalid inventory record');
  if(statuses.includes(r.status))counts[r.status]++;else unknownStatus++;
  const entry=byEntry[['home','guide','guide-audit','guide-visibility','linkedin'].includes(r.acquisitionSource)?r.acquisitionSource:'unknown'];entry.total++;if(statuses.includes(r.status))entry.statuses[r.status]++;
  const p=r.preview;
  if(r.previewApproved===true&&p&&['critical','medium','low','total'].every(k=>Number.isSafeInteger(p[k])&&p[k]>=0)&&p.total>0&&p.total<=3&&p.total===r.taskCount&&p.total===p.critical+p.medium+p.low){reviewedSummaries++;entry.reviewedSummaries++;}
 }
 return {schemaVersion:2,observedAt,scope:'retained operator inventory; first page only; includes administrative/test requests if retained',completeLifetimeCohort:false,listLimit:50,atListLimit:queue.requests.length===50,retentionDays:{undelivered:30,delivered:90},attribution:{basis:'self-reported fixed entry label; not verified channel attribution',byEntry},inventory:{total:queue.requests.length,statuses:counts,unknownStatus,reviewedSummaries},configuration:{payments:typeof queue.paymentsConfigured==='boolean'?queue.paymentsConfigured:null,notifications:typeof queue.notificationsConfigured==='boolean'?queue.notificationsConfigured:null},outcomes:{visits:null,qualifiedRequests:null,verifiedCustomerSales:null,inboxDeliveries:null,conversionRate:null},limitations:['Deleted/expired records and later list pages are absent.','Current statuses are not cumulative transition counts.','Delivered status is not independent proof of a real customer sale or inbox receipt.','No visitor denominator is available. Entry labels can be missing or spoofed; legacy requests are unknown. Retained reviewed summaries are not independently qualified customer demand.']};
}
