import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleReport} from './report.mjs';
const complete='# Audit\n\n## Scope\nPublic page only.\n\n## Evidence\nE1: observed title.\n\n## Tasks\nVerify the title. No-action condition: skip if accurate.\n\n## Measurement\nRecord the deployed title and check it next week.';
test('a complete bounded report retains its measurement plan and agent prompt',()=>{const report=assembleReport(complete);assert.ok(report.includes('check it next week.'));assert.ok(report.includes('## Prompt for your agent'));});
test('missing final sections or a cut sentence never become a prepared report',()=>{assert.throws(()=>assembleReport(complete.slice(0,complete.indexOf('## Measurement'))));assert.throws(()=>assembleReport(complete.slice(0,-4)));assert.throws(()=>assembleReport('#'+'x'.repeat(10000)));});
