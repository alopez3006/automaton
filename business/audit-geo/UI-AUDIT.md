# Technical UI review

Version 2, inspected against source and the live mobile browser at 399 CSS pixels. Full desktop browser verification remains unconfirmed because the in-app browser viewport override did not change its actual viewport.

| Dimension | Score | Evidence |
|---|---:|---|
| Accessibility | 3/4 | Labelled fields, live status, keyboard focus, semantic headings. Body contrast 13.16:1, muted text 6.26:1, button text 8.60:1. Screen-reader and keyboard walkthrough not exhaustive. |
| Performance | 4/4 | No framework dependency, one embedded font, no decorative animation or external asset fetch. |
| Responsive | 3/4 | Fluid sizes and one-column mobile layout; actual mobile DOM has no horizontal overflow, 48px inputs and buttons. Desktop layout checked in code only. |
| Theming | 3/4 | Consistent tokens for the intentionally single light theme. |
| Integrity | 4/4 | Real request persistence, explicit pending state, honest fictional demonstration, no made-up customer proof. |

Detector: two font warnings. Fraunces was a deliberate editorial choice, not a functional defect. Arial is body text, not the display face. A skipped heading level found during review was corrected before publication.

Local intake/privacy/authorization/payment-gate assertions passed. Live anonymous intake persisted a synthetic request; the owner operator prepared it through OAuth and did not process it twice. Missing Stripe server credentials prevent report release. No paid customer path or payment was tested.

StackHawk preflight found the CLI and credentials, but its platform returned HTTP 402 Payment Required. No DAST scan was completed and no security certification is claimed.

Version 2 adds tested server-side payment reconciliation and a delivery gate. Synthetic cases reject unpaid/incomplete status, wrong amount/currency/link/request, disabled payments, a full-access key and excessive polling. No live paid transaction was performed.
