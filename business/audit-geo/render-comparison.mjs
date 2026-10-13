// Compare only bounded fields from the exact response rendered by Chromium.
// This is an observation of serialization/content changes, not crawler visibility.
export function compareRenderedHtml(raw,rendered,{url,observedAt}={}) {
  const fields=['title','descriptions','h1','canonicals','robots','structuredData'];
  const changes=[];
  for(const field of fields){
    const before=field==='structuredData'?raw[field]?.blocks:raw[field];
    const after=field==='structuredData'?rendered[field]?.blocks:rendered[field];
    if(JSON.stringify(before)!==JSON.stringify(after))changes.push({field,before,after});
  }
  return {status:'available',url,observedAt,method:'Bounded extracted fields from final navigation response versus Chromium DOM',fieldsCompared:fields,changes,limitations:['Same navigation response; not a comparison of separate HTTP crawls','HTML parser normalization or JavaScript can cause changes; causality is unmeasured','Only bounded metadata, H1 and JSON-LD blocks compared; matching fields do not prove matching full content','No indexing, ranking or actual search/AI crawler visibility measured']};
}
