# Readable report evidence — local collector

Hypothesis: decoding encoded text makes report quotations readable and avoids treating encoding as a content defect.

Action: implemented a bounded one-pass decoder in evidence.mjs for titles, descriptions, H1 and heading passages. It handles amp/lt/gt/quot/apos/nbsp plus printable Unicode numeric references with semicolons. Markup is stripped before decoding, so encoded tags remain literal text. Unknown names, invalid Unicode and control references stay raw, with the limitation recorded in evidence. The existing pre-decoding cleaned HTML body field, canonical/discovery contracts and parsed JSON-LD remain unchanged. That body field is not the original fetched response.

Verification: 54 evidence/network/source-reference/report/task-review controls pass, including four new regression cases. Syntax and diff checks pass. TEXT-REFERENCE-ACCEPTANCE.json records commands and limits. This is a local collector improvement, not a Site deployment, semantic benchmark or customer report acceptance. Existing private snapshots were not migrated.

Alternatives evaluated: owned guide, navigation, crawl resources and entry measurement are completed; external LinkedIn publication remains the owner's action, Search Console needs a covering property. Additional public content without observed demand was lower priority than faithful report evidence. Current retained report readiness provides no useful approved report for checkout; do not manufacture a demonstration. Delivery fixes and the single native inbox test are complete; formatted-client and real runtime/payment delivery remain separate proofs, with no second test authorized by the prior one-time send. No provider access polling, token rotation or duplicate question performed.

Follow-up: on the next genuine report, record decoded quotations actually used and tasks revised/removed because encoded-text ambiguity was resolved; retain independent usefulness review before any invitation. Acquisition follow-up remains actual owner LinkedIn post and request-entry counts, with unknown visitor denominator.

Console inbox empty at both checkpoints. Hosted memory recalled through the safe broker after approved network access. No secrets read, new controller, timer, inference, mail, payment or purchase. Budget: used EUR 0, reserved EUR 0, available EUR 50. Counters and disabled runtime flags untouched.

External spend this pass: EUR 0.

Supervisor reconciliation 2026-10-14T10:44:08.847575+00:00: 54 affected controls pass independently, with additional unseen decimal/astral/nested-reference cases. A differential comparison against the committed pre-change collector confirms the preserved body/JSON-LD/discovery contracts. Syntax and diff checks pass. No further code change or external action; original runtime receipt retained.
