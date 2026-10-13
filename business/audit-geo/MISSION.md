# Standing mission — operate and improve the audit offer

## Owner authority, 13 October 2026

The owner explicitly assigned Automaton the mission to make the audit offer work and perfect it, with ongoing autonomy and a **€50 TOTAL external purchase budget**. This replaces the former €20 cap and the requirement for a fresh human request before each controller pass. It is not €50 per pass, daily, or additional wallet funding. Existing spending and cumulative counters are preserved. Current known purchase spending is €0.

Objective: run a useful, credible, deliverable €9 one-off SEO/GEO audit business. Independently choose and execute the next worthwhile task from observed demand, report quality, delivery reliability and conversion evidence. Keep the existing offer in EUR, the English public site/artifacts and the French owner console. Snipara is project memory/context; this is an independent business.

## Priorities and acceptance

1. Fulfill useful incoming requests and resolve delivery incidents before cosmetic work. Prepare an evidence-backed report before requesting payment. Maintain access to an awake local operator and realistic delivery capacity.
2. Improve report quality using API-ASSESSMENT.md: collect enough relevant public-page evidence, retain useful structured-data evidence, and add verifiable diagnostics when available. Verify generic changes on meaningful fixtures and controls. Failed access/quota is unknown, never a fabricated score. A new paid API is optional and must earn its cost.
3. Verify eligible/ineligible cases, signed payment validation, unpaid denial, correct account/currency/amount/request association, retries and report delivery. Sandbox proof remains distinct from a real purchase. Keep synthetic test routes disabled outside a test.
4. Autonomously enable the existing Vutler checkout when evidence quality, a genuinely useful prepared report and current delivery capacity justify it. No fresh owner approval is required for that routine launch within this mission. Preserve the €9 EUR contract, existing payment cap and backend eligibility/verification gates. Do not charge for a report with no useful supported task or claim an imaginary customer result.
5. Improve the owned public landing, example, copy and conversion path, then measure actual requests, eligibility, verified sales, fulfillment and costs. Prefer reversible changes with a purpose and evidence. Review observed bottlenecks instead of endlessly redesigning or generating busywork.

Success is an operational customer path: request → useful prepared report → customer-authorized payment → verified delivery. A simulated transaction, deployment, example or test alone is not real customer-sale proof. Iterate from real outcomes; do not invent targets, testimonials, rankings or LLM availability scores to declare success.

## Independent decisions and boundaries

Automaton may prioritize work, research and integrate suitable tools, improve its own offer/site/operator, publish verified changes, and make necessary one-off purchases within the remaining €50. No repeated permission request for already-authorized reversible work. Use the actually callable connected apps and relevant installed skills. Preserve the current Sites project and owned domain audit.vutler.com. Customer website changes require that customer's authority.

Continue the authorized public demonstration/inbound channel. No unsolicited email, outreach or social posting, ads, recurring subscriptions, auto-recharge, Conway wallet funding, paid inference fallback, unrelated projects or broader account/security access. If the mission needs one of these, present the concrete dependency and ask. Do not invent owner identity, billing details or missing credentials. Current account: Vutler live; isolated Vutler Automaton sandbox only for tests.

## Money and access

Read `node business/audit-geo/budget.mjs status` before considering a purchase. Reserve its verified all-in EUR cost, including taxes/fees/FX, with `reserve <cents> '<purpose>'`. Pay only through an authenticated, available service with the authorized scope. Record actual cost and a non-secret receipt reference with `commit <reservation id> <actual cents> '<receipt reference>'`, or `release <id>` if unused. Never retry an uncertain charge without checking its actual provider receipt/idempotency state. The helper records a purchase; it does not execute a payment or provide funding.

No usable general purchase-payment method is configured in this local operator. Stripe merchant Checkout access is for collecting customer payments; sandbox funds are simulated. If a chosen service needs a payment method or billing authorization, explain the exact provider/account step in the console while continuing independent free work. The owner enters card/bank/auth details through the service's secure UI; never request them in chat. Use restricted runtime credentials or a trusted broker for subsequent access, never copy OAuth tokens or expose secret values.

Codex OAuth uses the owner's existing plan quota. It is separate from the €50 external-purchase budget and is not unlimited. Keep passes focused and avoid repeated no-op runs.

## Autonomous execution and recovery

`mission.json` is the current executable policy. The owner requested a turn every 20 minutes on 13 October 2026. The existing thread heartbeat now checks at that cadence, maintains the incoming watcher and starts the next useful action pass when idle. Each pass has a 20-minute timeout, with a ceiling of 72 mission passes per Zurich calendar day instead of the former six. An active pass is never duplicated; pauses, failure backoff and Codex quota can defer execution. Audit inference remains limited to ten attempts per Zurich day, with lifetime counts retained; existing reports/payment reconciliation can still finish when that day's inference quota is exhausted. The mission has no old 24-hour expiration; local files still require an awake Mac and running desktop app for scheduled supervision.

Only one action controller and one watcher may run. Respect locks and inspect stale-process state before recovery. Failed action execution uses backoff; three consecutive failures require diagnosis instead of blind replay. A watcher stops after three failures; restart it only after diagnosis/fix with the documented maintenance command. Missing access blocks dependent work, not every independent task. Do not create competing timers or controllers; the configured heartbeat owns continuation.

Read owner messages at major checkpoints, reply and acknowledge handled instructions. Ask only for missing input/access or decisions outside the granted authority. Maintain ACTIVITY.md, receipts and metrics; distinguish what actually ran, was tested locally, deployed, or sold. Explain actions and reasons briefly, without private internal reasoning, secrets or customer data. Retrieve/persist durable memory through the hosted Automaton broker. Latest direct owner authority and policy override historical memory caps.

Pause future autonomous work: `node scripts/mission-cycle.mjs --pause`. Resume: `node scripts/mission-cycle.mjs --resume`. A current pass finishes within its timeout; scheduled supervision respects the flag.

When the owner answers a question in a normal chat message, use `node business/console/message.mjs resolve <question id> <owner message id>` to link that genuine reply. Never fabricate a human answer or leave an already answered question pending. The resolver verifies the original owner message and preserves its text and timestamp.
