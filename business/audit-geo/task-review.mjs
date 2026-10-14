import {createHash} from 'node:crypto';

// A snapshot binding prevents reuse after edits; it is not a reviewer signature.
export function reviewDigest(draft,evidence){
 const {review,...content}=draft;
 return createHash('sha256').update(JSON.stringify({draft:content,evidence})).digest('hex');
}
const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=4000;
export function validateTaskReview(draft,evidence){
 const errors=[];const review=draft.review;
 if(review?.version!==2||!text(review.reviewer)||typeof review.reviewedAt!=='string'||!Number.isFinite(Date.parse(review.reviewedAt))||review.inputDigest!==reviewDigest(draft,evidence))errors.push('missing or stale review snapshot');
 const findings=review?.findings;
 if(!Array.isArray(findings)||findings.length!==draft.tasks.length)return {approved:false,errors:[...errors,'every task requires a review']};
 for(let i=0;i<draft.tasks.length;i++){
  const task=draft.tasks[i],r=findings[i];
  const reject=reason=>errors.push(`task ${i+1}: ${reason}`);
  if(!r||r.title!==task.title){reject('identity mismatch');continue;}
  if(r.decision!=='keep'||!['supported','conditional'].includes(r.semanticSupport))reject('unsupported, unknown or unresolved task');
  for(const field of ['reason','supportReason','counterevidence','coverage','value','change','acceptance','noAction'])if(!text(r[field]))reject(`missing ${field}`);
  const expected=[...new Set(task.references.map(ref=>ref.evidenceId))].sort();
  if(!Array.isArray(r.evidenceIds)||JSON.stringify([...new Set(r.evidenceIds)].sort())!==JSON.stringify(expected)||r.evidenceIds.length!==expected.length)reject('review evidence mismatch');
  if(!['critical','medium','low'].includes(r.severity))reject('invalid severity');
  if(!['reproduced','source_only','unknown'].includes(r.reproduction?.status)||!text(r.reproduction?.reason))reject('missing reproduction record');
  if(r.severity==='critical'&&(r.semanticSupport!=='supported'||r.reproduction?.status!=='reproduced'||r.intendedIndexing!==true))reject('critical blocker not reproduced with indexing intent');
 }
 return {approved:errors.length===0,errors};
}
