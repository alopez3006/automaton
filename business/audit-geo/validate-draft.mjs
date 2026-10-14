import {validateTaskReview} from './task-review.mjs';
// Source identity checks are not semantic entailment or a usefulness review.
export function validateDraft(draft,evidence) {
  const fail=message=>{throw Error(`Report requires review: ${message}`);};
  if(!draft||typeof draft.report!=='string'||!draft.report.trim()||draft.report.length>10000||typeof draft.eligible!=='boolean'||typeof draft.reason!=='string'||!Number.isInteger(draft.taskCount)||draft.taskCount<0||draft.taskCount>3||!Array.isArray(draft.tasks)||draft.tasks.length!==draft.taskCount||draft.eligible&&draft.taskCount===0)fail('invalid structured task contract');
  const observations=new Map((evidence?.observations??[]).map(o=>[o.id,o]));
  const titles=new Set();
  for(const task of draft.tasks){
    if(typeof task.title!=='string'||!task.title.trim()||titles.has(task.title)||!draft.report.includes(task.title)||!Array.isArray(task.references)||!task.references.length||task.references.length>10)fail('task or references missing');
    titles.add(task.title);
    for(const ref of task.references){
      const o=observations.get(ref.evidenceId);
      if(typeof ref.evidenceId!=='string'||!/^E[1-9]\d*$/.test(ref.evidenceId)||!o||o.error||ref.url!==o.url||ref.observedAt!==o.observedAt||!new RegExp(`\\b${ref.evidenceId}\\b`).test(draft.report))fail('unknown or mismatched observation');
      // Only observed scalar fields; no prototype traversal or model-defined fields.
      if(typeof ref.field!=='string'||!/^(status|title|body|sections\.\d+\.(heading|text)|descriptions\.\d+|h1\.\d+|canonicals\.\d+|robots\.\d+\.(agent|content)|structuredData\.status|structuredData\.blocks\.\d+\.status|headers\.x-robots-tag)$/.test(ref.field))fail('unsupported evidence field');
      let value=o;
      for(const part of ref.field.split('.')){if(value===null||typeof value!=='object'||!Object.hasOwn(value,part))fail('unobserved field');value=value[part];}
      const scalar=typeof value==='string'?value:typeof value==='number'?String(value):null;
      if(scalar===null||typeof ref.excerpt!=='string'||ref.excerpt.length>1000||(!ref.excerpt.length&&scalar!=='')||!scalar.includes(ref.excerpt))fail('excerpt not observed');
    }
  }
  return {version:1,sourceReferencesValid:true,semanticSupportReviewed:false};
}
export function canRequestPayment(draft,evidence){
  try{validateDraft(draft,evidence);return draft.eligible&&draft.taskCount>0&&draft.review?.usefulnessApproved===true&&draft.review?.sourceSupportApproved===true&&validateTaskReview(draft,evidence).approved;}catch{return false;}
}
