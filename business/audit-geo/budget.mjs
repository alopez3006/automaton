import {fileURLToPath} from 'node:url';
import { businessBudget, updateExpense } from '../../dist/business/budget.js';
const workspace=fileURLToPath(new URL('../../',import.meta.url));
const [action='status',first,second,third]=process.argv.slice(2);
if(action==='status')console.log(JSON.stringify(await businessBudget(workspace)));
else if(action==='reserve')console.log(JSON.stringify(await updateExpense(workspace,'reserve',{cents:Number(first),purpose:second})));
else if(action==='commit')console.log(JSON.stringify(await updateExpense(workspace,'commit',{id:first,cents:Number(second),proof:third,runId:process.env.AUTOMATON_RUN_ID})));
else if(action==='release')console.log(JSON.stringify(await updateExpense(workspace,'release',{id:first})));
else throw Error('Use status | reserve <EUR cents incl fees> <purpose> | commit <id> <actual cents> <receipt reference> | release <id>');
