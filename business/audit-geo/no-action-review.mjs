import {reviewDigest} from './task-review.mjs';
import {validateDraft} from './validate-draft.mjs';

// A reviewed commercial refusal never authorizes a report or payment.
export function validateNoActionReview(draft,evidence,review){
 validateDraft(draft,evidence);
 const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=4000;
 if(review?.version!==1||review.decision!=='no_action'||!text(review.reviewer)||!text(review.reason)||!Number.isFinite(Date.parse(review.reviewedAt))||review.inputDigest!==reviewDigest(draft,evidence))throw Error('Missing or stale no-action review');
 if(!Array.isArray(review.findings)||review.findings.length!==draft.tasks.length)throw Error('Every proposed task requires a refusal reason');
 for(let i=0;i<draft.tasks.length;i++){
  const finding=review.findings[i];
  if(finding?.title!==draft.tasks[i].title||finding.decision!=='remove'||!text(finding.reason)||!text(finding.counterevidence))throw Error('Unresolved proposed task');
 }
 return true;
}
export function selectNoActionRequest(requests,id){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))throw Error('Single reviewed request ID required');
 const matches=requests.filter(job=>job.id===id);
 if(matches.length!==1||matches[0].status!=='prepared'||matches[0].previewApproved===true||matches[0].paymentReceipt||matches[0].paymentVerified)throw Error('Only an uninvited prepared request may be closed');
 return matches[0];
}
