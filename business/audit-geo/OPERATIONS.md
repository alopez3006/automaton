# Pilot operations

Public page: https://audit-geo-pilote.alopez-nevicom.chatgpt.site
Site version 2: source bc880bc67b7e6ed75b842abc3f02eb61029a668b.

## What runs today

- Public English page, a downloadable illustrative report, and persistent inbound request files.
- `node business/audit-geo/operator.mjs --once` reads the queue and prepares up to two reports using Codex-managed OAuth. It records inference attempts before calling Codex, stops at ten attempts, and never buys anything or charges anyone.
- `--pagespeed` adds the optional Google PageSpeed call. A failed quota check is unavailable, never a fabricated score.
- Private reports and evidence live in ignored `.reports/`. Operator access is in ignored `.operator.env`, mode 600. Neither is published.

## Payment setup still required

The Vutler Stripe connector is connected in the Codex owner chat. Its OAuth grant is not automatically inherited by this local Node process or the hosted Site.

The €9 one-off payment link in payment.json is prepared but INACTIVE. Its cap is five completed sessions. Before activating it:
1. Review the first prepared reports and confirm a delivery date for the request.
2. Configure a Vutler restricted key with read access to Checkout Sessions as the Sites runtime secret STRIPE_RESTRICTED_KEY; never paste it into chat or source. Set STRIPE_PAYMENT_LINK_ID to the exact prepared link ID. Deploy the saved Site version to apply the environment revision.
3. Associate the payment link with the accepted request using `client_reference_id=<request UUID>`. Verify paid status, live mode, 900 cents EUR and the expected payment link/account. The server delivery gate performs these checks when an authenticated operator submits a receipt and report. A boolean or return URL alone cannot authorize delivery.
4. The operator can invite payment with --accept-orders after server setup is enabled. It prepares the report before payment and rejects paid eligibility when no useful task is supported. The customer returns to the private tracking page after paying; its server polls Checkout Sessions at most once a minute and releases the stored report only for a matching complete paid receipt.
5. After validation, activate the prepared payment link through the owner Stripe connector, set PAYMENTS_ENABLED=true in Sites and deploy the saved version. Start `node business/audit-geo/watch.mjs` for a bounded 24-hour local pilot, polling every five minutes, stopping at ten inference attempts or three consecutive failures. This requires the Mac to remain awake. No email, ad purchase or background Conway wallet loop is started.

Conway's native wallet/configuration and continuous agent loop have not been started. The OAuth inference provider is implemented separately; set inferenceProvider to codex-oauth in an existing Automaton configuration to select it. Existing Conway financial/survival prerequisites still apply. Do not call the current bounded operator a fully autonomous business.

No external purchase has been made. Codex calls consume existing account quota; API pricing is not a billing measure for these calls.

## Secure key input

In Stripe Dashboard select Vutler in live mode, create a restricted key named Automaton audit pilot with Checkout Sessions READ and everything else NONE. Complete the owner 2FA step. Then run `node business/audit-geo/configure-stripe.mjs` in your own terminal and paste the key into its hidden prompt. It verifies a read against the prepared payment link and stores only an ignored .stripe.env file with mode 600. Codex can configure the Sites secret from that file without printing the key. Never paste a credential into chat.
