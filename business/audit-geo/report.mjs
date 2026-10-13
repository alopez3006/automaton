export function assembleReport(content) {
  if(typeof content!=='string'||content.length>10000||!content.startsWith('#'))throw Error('Report requires review: unexpected output');
  if(!/^## .*scope/im.test(content)||!/^## .*evidence/im.test(content)||!/^## .*task/im.test(content)||!/^## .*measurement/im.test(content)||!/no[- ]action/i.test(content)||!/[.!?]["'”’*_`)]*\s*$/u.test(content))throw Error('Report requires review: incomplete report');
  return content+'\n\n## Prompt for your agent\n\nInspect the attached report and verify each cited finding in my repository or CMS before making changes. Execute only the supported tasks above, at most three; if none are supported, return no action. Do not invent claims, customers, schema or ranking results. Show the proposed diff and checks before publishing. Next week verify previous execution and new evidence before recommending any further change.\n';
}
