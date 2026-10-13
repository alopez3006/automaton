# Automaton owner console

The owner selected a web console local to this Mac. It follows actual controller/watcher state, displays ACTIVITY.md, and connects owner messages, operator replies and questions to the existing business executor. Customer-facing site assets remain separate.

## Start and open

From the Automaton checkout:

```sh
npm run business:console-start
open http://127.0.0.1:4317
```

The start helper reuses an existing console, otherwise starts it detached with a private log in `.automaton-business/console.log`. For a foreground server instead:

```sh
npm run business:console
```

The server binds only `127.0.0.1:4317`. Do not expose it through a public tunnel or reverse proxy. The API requires its local browser session, verifies Host/Origin and a POST token, bounds message sizes and serves only explicitly listed assets. It never exposes arbitrary workspace files, operator credentials or private request inventories.

Closing the browser does not stop Automaton. Stopping the foreground console with Ctrl+C stops that console only. The Mac must remain awake for the local business executor and incoming watcher.

## Chat and questions

Owner messages are private local files under ignored `.automaton-business/console/`. They are queued while an action is in progress and read by the executor at major checkpoints. The UI shows queued versus acknowledged messages. A message can start a bounded pass when the controller is idle if the corresponding checkbox is selected; the launch button does the same without a new message.

The current pilot allows **three controller passes, each at most 20 minutes**. Sending a message cannot silently bypass this cap. If launching fails or the cap is reached, the message remains saved and the UI explains the failure. This console is not continuous token streaming or access to private internal reasoning.

The executor uses:

```sh
node business/console/message.mjs inbox
node business/console/message.mjs history
node business/console/message.mjs say 'Explication courte et résultat observé.'
node business/console/message.mjs ask 'Quelle option préfères-tu ?' '["Option A","Option B"]'
node business/console/message.mjs ack <owner-message-id>
```

Questions appear in an actionable section, with suggested answers and a free-text field. Owner answers are linked to the question and delivered through the real inbox. Do not proceed with dependent work until the required answer arrives. At pass completion the runtime also posts its factual final summary into the conversation.

## Verification

TypeScript compilation and 17 targeted console/runtime tests passed. Tests cover question/answer delivery with question context, acknowledgement and concurrent message preservation, local session and Host/Origin/POST protections, concurrent launches, retained messages on launch failure, forbidden credentials, oversized/invalid JSON, atomic handling of simultaneous answers and exclusion of private audit data. Actual browser chat started the second controller pass; Automaton acknowledged the message, replied through its console helper and posed two real questions. Desktop and 375px mobile views were inspected; the mobile page had no horizontal overflow, and controls measured at least 46px high. Keyboard focus on the clipped activity viewport was exercised. Review findings on keyboard access, answer submission states and storage/transmission wording were corrected in one batch.

StackHawk CLI v6.4.0 and skills were current, but the platform returned HTTP 402 Payment Required. No DAST scan ran and no subscription was purchased. This is a documented verification limit, not a security certification.
