# Resend DNS publication — 14 October 2026

The owner explicitly requested these records in the existing Infomaniak zone for `vutler.com`. All four were created through the authenticated Manager and independently read on both `nsany1.infomaniak.com` and `nsany2.infomaniak.com`, with TTL 3600 seconds.

| Type | Name | Verified content |
| --- | --- | --- |
| TXT / DKIM | `resend._domainkey.vutler.com` | Exact public key supplied by the owner; byte-for-byte match verified. |
| CNAME | `rsend.vutler.com` | `rsend-euw1.forge.rmta.net.` |
| CNAME | `send.vutler.com` | `send.forge.rmta.net.` |
| TXT | `_dmarc.vutler.com` | `v=DMARC1; p=none;` |

The owner also authorized removing existing DMARC records. The Manager search found none before creation, and the authoritative root query returned none. Nothing was deleted; the requested new DMARC is the sole root DMARC record.

Existing root A, MX and SPF were preserved and independently checked after publication. Existing Infomaniak DKIM and the `_domainkey` nameserver delegation were retained. The dedicated **DKIM** creation form successfully publishes a TXT below that delegation; the generic TXT form did not save this selector. Do not remove the delegation or overwrite the older Infomaniak key to work around that behavior.

This proves DNS publication for `vutler.com`. It does not prove Resend account verification, usable server credentials, provider acceptance or inbox delivery. The runtime's previously planned `audits@mail.vutler.com` sender must be checked against the domain actually verified in Resend before enabling mail; do not infer verification of that subdomain from this receipt. No email, checkout activation, purchase or budget reservation was performed.
