import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleReport} from './report.mjs';
const complete='# Audit\n\n## Scope\nPublic page only.\n\n## Evidence\nE1: observed title.\n\n## Tasks\nVerify the title. No-action condition: skip if accurate.\n\n## Measurement\nRecord the deployed title and check it next week.';
test('a complete bounded report retains its measurement plan and agent prompt',()=>{const report=assembleReport(complete);assert.ok(report.includes('check it next week.'));assert.ok(report.includes('## Prompt for your agent'));});
test('missing final sections or a cut sentence never become a prepared report',()=>{assert.throws(()=>assembleReport(complete.slice(0,complete.indexOf('## Measurement'))));assert.throws(()=>assembleReport(complete.slice(0,-4)));assert.throws(()=>assembleReport('#'+'x'.repeat(10000)));});
test('every required section must have its own substantive body',()=>{
  for(const title of ['Scope','Evidence','Tasks','Measurement']){
    const empty=complete.replace(new RegExp(`(## ${title}\\n)[\\s\\S]*?(?=\\n## |$)`),'$1\n');
    assert.throws(()=>assembleReport(empty+'\n## End\nFinished.'),/incomplete report/,title);
  }
  assert.throws(()=>assembleReport('# Audit\n## Scope Evidence Tasks Measurement\nNo-action: keep current content.'),/incomplete report/);
});
test('comments, code fences, headings and punctuation do not fill empty sections',()=>{
  for(const filler of ['<!-- Sample only. -->','```text\nSample only.\n```','~~~~text\nSample only.\n~~~~','### Sample only','---\n> **...**']){
    assert.throws(()=>assembleReport(complete.replace('Public page only.',filler)),/incomplete report/,filler);
  }
  assert.throws(()=>assembleReport('# Audit\n```markdown\n'+complete+'\n```\nNo-action: retain everything.'),/incomplete report/);
});
test('valid CRLF, subsection prose and fenced examples remain acceptable',()=>{
  assert.ok(assembleReport(complete.replace('Public page only.','### Sampling\nPublic page only.\n```html\n<h1>Example</h1>\n```').replaceAll('\n','\r\n')).includes('Prompt for your agent'));
});
