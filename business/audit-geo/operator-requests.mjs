export const unavailableEvidenceMessage='Public evidence is temporarily unavailable. Your request needs an access check before review; no payment is requested.';
const legacyUnavailableMessage='We could not access useful public evidence for this website. No payment is requested.';

// An explicit diagnosed retry selects one unavailable request, never a paid job
// or an audit refused for lack of useful supported work.
export function selectAuditRequests(requests,{retryReview=false,retryUnavailable}={}) {
 if(retryUnavailable!==undefined){
  if(retryReview||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(retryUnavailable))throw Error('A single unavailable request ID is required');
  const jobs=requests.filter(job=>job.id===retryUnavailable&&(
   job.status==='ineligible'&&job.message===legacyUnavailableMessage||
   job.status==='needs_review'&&job.message===unavailableEvidenceMessage));
  if(jobs.length!==1)throw Error('Unavailable request is not eligible for a diagnostic retry');
  return jobs;
 }
 return requests.filter(job=>job.status==='requested'||retryReview&&job.status==='needs_review').slice(0,2);
}
