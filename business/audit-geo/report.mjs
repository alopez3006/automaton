function reportProse(content) {
  // Code examples and comments cannot supply the report's own sections.
  const lines=content.replace(/<!--[\s\S]*?-->/g,'').split(/\r?\n/);
  const sections=[],prose=[];let fence=null,current=null;
  for(const line of lines){
    const marker=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if(fence){if(marker&&marker[1][0]===fence[0]&&marker[1].length>=fence.length&&!marker[2].trim())fence=null;continue;}
    if(marker){fence=marker[1];continue;}
    const heading=line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if(heading&&heading[1].length<=2){
      current=heading[1].length===2?{title:heading[2],body:[]}:null;
      if(current)sections.push(current);
    }else if(!heading){prose.push(line);if(current)current.body.push(line);}
  }
  return {sections,prose:prose.join('\n')};
}
function hasRequiredSectionContent(sections) {
  const required=['scope','evidence','task','measurement'];
  return required.every(name=>sections.some(section=>
    new RegExp(`\\b${name}`, 'i').test(section.title)&&
    required.filter(term=>new RegExp(`\\b${term}`, 'i').test(section.title)).length===1&&
    /[\p{L}\p{N}]/u.test(section.body.join('\n'))));
}
export function assembleReport(content) {
  if(typeof content!=='string'||content.length>10000||!content.startsWith('#'))throw Error('Report requires review: unexpected output');
  const {sections,prose}=reportProse(content);
  if(!hasRequiredSectionContent(sections)||!/\bno[- ]action\b/i.test(prose)||!/[.!?]["'”’*_`)]*\s*$/u.test(prose))throw Error('Report requires review: incomplete report');
  return content+'\n\n## Prompt for your agent\n\nInspect the attached report and verify each cited finding in my repository or CMS before making changes. Execute only the supported tasks above, at most three; if none are supported, return no action. Do not invent claims, customers, schema or ranking results. Show the proposed diff and checks before publishing. Next week verify previous execution and new evidence before recommending any further change.\n';
}
