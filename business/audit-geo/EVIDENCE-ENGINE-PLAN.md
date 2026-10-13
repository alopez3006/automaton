# Public evidence engine — owner proposal review, 13 October 2026

The EUR 9 pilot should use a small public evidence engine. No additional paid model API or SEO data platform is required: the existing official Codex CLI OAuth adapter already produces structured report output. This is a capability review and partial local implementation, not proof that every proposed component exists.

| Component | Verified current state | Remaining work |
|---|---|---|
| HTTP and HTML | HTTPS status, final URL, metadata, H1, canonicals, X-Robots-Tag, JSON-LD, internal-link/sitemap discovery; requested page plus up to four same-origin pages | Record redirect chain, use a proper HTML parser instead of regex extraction, choose representative pages rather than first links; follow declared sitemap locations with bounds |
| Browser rendering | Existing manual local Lighthouse run; Playwright is not resolvable in this operator checkout | Integrate a bounded browser worker with public-target validation for redirects and all subrequests; compare raw/rendered content and retain screenshots; no browser/customer session reuse |
| robots.txt | Added per-observed-page evaluation for Googlebot, OAI-SearchBot, Claude-SearchBot, GPTBot and ClaudeBot; specific/wildcard groups, merged repeated groups, longest rule, allow ties, wildcard/end anchors and percent encoding | Bounded evaluator, not a full crawler emulator. Unsupported path syntax, fetch failures and non-200 responses remain unknown. Bot cache, CDN/WAF access and actual search inclusion remain unmeasured |
| Structured inference | Official Codex OAuth; English report, eligible flag, zero to three tasks, bounded output and task-count checks | Deterministic task ID/URL/date/field/excerpt validator is now implemented locally. Model citation instructions do not prove citations or entailment. Do not auto-open checkout from model eligibility alone |
| Evidence register | Stable E1… IDs, URL, observation date, method, bounded response excerpts, extraction limits; robots rules linked to E2 | Field-level scalar references and machine validation added; preserve raw/rendered distinction and lab/field distinction |
| PageSpeed/Lighthouse | Optional mobile API diagnostics and separate page/origin field availability; local owned-domain baseline obtained previously | API quota previously 429; local Lighthouse not yet integrated into customer collection. Desktop strategy remains absent |
| CrUX | Missing field data is explicitly unavailable | No dedicated CrUX API integration; unavailable data is unknown, never zero or bad performance |
| axe-core | No integrated scan | Optional later addition; automated findings are not comprehensive accessibility certification |
| Search Console, GA4, DataForSEO | Outside the core public audit | Keep customer account access and broader SEO/AI observation products for an explicitly scoped extension |

## Interpretation rules

Use “allowed according to the observed robots.txt” rather than “accessible to ChatGPT.” A training opt-out is not automatically a search opt-out. Observed robots policy alone cannot prove indexing, actual fetches, mentions or business results. A non-200 robots response is recorded conservatively as unknown for this multi-bot audit; this does not assert that Google treats every HTTP error identically.

JSON parsing is not schema validation. A missing field in raw HTML is not proof of absence after JavaScript. Content recommendations must remain limited to the sampled public claims, audiences, titles, answers and consistency. Task usefulness and source fidelity still need review.

## Next acceptance gates

1. Structured task-reference checks now reject invented IDs, URLs, dates, fields and excerpts. Review factual support and usefulness independently before payment; the local draft requires review.sourceSupportApproved and review.usefulnessApproved, neither accepted from inference. Legacy drafts without structured tasks fail closed. These checks prove source presence, not semantic entailment.
2. Add safe browser rendering with bounded time, pages, bytes and requests. Test JS-only content, redirects and private-address attempts before enabling customer collection.
3. Generate and review one genuinely useful report, with no forced task count, before opening checkout. Add mobile/desktop lab diagnostics when reliably available; field data remains optional.

## Current pass proof

13 fixture tests pass, including search/training separation, wildcard fallback, repeated groups, longest-match/allow tie, URL query/case/encoding, unavailable rules and full robots rules beyond the excerpt limit. The owned domain returned HTTP 200 for the homepage and two discovered resources; robots.txt and sitemap.xml returned 404. The new evaluator correctly reported unknown policy rather than claiming crawler access. One queue pass prepared zero reports; cumulative attempts remained three. No external purchase or sales activation.

## Primary sources checked

- [Google robots matching and HTTP behavior](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec).
- [OpenAI crawler purposes](https://developers.openai.com/api/docs/bots): OAI-SearchBot search and GPTBot training are separate controls.
- [Anthropic crawler purposes](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler): Claude-SearchBot and ClaudeBot serve different purposes.
- [Google common crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers): Googlebot controls apply to Search features.

Official sources were read with the connected web tool; Agent Reach's Jina reader also retrieved the OpenAI documentation. No vendor purchase or subscription was considered necessary.
