// Bounded robots policy evaluation, not a probe from a crawler's infrastructure.
export const auditBots = [
  {agent:'Googlebot',usage:'search'}, {agent:'OAI-SearchBot',usage:'search'},
  {agent:'Claude-SearchBot',usage:'search'}, {agent:'GPTBot',usage:'training'},
  {agent:'ClaudeBot',usage:'training'}
];
function normalize(value) {
  return value.replace(/%[0-9a-f]{2}/gi, encoded => {
    const character=String.fromCharCode(parseInt(encoded.slice(1),16));
    return /[a-z0-9._~-]/i.test(character)?character:encoded.toUpperCase();
  });
}
const specificity=path=>normalize(path).replace(/[*$]/g,'').replace(/%[0-9A-F]{2}/g,'x').length;
export function evaluateRobots(observation, targets) {
  const limitations=['Policy according to the observed robots.txt only; not actual crawler access, indexing or AI citations','CDN, firewall, crawler caches and bot-specific behavior are unmeasured'];
  if(!observation || observation.error || observation.status!==200 || observation.bodyTruncated || /<\s*(?:html|!doctype)/i.test(observation.body??''))
    return {status:'unknown',source:observation?.url,observedAt:observation?.observedAt,reason:'Complete successful plain robots rules unavailable; no bot access conclusion',limitations,evaluations:[]};
  const groups=[];let current=null,hasRules=false;
  for(const [index,line] of observation.body.replace(/^\uFEFF/,'').split(/\r\n|\r|\n/).entries()) {
    const match=line.split('#')[0].trim().match(/^([\w-]+)\s*:\s*(.*)$/);
    if(!match)continue;
    const key=match[1].toLowerCase(),value=match[2].trim();
    if(key==='user-agent') {
      if(!current||hasRules){current={agents:[],rules:[]};groups.push(current);hasRules=false;}
      current.agents.push(value.toLowerCase());
    } else if(current && ['allow','disallow'].includes(key)) {
      hasRules=true;
      if(value)current.rules.push({directive:key,path:value,line:index+1});
    }
  }
  const evaluations=[];
  for(const target of targets)for(const bot of auditBots) {
    const url=new URL(target);
    if(url.origin!==new URL(observation.url).origin){evaluations.push({...bot,url:target,status:'unknown',reason:'Different origin'});continue;}
    const specific=groups.filter(g=>g.agents.includes(bot.agent.toLowerCase()));
    const selected=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
    const rules=selected.flatMap(g=>g.rules);
    // Conservatively reject syntax whose matching semantics this bounded evaluator does not support.
    if(rules.some(r=>!r.path.startsWith('/')||/[^\x20-\x7e]/.test(r.path)||/%(?![0-9a-f]{2})/i.test(r.path))){evaluations.push({...bot,url:target,status:'unknown',reason:'Unsupported path syntax in applicable group'});continue;}
    const path=normalize(url.pathname+url.search);
    const matching=rules.filter(r=>{
      const p=normalize(r.path),end=p.endsWith('$');
      const pattern=(end?p.slice(0,-1):p).split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');
      return new RegExp('^'+pattern+(end?'$':'')).test(path);
    }).sort((a,b)=>specificity(b.path)-specificity(a.path) || (a.directive==='allow'?-1:1));
    const rule=matching[0];
    evaluations.push({...bot,url:target,status:rule?.directive==='disallow'?'disallowed_according_to_robots_txt':'allowed_according_to_robots_txt',matchedRule:rule??null,group:specific.length?'specific':'wildcard_or_default'});
  }
  return {status:'evaluated',source:observation.url,observedAt:observation.observedAt,method:'Bounded static robots.txt rule evaluation',limitations,evaluations};
}
