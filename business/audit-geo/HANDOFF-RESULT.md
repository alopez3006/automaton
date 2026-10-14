# Delivery retry exhaustion — version 15

Hypothesis: a persistent review state makes exhausted delivery retries actionable instead of leaving an ambiguous pending marker.

Action: corrected both direct sending and polling to persist `needs_review` with fixed `retry_window_expired` or `retry_attempt_limit` reasons. Prior attempt timestamps and receipt fields remain preserved; paid records are untouched. Published version 15, source `57f17c89f3fbd1296a45e40b8b9040048f9c26e5`, deployment `appgdep_6acf484199d08191a2d01d3c3f5cec68` succeeded with environment revision 9 unchanged. See DELIVERY-EXHAUSTION-ACCEPTANCE.json.

Verification: four boundary controls (direct/poll × window/attempt ceiling), notification regressions and 14 launch scenarios pass with mock providers; syntax, diff and build pass. No live sending failure or live payment-to-delivery proof inferred.

Alternatives evaluated: acquisition guide/navigation and brand publication are complete; external LinkedIn publication belongs to the owner; Search Console remains dependent on a covering property. Conversion has no observed visitor denominator. Current anonymous inventory: three retained records, zero requested, one prepared, two ineligible, zero delivered. Existing retained report has no independently established useful paid task, so checkout activation is unjustified. Delivery persistence was the useful permitted improvement selected.

Follow-up: on first actual exhausted notification, measure persistent review reason, zero automatic replays and unchanged paid entitlement; review any new genuine request before invitation. Formatted client-mail inspection requires separately authorized real sending; no second test sent. No new controller or schedule.

External spend this pass: EUR 0. Notifications/payments/sandbox remain disabled.

Supervisor reconciliation 2026-10-14T09:31:19.919769+00:00: native saved version/source and succeeded deployment match the claimed release; managed source clean and build bytes match. Four boundary controls, notification regressions and 14 launch scenarios independently pass. Environment revision remains 9. Historical runtime receipt and all counters preserved; no repeat mail or unrelated public-page tests.
