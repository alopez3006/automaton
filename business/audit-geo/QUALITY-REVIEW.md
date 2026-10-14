# Report quality review

Read-only launch diagnostic: `node business/audit-geo/review-readiness.mjs` reads local retained draft/evidence pairs and prints anonymous counts for references, report completeness and current approval. It never writes reviews or requests payment. Counts overlap and include any retained tests/ineligible drafts; they are not a customer cohort, server status or semantic acceptance. Optional argument selects a fixture directory. The dated baseline is REVIEW-READINESS-BASELINE.json. Use this to identify review prerequisites before running an authorized invitation workflow; no synthetic approval may replace the independent review.

Use this checklist alongside the existing source-reference validator and independent review gates. It is a reviewer procedure, not an automated approval or evidence of SEO/GEO performance. Public reports remain English.

Apply the task-level procedure in [REVIEW-IMPROVEMENT.md](REVIEW-IMPROVEMENT.md). The local payment eligibility gate now requires the structured version-2 record below. This validates review completeness and snapshot identity, not the truth of reviewer judgments.

## Implemented private review contract — 14 October 2026

`canRequestPayment` and therefore `reviewedPreview` reject legacy aggregate-only approvals. Model review fields are still discarded by the operator. An independent reviewer must first validate source references and read the final report, then save `draft.review` in the existing private job storage with:

- `version: 2`, nonempty `reviewer`, parseable `reviewedAt`, existing `sourceSupportApproved: true` and `usefulnessApproved: true`.
- `inputDigest: reviewDigest(draft, evidence)` from `task-review.mjs`, computed on the final draft and saved evidence. Review fields are excluded. Any report/task/evidence change requires a new review. Serialization order is significant; preserve the saved JSON snapshot. This digest is not authentication or a signature.
- `findings`: exactly one record per task in the same order. Each has the exact `title`, `decision: "keep"`, `semanticSupport: "supported" | "conditional"`, independent `severity: "critical" | "medium" | "low"`, and the exact unique set of referenced `evidenceIds`.
- Every finding includes nonempty `reason`, `supportReason`, `counterevidence`, `coverage`, `value`, `change`, `acceptance`, and `noAction` strings, each at most 4000 characters. Record examined counterevidence and unknown scope honestly; absence from a partial excerpt is not an absence finding.
- `reproduction: {status: "reproduced" | "source_only" | "unknown", reason: "method/date/result or explicit limitation"}`. Critical additionally requires supported semantics, reproduced status and `intendedIndexing: true`. Unknown decisive evidence still fails source-support approval; a source-only minor clarification need not claim live reproduction.

Unsupported/unknown semantics or revise/remove decisions cannot authorize payment. Edit/remove those tasks, align final report/counts/eligibility, and review the new snapshot. Zero useful tasks stays ineligible. `validateTaskReview` returns bounded per-task rejection reasons for review diagnostics. Measure these on real reviews; no production quality score is claimed.

Do not use `task-review-fixture.mjs` for actual approvals: it supplies synthetic test records only. Existing server-side summaries or already pending payments are not retroactively revoked by this local change. Re-review any legacy prepared draft before a new invitation or commercial activation; preserve verified-payment delivery obligations. No production approval or private job migration was performed in this pass.

## Evidence and scope

- Record which observations the reviewer actually reproduced, their dates and methods. Separate reproduced observations, source-only checks and unchecked claims. A positive overall opinion cannot approve unchecked evidence.
- Treat a response rejected for exceeding the fetch byte limit as unavailable evidence. Treat retained body excerpts and structured-data limits as partial evidence. Neither condition establishes a website defect. Do not infer missing pricing, content or markup from an incomplete sample.
- State the sampled pages and omissions. Raw HTML does not establish rendered content. JSON parsing does not establish schema validity. Robots permissions do not establish indexing, ranking, crawler visits or consumer AI citations.
- A current source-code comparison can inform a copy review, but does not reproduce the dated public response or prove deployed behavior. Preserve this distinction in the review record.

## Useful tasks and independent severity

- Require an exact supported observation, a concrete proposed change, acceptance criteria and a no-action condition for every task. Check semantic support and practical usefulness separately from reference syntax.
- Distinguish wording ambiguity from contradictory functionality. A small clarification is minor unless evidence demonstrates material harm. Do not inflate severity to make the offer appear valuable.
- For a proposed wording change, verify the product behavior before prescribing text. If the current wording accurately expresses the intended distinction, leave it unchanged.
- A minor task can be eligible only when the independent reviewer explains its concrete value within the advertised scope. Do not manufacture extra tasks to justify €9. If no useful change is supported, do not request payment.
- Preserve proposed model severity separately from independent ratings. Existing `sourceSupportApproved`, `usefulnessApproved` and per-task reviewed findings remain necessary; this document supplies none of those approvals.

## Review record for each prepared report

Record scope, observations reproduced, observations unchecked, collector limitations, each task's source support, usefulness and independent severity, and the final eligibility decision. Keep customer identifiers and private links only in the existing private job storage, never in project memory or this document.

Measure report quality through reviewer corrections, supported useful tasks and fulfillment outcomes. Measure SEO/GEO effects separately with an appropriate baseline and follow-up; preparation, deployment and favorable reviewer feedback are not performance proof.

## Feedback incorporated — 2026-10-13

An owner-supplied partial review found a report cautious and coherent, supported a minor copy clarification and confirmed broad positioning. It did not reproduce every technical observation and explicitly identified collection gaps and unmeasured SEO/GEO outcomes. This feedback supports the review distinctions above; it does not constitute complete technical acceptance, a customer sale or permission to change the audited website.
