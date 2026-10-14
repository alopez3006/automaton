import {reviewDigest} from './task-review.mjs';
// Synthetic reviewer record for contract tests, never a production approval.
export function approveFixture(draft,evidence){
 draft.review={version:2,reviewer:'Synthetic fixture',reviewedAt:'2026-10-14T00:00:00Z',inputDigest:reviewDigest(draft,evidence),sourceSupportApproved:true,usefulnessApproved:true,findings:draft.tasks.map(task=>({title:task.title,decision:'keep',semanticSupport:'conditional',severity:'low',reason:'Minor clarification only.',supportReason:'Observed wording supports a conditional clarification.',evidenceIds:[...new Set(task.references.map(r=>r.evidenceId))],counterevidence:'Intended behavior could already agree; verify before changing.',coverage:'Saved raw HTML sample only; wider site unknown.',value:'Clarify the sampled public description if intent differs.',change:'Align the description with verified intended behavior.',acceptance:'Description matches independently verified product intent.',noAction:'Keep the wording if it accurately describes intended behavior.',reproduction:{status:'source_only',reason:'Saved source examined; no live reproduction claimed.'}}))};
 return draft;
}
