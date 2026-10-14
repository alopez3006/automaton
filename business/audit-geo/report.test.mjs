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
test('hidden examples and headings cannot supply the no-action instruction',()=>{
  const missing=complete.replace(' No-action condition: skip if accurate.','');
  for(const hidden of ['<!-- No-action: skip if accurate. -->','```text\nNo-action: skip if accurate.\n```','~~~~text\nNo-action: skip if accurate.\n~~~~','### No-action condition']){
    assert.throws(()=>assembleReport(missing+'\n'+hidden+'\nFinished.'),/incomplete report/,hidden);
  }
  assert.throws(()=>assembleReport(missing+'\nUnrelated techno-action wording.'),/incomplete report/);
});
test('hidden punctuation cannot finish a truncated prose ending',()=>{
  for(const hidden of ['<!-- Finished. -->','```text\nFinished.\n```','~~~~text\nFinished.\n~~~~','### Finished.']){
    assert.throws(()=>assembleReport(complete.slice(0,-1)+'\n'+hidden),/incomplete report/,hidden);
  }
  assert.ok(assembleReport(complete+'\n```html\n<span>Example</span>\n```').includes('Prompt for your agent'));
});
test('comments extending to end of input cannot supply completion requirements',()=>{
  const missing=complete.replace(' No-action condition: skip if accurate.','');
  assert.throws(()=>assembleReport(missing+'\n<!-- No-action: skip if accurate.'),/incomplete report/);
  assert.throws(()=>assembleReport(complete.slice(0,-1)+'\n<!-- Finished.'),/incomplete report/);
  assert.throws(()=>assembleReport(complete.replace('Record the deployed title and check it next week.','<!-- Record the title.')),/incomplete report/);
  assert.throws(()=>assembleReport(complete+'\n<!-- Unfinished administrative note'),/incomplete report/);
  assert.ok(assembleReport(complete.replace('Public page only.','<!-- Closed note. -->\nPublic page only.')).includes('Prompt for your agent'));
});
test('comment delimiters inside fenced examples do not consume following report sections',()=>{
  for(const fence of ['```','~~~~']){
    for(const info of ['html','html <!-- Literal opener information']){
      const report=complete.replace('Public page only.',`Public page only.\n${fence}${info}\n<!-- Literal unfinished comment example\n${fence}`);
      assert.ok(assembleReport(report).includes('Prompt for your agent'));
    }
  }
});
test('unfinished comments or fences cannot capture the appended agent prompt',()=>{
  for(const tail of ['<!-- Unfinished note','```text\nExample.','~~~~html\nExample.']){
    assert.throws(()=>assembleReport(complete+'\n'+tail),/incomplete report/);
  }
});
test('fence-like text inside a closed comment cannot open a report example',()=>{
  const report=complete.replace('Public page only.','<!-- Hidden note.\n```html\nNo-action: hidden instruction.\n-->\nPublic page only.');
  assert.ok(assembleReport(report).includes('Prompt for your agent'));
});
