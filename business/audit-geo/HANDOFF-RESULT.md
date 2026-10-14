# HTML evidence media type — local collector correction

Hypothesis: exact media-type recognition avoids losing useful SEO evidence from HTML/XHTML responses and prevents lookalike non-HTML responses from being labelled HTML.

Action: replaced case-sensitive substring classification with an exact normalized HTML/XHTML media-type check in evidence.mjs. Existing bounded extraction, request budget, network confinement and private report/payment gates remain intact. Artifact: HTML-MEDIA-ACCEPTANCE.json, source and regression controls.

Verification: reproduced two false-negative and two false-positive types in the previous predicate. Five positive variants retain title, description, canonical, heading and JSON-LD evidence; six negative variants retain raw responses without inventing HTML fields. All 52 collector/network/robots/report controls pass; syntax and diff checks pass. Synthetic fixtures prove classification, not actual customer usefulness or complete XHTML parsing. No deployment needed for this local operator change; public site remains version 18 and the prior measurement patch remains unpublished.

Alternatives evaluated: owned discovery pages, crawl resources, mobile baseline and guide labels are completed; indexing observation is due 21 October. Anonymous GET publication requires the already requested accepted secure channel; no credential/helper retry. External LinkedIn posting remains the owner's manual action. Commercial conversion and delivery activation still require a genuinely useful reviewed report and current capacity; no invented report, email test or sale. Selected a reproduced report-evidence defect that can be fixed independently.

Measurable follow-up: next genuine request records recognized HTML/XHTML pages and independently reviewed tasks retained, revised or removed because of newly available evidence. Existing snapshots do not migrate. Count actual outcomes only; no ranking/citation promise.

Owner inbox empty at initial and verification checkpoints. Safe hosted broker recall initially failed restricted DNS, then succeeded with authorized network access. Counters, budget and production flags preserved. No inference attempt, customer submission, email, payment, purchase, publication, external post or new schedule/controller. This pass external spending: EUR 0.

Remaining dependencies: accepted publication channel for public GET patch; useful reviewed report before checkout launch; actual customer-authorized payment-to-delivery evidence. Existing questions remain pending without duplication.

Supervisor reconciliation: 2026-10-14T12:31:40.816Z — Supervisor independently confirmed 52 collector/network/robots/report controls, syntax/diff and exact source hash for G29 HTML/XHTML classification. Five supported MIME variants and six non-HTML/lookalike variants retain their declared proof boundaries; bounded extraction is not complete XHTML parsing. Existing source-transfer rejection/question and reviewed public GET patch remain unchanged; no credential or helper retry, Site request, deployment, inference, email, payment, purchase, token rotation or counter reset. Original controller receipt retained.
