# SEO/GEO review improvement — 14 October 2026

## Diagnosis from the current pipeline

The most useful next improvement is a task-level evidence review, rather than another score or a larger report. `validate-draft.mjs` verifies observation identity, date, field and exact excerpt. `preview.mjs` requires independent severity reasons. Neither establishes that a quoted passage entails the proposed defect, that all relevant counterevidence was examined, or that the fix will improve search or AI visibility. The independent reviewer supplies those judgments; approval booleans alone are not a review record.

`evidence.mjs` rejects responses above 120000 bytes, retains the first 16000 characters of cleaned HTML, and retains up to ten JSON-LD blocks of at most 12000 characters each. A failed fetch is unavailable; a successful fetch may still have an incomplete body excerpt. Metadata and JSON-LD extraction examine the fetched HTML before the body excerpt is shortened. Review each field's coverage separately. A body excerpt cannot establish absence of pricing, answers or supporting claims elsewhere on a page. Browser rendering remains disabled for customers under the current mission.

This assessment inspects local implementation and existing tests. It is not a new audit of any customer website, an independent reproduction of an existing report, or a measured SEO/GEO result.

## Apply to the next real prepared report

1. **Freeze the input.** Use the saved private evidence and draft. Record collector mode, observation dates, sampled URLs, errors and truncation flags. Do not overwrite old evidence with a new fetch or silently compare different navigations. Keep the record beside the existing private job files; never publish identifiers or links in operational documentation or memory.
2. **Review all proposed tasks, at most three.** Read the cited scalar in context, then examine counterevidence in the retained sample. Classify the claim as an observed defect, a conditional clarification, a hypothesis, or unknown. Check the target, product assumptions, proposed change, acceptance criteria and no-action condition. A syntactically valid quote that does not support the claim fails semantic review.
3. **Reproduce decisive technical findings when feasible.** Use the same bounded public collector and record a new date separately. For robots, record the exact bot role, URL path and matching policy; for canonical/noindex, inspect the relevant response and field; for JSON-LD distinguish invalid JSON from schema or business-fact errors. A changed response is changed evidence, not retrospective proof. Failed rechecks remain unknown. Do not add a paid API or unsafe fetch to overcome a limit.
4. **Resolve incomplete evidence before prescribing absence fixes.** If relevant material lies outside the retained body or failed byte ceiling, withhold that absence claim. A targeted bounded passage extractor is a future implementation, not currently available. Independently available public evidence can be recorded with its method and date, but cannot be inserted as an invented collector observation.
5. **Rate utility and severity separately.** Explain what the customer can verify and change, and why it matters within this sampled audit. A copy clarification stays minor unless material harm is demonstrated. Remove tasks that merely add generic FAQ/schema content, restate a collector limitation, or predict citations without evidence. Zero surviving useful tasks means no payment request.
6. **Review the final report after edits.** Ensure each surviving task, reference and severity agrees with the report and unpaid counts. Re-run source validation, report completeness and preview checks. The current validators do not synchronize prose or prove semantic support. Set the existing approvals only after this review; this procedure does not change the runtime contract.

## Private review record template

Copy into private job storage, not this public repository. This is a companion Markdown record; do not add these fields to the runtime JSON without an implemented and tested schema change.

```text
Review date / reviewer / collector mode:
Saved evidence dates / sampled pages / omissions:
Reproduced observations (ID, method, recheck date, result):
Source-only or unchecked observations (ID, reason):
Collection limits and affected claims:

For EACH proposed task:
Title / proposed severity:
Exact observation and context:
Counterevidence examined / scope still unknown:
Semantic support: supported | conditional | unsupported | unknown
Concrete value / product assumptions verified:
Change / acceptance criteria / no-action condition:
Decision: keep | revise | remove
Independent severity / reason:

Final surviving tasks / eligibility / reason:
Source validation / completeness / preview check results:
Unmeasured outcomes / follow-up method:
```

## Controls for a future structured review gate

| Control | Required reviewer outcome |
|---|---|
| Valid title quote attached to an unrelated recommendation | Reject semantic support despite valid reference syntax. |
| Price absent from a truncated body excerpt | Unknown; no missing-pricing task. |
| Over-limit page response | Collection limitation; no website defect or critical severity. |
| Training bot disallowed but search bot allowed | Separate roles; no claim that search or consumer AI access is blocked. |
| Parsed JSON-LD with an unsupported product claim | Parsing succeeds; business claim still requires verification. |
| Ambiguous wording accurately describes intended behavior | Apply no-action condition; do not manufacture a fix. |
| Demonstrated noindex on a page intended for indexing | Supported technical task; severity still requires intent and scope evidence. |
| Complete sample with no useful supported task | Ineligible; no checkout. |

These are acceptance cases to implement with synthetic fixtures before changing payment gates. They have not been run as a semantic benchmark. Include unseen controls when evaluating the generic change; do not tune only to one report.

## Measure and prioritize

For the next real reviewed reports, record proposed task count, kept/revised/removed counts, removal reasons, reproduced decisive claims over claims requiring reproduction, unknown claims, severity corrections and review duration. Publish only anonymous aggregates with denominators. A high keep rate is not a target: removing weak recommendations is a good outcome. No quality percentage or baseline is claimed yet.

First apply this record to incoming reports without spending another inference attempt just for a demonstration. Next, implement a structured per-task review gate so aggregate approvals cannot hide an unsupported task; retain legacy drafts as review-needed until migrated. Then evaluate bounded heading/passages extraction and page sampling on representative fixtures to reduce excerpt blindness. Optional rendering follows its separate safety gates. More output or a heuristic citability score does not substitute for these checks.

SEO/GEO effects need a separately authorized baseline and follow-up: indexing evidence, search performance, or reproducible citation observations with query/date/platform and uncertainty. Without customer data/access, report them as unmeasured. Preparation and reviewer agreement measure audit quality, not customer ranking or AI visibility.
