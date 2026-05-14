# WhatsApp Cloud API Webhook

## Overview

Handles incoming WhatsApp messages from Meta's Cloud API. Users can track shipments or list pending shipments by phone number via simple text commands.

## Endpoint

```
Base URL: https://api.akomapacargo.com/api/v1/webhook/whatsapp
```

### GET — Webhook Verification

Meta sends a `GET` request during webhook setup to verify ownership.

**Query Parameters:**

| Param              | Value                              |
| ------------------ | ---------------------------------- |
| `hub.mode`         | `subscribe`                        |
| `hub.verify_token` | Must match `WHATSAPP_VERIFY_TOKEN` |
| `hub.challenge`    | Random string to echo back         |

**Success (200):** Returns `hub.challenge` as plain text.

**Failure (403):** Token mismatch or invalid mode.

---

### POST — Receive Messages

Meta delivers user messages via `POST`.

**Always returns 200** to prevent retries (even on errors).

**Request Body** (Meta payload):

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "phone_number_id": "123",
              "display_phone_number": "15551234567"
            },
            "contacts": [
              { "profile": { "name": "John" }, "wa_id": "233537776709" }
            ],
            "messages": [
              {
                "from": "233537776709",
                "id": "wamid.ABC123",
                "timestamp": "1715000000",
                "type": "text",
                "text": { "body": "TRACK AOSTP-123" }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

Only `type: "text"` messages are processed. Status updates and non-text messages (images, audio, etc.) are silently acknowledged with 200.

---

## Commands

### TRACK `<code>`

Look up a shipment by tracking code or intake tracking code.

**Example:**

```
TRACK AOSTP-123
```

**Response:**

```
📦 *Package: AOSTP-123*
Status: RECEIVED | SEA
Received: May 1, 2026

Description: Electronics and household items

Warehouse: China Main (Shenzhen)
Pickup Code: PK-001
Payment: PENDING

Packing List: PL-2026-05
Container: MSCU-1234567
Route: Shenzhen → Accra
ETA: Jun 15, 2026

Invoice: INV-001 | USD 500.00 | UNPAID
Due: Jun 1, 2026

Items (2):
  • ITM-001 — Electronics
  • ITM-002 x3 15kg — Clothing
```

**Not found:**

```
❌ No package found with tracking code: AOSTP-999
```

---

### PHONE `<number>`

List un-released, unpaid shipments for a phone number.

**Example:**

```
PHONE 0537776709
```

**Response:**

```
📋 *Pending Shipments for 0537776709*

1. AOSTP-123 — RECEIVED — SEA — May 1, 2026
   Description: Electronics and household items
   Payment: PENDING

2. AOSTP-456 — SHIPPED — AIR — Apr 20, 2026
   Description: Documents
   Payment: PENDING
```

**No results:**

```
✅ No pending shipments found for 0537776709. If you have a tracking code, try:
TRACK <code>
```

---

### Default (help)

Any unrecognized command returns:

```
Welcome to AOSTP Logistics 🚚

Commands:
TRACK <code> — Track your shipment
PHONE <number> — View pending shipments for a phone number

Example:
TRACK AOSTP-123
PHONE 0537776709
```

---

## Environment Variables

| Variable                   | Description                                                  |
| -------------------------- | ------------------------------------------------------------ |
| `WHATSAPP_ACCESS_TOKEN`    | Meta Cloud API permanent access token                        |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID from Meta Business Account                   |
| `WHATSAPP_VERIFY_TOKEN`    | Arbitrary string chosen by you; used in webhook verification |

Add these to `.env` or Jenkins credentials (`whatsapp-access-token-prod`, `whatsapp-phone-number-id-prod`, `whatsapp-verify-token-prod`).

---

## Meta Setup Guide (Meta Business Platform)

1. Go to [developers.facebook.com](https://developers.facebook.com) → Your App → WhatsApp → Configuration
2. In the **Webhook** section, click **Edit** → **Subscribe**
3. Set **Callback URL** to:
   ```
   https://api.akomapacargo.com/api/v1/webhook/whatsapp
   ```
4. Set **Verify Token** to the value of `WHATSAPP_VERIFY_TOKEN`
5. Subscribe to the **messages** webhook field

---

## CURL Examples

### Test webhook verification

```bash
curl "https://api.akomapacargo.com/api/v1/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=my_verify_token&hub.challenge=12345"
```

### Simulate an incoming message

```bash
curl -X POST "https://api.akomapacargo.com/api/v1/webhook/whatsapp" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "233537776709",
            "type": "text",
            "text": { "body": "TRACK AOSTP-123" }
          }]
        }
      }]
    }]
  }'
```

---

## Notes

- Replies are sent as **plain text only** (no templates, no media)
- All replies are user-initiated (within the 24-hour messaging window)
- Maximum 20 results returned for `PHONE` command
- The endpoint is `@Public()` — no JWT auth required (Meta cannot send auth headers)
