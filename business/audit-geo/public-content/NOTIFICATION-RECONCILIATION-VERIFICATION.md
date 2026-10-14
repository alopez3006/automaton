# Notification reconciliation verification — 14 October 2026

Status: verified locally, not deployed. Site project remains `appgprj_6acd6192fcac8191b47b7b9538517608`; source base remains version-12 commit `fa72c3f5b7190cbb196c8bdc60c4d2eb663f3ade`.

`notification-reconciliation.patch` retains only the notification module and its test changes. The managed checkout also retains the independently reviewed guide changes; preserve both through the official Sites workflow. No manual Site source commit or credential transfer occurred during this acceptance.

Paid report notifications receive priority within the existing first 50 retained request records. A retry still inside its one-minute cooldown is skipped before consuming the two-attempt reconciliation allowance. Stable provider idempotency keys, accepted-message deduplication, three-attempt/23-hour retry boundaries, unpaid report redaction and separate notification receipts remain. Priority does not extend beyond the first inventory page. Returned counters describe the inspected reconciliation prefix, not a complete customer inventory or inbox receipt.

Independent checks passed: notification assertions (including three cooling messages followed by a paid report and a receipt), payment and signed-webhook suites, integrated synthetic launch, module syntax and whitespace checks. The official local Sites build passed; built modules import as ESM and match their source bytes. Patch reverse-applicability check passed against the retained source changes. All providers/storage/payments in these checks are mocked; no real email, customer sale or payment activation occurred.

Publication still requires the accepted secure Sites channel already recorded in GUIDE-VERIFICATION.md and the existing owner-console question. No retry or alternate transfer of the previously rejected credential was attempted. Actual transactional sending additionally requires verified scoped Resend configuration and separate provider acceptance/inbox evidence. The existing DAST provider prerequisite is unchanged and was not retried; no scan result or security certification is claimed.

After publication and provider verification, measure paid-transition-to-provider-acceptance delay on genuine orders, then verify inbox receipt separately. Do not generate a payment or repeated demonstration to populate this metric.
