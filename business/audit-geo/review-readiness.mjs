import {readFile,readdir,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateDraft,canRequestPayment,hasCurrentApprovedReview} from './validate-draft.mjs';
import {assembleReport} from './report.mjs';

// Only fixed categories leave private storage; never echo report text or exceptions.
export function diagnoseReadiness(draft,evidence){
 let references=false,complete=false;
 try{validateDraft(draft,evidence);references=true;}catch{}
 try{assembleReport(draft?.report);complete=true;}catch{}
 const reviewed=references&&hasCurrentApprovedReview(draft,evidence);
 return {referencesValid:references,reportComplete:complete,currentReviewApproved:reviewed,
  locallyReady:canRequestPayment(draft,evidence)};
}
async function privateJson(path){
 const stat=await lstat(path);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2000000)throw Error('Unavailable snapshot');
 return JSON.parse(await readFile(path,'utf8'));
}
export async function summarizeReadiness(directory){
 const totals={snapshots:0,unreadable:0,invalidReferences:0,incompleteReports:0,notCurrentlyApproved:0,locallyReady:0};
 for(const name of await readdir(directory)){
  if(!/^[a-f0-9-]{36}\.draft\.json$/.test(name))continue;
  totals.snapshots++;
  try{
   const draft=await privateJson(join(directory,name));
   const evidence=await privateJson(join(directory,name.replace('.draft.json','.evidence.json')));
   const result=diagnoseReadiness(draft,evidence);
   if(!result.referencesValid)totals.invalidReferences++;
   if(!result.reportComplete)totals.incompleteReports++;
   if(!result.currentReviewApproved)totals.notCurrentlyApproved++;
   if(result.locallyReady)totals.locallyReady++;
  }catch{totals.unreadable++;}
 }
 return {version:1,observedAt:new Date().toISOString(),totals,limits:[
  'Local retained draft snapshots only; not current server status or a customer-only cohort.',
  'Failure counts overlap. Unreadable pairs are excluded from other checks.',
  'No semantic review, reviewer authentication, payment authorization or delivery proof.',
  'No writes, inference, network calls or credential reads.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(process.argv.length>3)throw Error('Unexpected arguments');
  console.log(JSON.stringify(await summarizeReadiness(process.argv[2]??new URL('./.reports/',import.meta.url).pathname),null,2));
 }catch{console.error('Readiness inventory unavailable; no private details emitted.');process.exitCode=1;}
}
