// Lab measurements have their own dated identity; never borrow an HTML date.
export function labObservation(performance, requestedUrl, id) {
  if(performance?.status!=='available'||performance.strategy!=='mobile')return null;
  try {
    const requested=new URL(requestedUrl), measured=new URL(performance.requestedUrl), final=new URL(performance.finalUrl);
    if(measured.href!==requested.href||final.protocol!=='https:'||final.origin!==requested.origin||final.username||final.password||!Number.isFinite(Date.parse(performance.observedAt)))return null;
    return {id,kind:'lighthouse_lab',url:final.href,observedAt:performance.observedAt,
      method:'PageSpeed Insights Lighthouse; single mobile laboratory run',
      lab:{strategy:performance.strategy,lighthouseVersion:performance.lighthouseVersion,fetchTime:performance.fetchTime,
        requestedUrl:performance.requestedUrl,finalUrl:performance.finalUrl,performanceScore:performance.performanceScore,
        metrics:performance.metrics,diagnostics:performance.diagnostics},
      limitations:performance.limitations};
  }catch{return null;}
}
export function labField(field,observation){
  return observation.kind==='lighthouse_lab'&&/^lab\.(strategy|lighthouseVersion|fetchTime|requestedUrl|finalUrl|performanceScore|metrics\.(0|[1-9]\d*)\.(id|value|unit|displayValue)|diagnostics\.(0|[1-9]\d*)\.(id|title|description|score|displayValue|savingsMs|savingsBytes))$/.test(field);
}
