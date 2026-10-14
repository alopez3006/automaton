function reportProse(content) {
  // Code examples and comments cannot supply the report's own sections.
  const lines=content.split(/\r?\n/);
  const sections=[],prose=[];let fence=null,current=null,commentOpen=false;
  for(const line of lines){
    // Literal comment delimiters in a fenced example do not affect later prose.
    const rawMarker=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if(fence){if(rawMarker&&rawMarker[1][0]===fence[0]&&rawMarker[1].length>=fence.length&&!rawMarker[2].trim())fence=null;continue;}
    if(!commentOpen&&rawMarker){fence=rawMarker[1];continue;}
    let visible='',cursor=0;
    while(cursor<line.length){
      if(commentOpen){
        const end=line.indexOf('-->',cursor);
        if(end<0)break;
        commentOpen=false;cursor=end+3;
      }else{
        const start=line.indexOf('<!--',cursor);
        if(start<0){visible+=line.slice(cursor);break;}
        visible+=line.slice(cursor,start);commentOpen=true;cursor=start+4;
      }
    }
    const marker=visible.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if(marker){fence=marker[1];continue;}
    const heading=visible.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if(heading&&heading[1].length<=2){
      current=heading[1].length===2?{title:heading[2],body:[]}:null;
      if(current)sections.push(current);
    }else if(!heading){prose.push(visible);if(current)current.body.push(visible);}
  }
  return {sections,prose:prose.join('\n'),incompleteMarkup:Boolean(fence||commentOpen)};
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
  const {sections,prose,incompleteMarkup}=reportProse(content);
  if(incompleteMarkup||!hasRequiredSectionContent(sections)||!/\bno[- ]action\b/i.test(prose)||!/[.!?]["'”’*_`)]*\s*$/u.test(prose))throw Error('Report requires review: incomplete report');
  return content+'\n\n## Prompt for your agent\n\nInspect the attached report and verify each cited finding in my repository or CMS before making changes. Execute only the supported tasks above, at most three; if none are supported, return no action. Do not invent claims, customers, schema or ranking results. Show the proposed diff and checks before publishing. Next week verify previous execution and new evidence before recommending any further change.\n';
}
