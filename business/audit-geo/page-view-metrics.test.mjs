import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safePageViewMetrics} from './page-view-metrics.mjs';
const input=()=>({schemaVersion:1,timeZone:'Europe/Zurich',secret:'must-not-leave',days:Array.from({length:7},(_,i)=>({date:`2026-10-${String(14-i).padStart(2,'0')}`,truncated:false,customer:'must-not-leave',counts:{home:1,'guide-audit':2,'guide-visibility':3,privacy:0,secret:'must-not-leave'}}))});
test('only fixed anonymous categories leave remote output',()=>{
 const result=safePageViewMetrics(input());assert.equal(result.days[0].counts.home,1);assert.ok(!JSON.stringify(result).includes('must-not-leave'));
});
test('invalid, overflowing and duplicate-day metrics fail closed',()=>{
 for(const value of [-1,NaN,Infinity,1.5,1001,'4']){const data=input();data.days[0].counts.home=value;assert.throws(()=>safePageViewMetrics(data));}
 const total=input();total.days[0].counts.home=1000;assert.throws(()=>safePageViewMetrics(total));
 const duplicate=input();duplicate.days[0].date=duplicate.days[1].date;assert.throws(()=>safePageViewMetrics(duplicate));
 const bad=input();bad.days[0].date='customer@example.com';assert.throws(()=>safePageViewMetrics(bad));
});
test('calendar dates require strings and real dates, without coercion or rollover',()=>{
 for(const date of [['2026-10-14'],20261014,null,'2026-99-99','2026-02-30','2026-02-29']){
  const data=input();data.days[0].date=date;assert.throws(()=>safePageViewMetrics(data));
 }
 const missing=input();missing.days[0]=null;assert.throws(()=>safePageViewMetrics(missing));
});
test('a seven-day window must be consecutive and ordered newest first',()=>{
 const gap=input();gap.days[3].date='2026-10-01';assert.throws(()=>safePageViewMetrics(gap));
 const reverse=input();reverse.days.reverse();assert.throws(()=>safePageViewMetrics(reverse));
});
test('valid calendar windows cross leap-day and year boundaries',()=>{
 for(const dates of [
  ['2024-03-02','2024-03-01','2024-02-29','2024-02-28','2024-02-27','2024-02-26','2024-02-25'],
  ['2026-01-03','2026-01-02','2026-01-01','2025-12-31','2025-12-30','2025-12-29','2025-12-28']
 ]){const data=input();data.days.forEach((row,i)=>{row.date=dates[i];});assert.deepEqual(safePageViewMetrics(data).days.map(row=>row.date),dates);}
});
