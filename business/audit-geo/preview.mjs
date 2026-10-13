import {canRequestPayment} from './validate-draft.mjs';
export function reviewedPreview(draft,evidence){
 if(!canRequestPayment(draft,evidence))return null;
 const ratings=draft.review?.findings;
 if(!Array.isArray(ratings)||ratings.length!==draft.tasks.length)return null;
 const counts={critical:0,medium:0,low:0,total:draft.tasks.length};
 for(let i=0;i<ratings.length;i++){
  const r=ratings[i];
  if(r.title!==draft.tasks[i].title||!['critical','medium','low'].includes(r.severity)||typeof r.reason!=='string'||!r.reason.trim())return null;
  counts[r.severity]++;
 }
 return counts;
}
