# Pilot operations

## Current standing authority
On 13 October the owner assigned the ongoing mission to operate and perfect the audit offer with a €50 TOTAL purchase budget. MISSION.md and mission.json supersede historical setup limits below. The runtime now permits independent 20-minute passes, six per Zurich day, with failure backoff. The incoming watcher operates continuously while enabled, with ten audit inference attempts per Zurich day and cumulative counters retained. Hourly thread-heartbeat supervision owns continuation and watcher recovery; current native schedule metadata is in autonomy-schedule.json after creation. Purchases require budget reservations and actual receipts. No general purchase-payment method is configured; this ceiling is not wallet funding. Existing EUR 9 offer and customer payment gates remain. Sales readiness is decided from actual report usefulness and delivery capacity under the new authority.

Public page: https://audit.vutler.com (the original free hostname remains available).
Current verified publication: version 9, source c3be733dad2dfcf31ecd991a2957676d3445f32d, deployment succeeded with runtime environment revision 6. See LAUNCH-STATUS.md for the reconciled result after the third controller's time limit. Earlier details below describe their dated steps and do not override this current status.

## What runs today

- Public English page, a downloadable illustrative report, and persistent inbound request files.
- `node business/audit-geo/operator.mjs --once` reads the queue and prepares up to two reports using Codex-managed OAuth. It records inference attempts before calling Codex, stops at ten attempts, and never buys anything or charges anyone.
- `--pagespeed` adds the optional Google PageSpeed call. A failed quota check is unavailable, never a fabricated score.
- Private reports and evidence live in ignored `.reports/`. Operator access is in ignored `.operator.env`, mode 600. Neither is published.

## Payment fulfillment status — 13 October 2026

Latest supervisor update: the owner requested and authorized an isolated sandbox. **Vutler Automaton**, `acct_1UPzvFD1odHjzufx`, `livemode=false`, is now created from scratch under Vutler and explicitly connected to the Stripe MCP session by owner OAuth consent. A real sandbox products GET succeeded. Metadata is in payment-sandbox.json. This removes the second pass's missing-sandbox-access dependency; that catalog read alone does not prove fulfillment. Signed simulated sandbox fulfillment is recorded below; real paid delivery remains unproven. The existing live Vutler grant remains separate.

A dedicated Vutler live webhook `we_1UPsaRDj0FRggNOEbzyrpors` now targets `/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Its signing secret was transferred directly from the connected Stripe response into secret-marked Sites `STRIPE_WEBHOOK_SECRET`; it was not stored in local files. The handler validates the raw-body HMAC with a five-minute timestamp tolerance, live mode, paid and complete status, EUR 900 cents, the exact payment link and request association. It unlocks an already prepared useful report without a customer page revisit. Duplicate delivered requests are acknowledged without another delivery. Storage failures are retryable. Open-checkout requests cannot be deleted from the tracking page, preserving delayed-payment fulfillment.

PAYMENTS_ENABLED remains false and the five-checkout-cap link remains inactive. Two drafts, zero eligible, three attempts of ten were last observed; do not force a sale. The third pass recorded a real simulated sandbox checkout and signed delivery to its synthetic fixture, separate from live fulfillment. Asynchronous and duplicate/retry cases were tested locally. The parent independently confirmed both sandbox runtime disablement and the test webhook disabled after use. This does not prove a real paid customer path. Before activation, review the next evidence-backed eligible report and confirm capacity. Do not charge the owner to test.

The existing restricted Checkout Sessions key path is optional reconciliation/manual receipt verification. No restricted key was created or read during this run; signed webhook fulfillment does not require a Stripe API key on Sites. `configure-stripe.mjs` remains available for an owner who wants that separate fallback. Never paste secrets in chat.

The bounded incoming watcher was started on 13 October 2026 (PID and start time in ignored `.reports/watch-process.json`), five-minute polling, maximum 24 hours, ten inference attempts total or three consecutive failures. It requires an awake Mac and is not 24/7 cloud hosting. Its first pass found no new request; attempts remain two of ten. Payments stay disabled, so it can prepare drafts but cannot invite checkout.

Conway's native wallet/configuration and continuous agent loop have not been started. The OAuth inference provider is implemented separately; set inferenceProvider to codex-oauth in an existing Automaton configuration to select it. Existing Conway financial/survival prerequisites still apply. Do not call the current bounded operator a fully autonomous business.

No external purchase has been made. Codex calls consume existing account quota; API pricing is not a billing measure for these calls.

## Secure key input

In Stripe Dashboard select Vutler in live mode, create a restricted key named Automaton audit pilot with Checkout Sessions READ and everything else NONE. Complete the owner 2FA step. Then run `node business/audit-geo/configure-stripe.mjs` in your own terminal and paste the key into its hidden prompt. It verifies a read against the prepared payment link and stores only an ignored .stripe.env file with mode 600. Codex can configure the Sites secret from that file without printing the key. Never paste a credential into chat.

## Handoff controller

The owner console is available locally at `http://127.0.0.1:4317`. Start or reuse it with `npm run business:console-start`, or run the foreground server with `npm run business:console`. It displays controller and watcher separately, ACTIVITY.md, owner messages, actual Automaton replies and actionable questions. Messages are read at major checkpoints, with explicit acknowledgement. The three-pass and 20-minute limits still apply. See `../console/README.md` for operation and verification. The owner explicitly selected this Mac only; remote hosting is not configured.

