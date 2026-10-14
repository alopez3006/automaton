# Fixed request entry attribution — version 16

Hypothesis: bounded entry labels make future distribution decisions measurable without visitor tracking.

Action: published fixed home/guide/linkedin/unknown labels with both request intake paths, an attributed guide CTA, privacy notice and optional owner manual LinkedIn link. Added anonymous by-entry retained status/reviewed-summary aggregates to local metrics. Source `7c4feb1d3cc8ebc418cbdd6f4ae975370b01dc42`, deployment `appgdep_6acf4d2d027c81918990103924e372da` succeeded, environment revision 9 unchanged. Public site: https://audit.vutler.com/.

Verification: ENTRY-ATTRIBUTION-ACCEPTANCE.json records 14 attribution controls, 4 aggregate controls, intake/privacy/authorization, discovery, 14 mocked launch scenarios, build and artifact checks, plus seven public GET checks. An old navigation assertion was updated to the intentional attributed CTA. No production submission or customer-path completion claimed.

Baseline: three retained records all unknown, one reviewed summary, zero requested or delivered. Missing/invalid labels normalize to unknown. Labels are self-reported and spoofable; legacy records remain untouched. Inventory includes possible tests and excludes expired/deleted records. Visits, qualified demand, sales and conversion remain unknown.

Alternatives evaluated separately: acquisition guide/navigation and crawl resources are already published; external LinkedIn publishing belongs to the owner, and Search Console requires a covering property. Conversion measurement was selected because distribution currently cannot be compared even by request entry. Report usefulness requires a new genuine request or fresh relevant evidence; existing deferred task does not justify checkout. Delivery retry fixes and single native inbox test are complete; formatted-client/runtime/payment-to-delivery proof remains separate. No unchanged provider polling or synthetic report generation.

Follow-up: verify the next genuine request retains its label through review; after the actual owner post/date compare retained request and reviewed-summary totals by label, with independent usefulness assessment and no invented visitor denominator. Owner optional link is in public-content/DISTRIBUTION-KIT.md; no external post made.

Console inbox checked at major checkpoints, empty. Hosted recall recovered after approved network access. Native get_site response inadvertently returned a sensitive field in tool output; it was not reused or copied into artifacts, and subsequent output was filtered. No credential files read.

External spend this pass: EUR 0. No mail, payment, inference, synthetic production request, new controller or schedule. Notifications/payments remain disabled; existing budget and counters preserved.

Supervisor reconciliation 2026-10-14T10:02:07.035782+00:00: native version/source/archive/deployment confirmed; attribution, aggregate, intake/discovery and four public GET/canonical checks independently pass, build/source match. Raw sensitive value was not replayed or copied. MISSION.md now specifies secret-bearing native response allowlisting; this is an instruction guard, not runtime enforcement. SITES-OUTPUT-INCIDENT.json records a single pending direct-owner rotation request and its scope. Independent decisions continue without re-asking or touching environment/payment/tracking secrets.
