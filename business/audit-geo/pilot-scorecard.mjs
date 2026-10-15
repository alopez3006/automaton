import {readFile,appendFile,mkdir,lstat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {summarizeFunnel} from './funnel.mjs';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const cents=value=>Number.isSafeInteger(value)&&value>=0;
const reference=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}$/.test(value);
export function validatePlan(plan){
 if(plan?.version!==1||!stamp(plan.startedAt)||!stamp(plan.reviewAt)||Date.parse(plan.reviewAt)<=Date.parse(plan.startedAt)||plan.targetQualifiedRequests!==10||plan.priceCents!==900||plan.currency!=='eur'||!cents(plan.humanHourlyCostCents)||!cents(plan.maxHumanSecondsPerSale)||typeof plan.automaticDeliveryVerified!=='boolean'||typeof plan.sourcePublicationUnblocked!=='boolean')throw Error('Invalid pilot plan');
 return plan;
}
export function validateWork(row){
 if(!uuid.test(row?.eventId??'')||!stamp(row.observedAt)||!['human','automation'].includes(row.actor)||!Number.isFinite(row.seconds)||row.seconds<0||row.seconds>86400||!(row.requestId===null||uuid.test(row.requestId??''))||!reference(row.evidenceRef)||!['measured_elapsed','measured_human'].includes(row.measurement)||row.actor==='human'&&row.measurement!=='measured_human'||row.actor==='automation'&&row.measurement!=='measured_elapsed')throw Error('Invalid measured work record');
 return row;
}
export async function recordAutomationWork(reports,requestId,started){
 const row={eventId:randomUUID(),observedAt:new Date().toISOString(),requestId,actor:'automation',seconds:Math.max(0,(performance.now()-started)/1000),measurement:'measured_elapsed',evidenceRef:requestId+'.operator-run'};
 validateWork(row);await appendFile(join(reports,'pilot-work.jsonl'),JSON.stringify(row)+'\n',{mode:0o600});
}
export function pilotScorecard(queue,plan,cohort,proofs,work,payment,observedAt=new Date().toISOString()){
 validatePlan(plan);if(!stamp(observedAt))throw Error('Invalid observation time');
 if(payment?.amountCents!==900||payment.currency!=='eur'||typeof payment.paymentLink!=='string'||typeof payment.stripeContext!=='string')throw Error('Invalid existing EUR 9 payment contract');
 const retained=summarizeFunnel(queue,observedAt);
 if(cohort?.version!==1||!Array.isArray(cohort.requestIds)||cohort.requestIds.length>10||new Set(cohort.requestIds).size!==cohort.requestIds.length||cohort.requestIds.some(id=>!uuid.test(id)))throw Error('Invalid private pilot cohort');
 const seenWork=new Set();let humanSeconds=0,automationSeconds=0;
 const measured=work.map(validateWork).filter(row=>{
  if(seenWork.has(row.eventId))throw Error('Duplicate work measurement');seenWork.add(row.eventId);
  return Date.parse(row.observedAt)>=Date.parse(plan.startedAt)&&Date.parse(row.observedAt)<=Date.parse(observedAt);
 });
 for(const row of measured){if(row.actor==='human')humanSeconds+=row.seconds;else automationSeconds+=row.seconds;}
 let qualified=0,missing=0,reviewed=0,refused=0,sales=0,deliveries=0,fees=0,completeHuman=true,completeCosts=true;
 for(const id of cohort.requestIds){
  const job=queue.requests.find(r=>r.id===id),proof=proofs[id];
  const q=proof?.qualification;
  if(!q||q.externalCustomer!==true||q.ownerTest!==false||q.consentVerified!==true||q.segment!==plan.segment||!stamp(q.observedAt)||Date.parse(q.observedAt)<Date.parse(plan.startedAt)||Date.parse(q.observedAt)>Date.parse(observedAt)||!reference(q.evidenceRef))throw Error('External qualification evidence required; never infer it from an email, source label or retained status');
  qualified++;if(!job){missing++;completeHuman=false;completeCosts=false;continue;}
  if(!stamp(job.createdAt)||Date.parse(job.createdAt)<Date.parse(plan.startedAt)||Date.parse(job.createdAt)>Date.parse(q.observedAt))throw Error('Historical or future request cannot enter this experiment');
  const single=summarizeFunnel({requests:[job]});reviewed+=single.inventory.reviewedSummaries;if(job.status==='ineligible')refused++;
  const session=proof.payment?.session;
  const paid=proof.payment?.source==='native-stripe-retrieval'&&stamp(proof.payment.observedAt)&&Date.parse(proof.payment.observedAt)>=Date.parse(q.observedAt)&&Date.parse(proof.payment.observedAt)<=Date.parse(observedAt)&&job.status==='delivered'&&typeof job.paymentReceipt==='string'&&session?.id===job.paymentReceipt&&/^cs_/.test(session.id)&&session.livemode===true&&session.status==='complete'&&session.payment_status==='paid'&&session.currency===payment.currency&&session.amount_total===payment.amountCents&&session.client_reference_id===id&&session.payment_link===payment.paymentLink&&proof.payment.account===payment.stripeContext;
  if(paid){sales++;if(cents(proof.payment.feeCents)&&reference(proof.payment.feeEvidenceRef))fees+=proof.payment.feeCents;else completeCosts=false;}
  if(paid&&proof.delivery?.source==='customer-confirmation'&&proof.delivery.paymentReceipt===session.id&&proof.delivery.reportAccessConfirmed===true&&stamp(proof.delivery.observedAt)&&Date.parse(proof.delivery.observedAt)>=Date.parse(proof.payment.observedAt)&&Date.parse(proof.delivery.observedAt)<=Date.parse(observedAt)&&reference(proof.delivery.evidenceRef))deliveries++;
  if(proof.humanWorkCoverage!=='complete'||!measured.some(r=>r.requestId===id&&r.actor==='human'))completeHuman=false;
  if(!cents(proof.externalCostCents)||!reference(proof.costEvidenceRef))completeCosts=false;
 }
 // Include refused requests and overhead; no work log does not mean zero human work.
 completeHuman=qualified>0&&completeHuman&&cohort.overheadWorkCoverage==='complete'&&measured.some(r=>r.requestId===null&&r.actor==='human');
 completeCosts=qualified>0&&completeCosts&&cents(cohort.overheadExternalCostCents)&&reference(cohort.overheadCostEvidenceRef);
 const revenue=sales*900,secondsPerSale=completeHuman&&sales?humanSeconds/sales:null;
 const external=completeCosts?cohort.requestIds.reduce((n,id)=>n+(proofs[id].externalCostCents??0),cohort.overheadExternalCostCents):null;
 const contribution=completeCosts&&completeHuman?Math.round(revenue-fees-external-humanSeconds*plan.humanHourlyCostCents/3600):null;
 const readiness=plan.automaticDeliveryVerified&&plan.sourcePublicationUnblocked;
 const assisted=plan.deliveryMode==='assisted-native-resend'&&plan.nativeTransactionalChannelVerified===true;
 const expired=Date.parse(observedAt)>=Date.parse(plan.reviewAt);
 const decision=!readiness&&!assisted?'repair_delivery':expired||qualified>=10?missing?'reconcile_missing_evidence':sales===0?'review_segment_and_offer':deliveries<sales?'complete_paid_delivery':secondsPerSale===null||contribution===null?'complete_economic_measurement':secondsPerSale>plan.maxHumanSecondsPerSale||contribution<=0?'review_price_or_operating_cost':'continue_bounded_pilot':assisted&&deliveries===0?'prove_first_assisted_delivery':'collect_qualified_demand';
 return {version:1,observedAt,reviewAt:plan.reviewAt,segment:plan.segment,decision,reviewDue:expired,automaticDeliveryReady:readiness,assistedChannelAvailable:assisted,firstPaidCustomerDeliveryVerified:deliveries>0,retainedInventory:retained.inventory,cohort:{registeredExternalQualified:qualified,target:10,missingFromRetainedPage:missing,reviewedSummaries:reviewed,noUsefulTaskDecisions:refused,verifiedLivePayments:sales,customerConfirmedReportAccess:deliveries},economics:{grossRevenueCents:revenue,recordedHumanSeconds:humanSeconds,recordedAutomationSeconds:automationSeconds,humanCoverageComplete:completeHuman,costCoverageComplete:completeCosts,humanSecondsPerSale:secondsPerSale,estimatedContributionCents:contribution,humanHourlyValuationCents:plan.humanHourlyCostCents},visits:null,visitorConversionRate:null,limitations:['Local evidence register, not authenticated payment verification; native provider retrieval and genuine customer confirmation must be recorded independently.','Retained requests include tests and a bounded first page; only explicitly qualified external requests enter this cohort.','No backfill of work time. Recorded time is partial until coverage is explicitly reconciled, including refusals, support and overhead. Automation elapsed time is not human labor or a cash model bill.','The hourly valuation is an assumption. Contribution stays unknown without human and actual fee/cost coverage.','Public GET events include bots/repeats and cannot supply a unique or qualified visitor denominator. Ten requests are a decision checkpoint, not proof of market fit.','Assisted native email requires a present authorized operator, reconciled event receipts and current capacity. It does not repair automatic Site sending or prove a paid report was received.']};
}
async function optional(path,fallback){try{return JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw Error('Invalid private pilot evidence');}}
async function existingEvidence(reports,name){
 if(!reference(name))throw Error('Private evidence basename required');
 const stat=await lstat(join(reports,name));if(!stat.isFile()||stat.isSymbolicLink())throw Error('Regular private evidence file required');
}
export async function loadPilotScorecard(root,queue){
 const reports=join(root,'.reports'),plan=JSON.parse(await readFile(join(root,'pilot-plan.json'),'utf8')),payment=JSON.parse(await readFile(join(root,'payment.json'),'utf8'));
 const cohort=await optional(join(reports,'pilot-cohort.json'),{version:1,requestIds:[]});const proofs={};
 for(const id of cohort.requestIds??[]){if(!uuid.test(id))throw Error('Invalid cohort request');const p=await optional(join(reports,id+'.pilot-proof.json'),null);proofs[id]=p;
  for(const ref of [p?.qualification?.evidenceRef,p?.payment?.feeEvidenceRef,p?.delivery?.evidenceRef,p?.costEvidenceRef].filter(v=>v!==undefined))await existingEvidence(reports,ref);
 }
 if(cohort.overheadCostEvidenceRef!==undefined)await existingEvidence(reports,cohort.overheadCostEvidenceRef);
 let work=[];try{work=(await readFile(join(reports,'pilot-work.jsonl'),'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch(error){if(error.code!=='ENOENT')throw Error('Invalid measured work ledger');}
 return pilotScorecard(queue,plan,cohort,proofs,work,payment);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,actor,secondsText,evidenceRef,requestIdText]=process.argv.slice(2);
 if(mode!=='work'||actor!=='human'||secondsText===undefined||!reference(evidenceRef)||requestIdText!==undefined&&!uuid.test(requestIdText))throw Error('Use work human <measured seconds> <existing private evidence filename> [request UUID]; omit UUID for overhead');
 const root=fileURLToPath(new URL('.',import.meta.url)),reports=join(root,'.reports');await mkdir(reports,{recursive:true,mode:0o700});
 await existingEvidence(reports,evidenceRef);
 const row=validateWork({eventId:randomUUID(),observedAt:new Date().toISOString(),actor,seconds:Number(secondsText),evidenceRef,requestId:requestIdText??null,measurement:'measured_human'});
 await appendFile(join(reports,'pilot-work.jsonl'),JSON.stringify(row)+'\n',{mode:0o600});console.log(JSON.stringify({recorded:true,actor:row.actor,seconds:row.seconds,scope:row.requestId?'request':'overhead'}));
}