Latest owner authority is in HANDOFF.md / OWNER-ASSETS.md: nine already-owned domains were supplied, necessary one-off launch spending was approved within the existing €20 total cap, and a moderate UI/UX Pro Max modernization of the public English site was requested. These instructions supersede the first pass's per-domain quote approval requirement. No domain is considered connected solely from the ownership statement or recommendation.

`pnpm business:handoff` starts the fork's local Automaton business mode in a detached process. `pnpm business:status` reports its state; .automaton-business/supervisor.log and private execution receipts record progress. The controller uses Automaton's database and skill loader, retrieves hosted project memory in its supervisor, and delegates authorized actions to the official Codex OAuth CLI with connected apps and automatic approval review. No API key is forwarded to that action executor.

This action-mode access was independently proved with a read of the existing public Site and a read of the Vutler account label. The old plain-inference limitation does not imply that action mode lacks connected apps. Raw credential-file access is forbidden; additional memory retrieval/persistence uses the dedicated hosted memory broker. Per-run duration is capped at 20 minutes; this pilot permits at most three controller runs. This is an initial execution handoff, not an unbounded permanent process or a funded Conway wallet/survival loop.

The current task and authority are in HANDOFF.md. Prefer the owned audit.vutler.com subdomain; exact pending DNS records are in DOMAIN-OPTIONS.md. Necessary one-off expenses are authorized within the existing €20 total cap, without subscriptions, add-ons or automatic renewal commitments. The free hostname remains active until DNS/TLS is verified. The Stripe CLI catalog currently has an authentication dependency distinct from the connected Stripe app; no legacy full-access key is reused to repair it.

## Standing mission commands
`node scripts/mission-cycle.mjs` maintains the watcher and starts an eligible action pass. `--watch-only` maintains it without a controller. `--restart-watcher` is for a diagnosed/fixed watcher failure, not blind retries. `--pause` / `--resume` changes future autonomous cycles. All detached launches must run from a normal terminal or a network-authorized tool execution. The actual thread heartbeat is ACTIVE and hourly; its ID is in autonomy-schedule.json.

Money helper: `node business/audit-geo/budget.mjs status`, `reserve <EUR cents including fees> <purpose>`, `commit <id> <actual cents> <non-secret receipt reference>`, `release <id>`. It reserves and records money; it cannot pay a provider or fund a wallet. Payment access must be configured securely with the selected provider. The console shows the current cumulative spend and policy budget.
