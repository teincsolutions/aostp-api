# WhatsApp Message Templates (Meta Business Platform)

Use these templates in the [Meta Business Platform](https://business.facebook.com) → Your App → WhatsApp → Message Templates.

All templates are **UTILITY** category (transactional). Create them exactly as shown below.

---

## Template 1: `package_received`

**Category:** UTILITY
**Language:** English (US) — `en_US`

### Body

```
Hi {{1}}, your package has been received at our {{2}} warehouse.

Tracking Code: {{3}}
Description: {{4}}
Status: Received

We will notify you once your shipment is on its way.

Thank you for choosing AOSTP Logistics.
```

| Variable | Example                          |
| -------- | -------------------------------- |
| `{{1}}`  | Customer name (e.g. John)        |
| `{{2}}`  | Warehouse name (e.g. China Main) |
| `{{3}}`  | Tracking code (e.g. AOSTP-123)   |
| `{{4}}`  | Description (e.g. Electronics)   |

---

## Template 2: `invoice_issued`

**Category:** UTILITY
**Language:** English (US) — `en_US`

### Body

```
Hi {{1}}, an invoice has been issued for your shipment.

Invoice: {{2}}
Amount: {{3}} {{4}}
Due Date: {{5}}

View your invoice: {{6}}

Thank you for choosing AOSTP Logistics.
```

| Variable | Example         |
| -------- | --------------- |
| `{{1}}`  | Customer name   |
| `{{2}}`  | Invoice number  |
| `{{3}}`  | Currency (USD)  |
| `{{4}}`  | Amount (500.00) |
| `{{5}}`  | Due date        |
| `{{6}}`  | Invoice URL     |

---

## Template 3: `shipment_update`

**Category:** UTILITY
**Language:** English (US) — `en_US`

### Body

```
Hi {{1}}, your shipment has been updated.

Tracking Code: {{2}}
Status: {{3}}
Shipping Mode: {{4}}
Last Updated: {{5}}

{{6}}

Thank you for choosing AOSTP Logistics.
```

| Variable | Example                                          |
| -------- | ------------------------------------------------ |
| `{{1}}`  | Customer name                                    |
| `{{2}}`  | Tracking code                                    |
| `{{3}}`  | Status (RECEIVED / SHIPPED / ARRIVED / RELEASED) |
| `{{4}}`  | Shipping mode (SEA / AIR)                        |
| `{{5}}`  | Date                                             |
| `{{6}}`  | Extra notes (optional)                           |

---

## Template 4: `payment_received`

**Category:** UTILITY
**Language:** English (US) — `en_US`

### Body

```
Hi {{1}}, your payment has been received.

Shipment: {{2}}
Amount: {{3}} {{4}}
Payment Code: {{5}}
Payment Method: {{6}}
Date: {{7}}

Thank you for your payment!

AOSTP Logistics
```

| Variable | Example         |
| -------- | --------------- |
| `{{1}}`  | Customer name   |
| `{{2}}`  | Tracking code   |
| `{{3}}`  | Currency (USD)  |
| `{{4}}`  | Amount (500.00) |
| `{{5}}`  | Payment code    |
| `{{6}}`  | Payment method  |
| `{{7}}`  | Date            |

---

## Template 5: `container_arrival`

**Category:** UTILITY
**Language:** English (US) — `en_US`

### Body

```
Hi {{1}}, your shipment has arrived at our {{2}} warehouse.

Tracking Code: {{3}}
Container: {{4}}
Route: {{5}} → {{6}}
Arrival Date: {{7}}

Please arrange pickup within 3 days.

AOSTP Logistics
```

| Variable | Example          |
| -------- | ---------------- |
| `{{1}}`  | Customer name    |
| `{{2}}`  | Warehouse name   |
| `{{3}}`  | Tracking code    |
| `{{4}}`  | Container number |
| `{{5}}`  | Departure city   |
| `{{6}}`  | Destination city |
| `{{7}}`  | Arrival date     |

---

## Template 6: `tracking_info`

**Category:** UTILITY
**Language:** English (US) — `en_US`

### Body

```
📦 Package: {{1}}
Status: {{2}}
Shipping Mode: {{3}}
Received: {{4}}

{{5}}

AOSTP Logistics
```

| Variable | Example       |
| -------- | ------------- |
| `{{1}}`  | Tracking code |
| `{{2}}`  | Status        |
| `{{3}}`  | Shipping mode |
| `{{4}}`  | Received date |
| `{{5}}`  | Description   |

---

## How to Create in Meta Dashboard

1. Go to **Meta Business Platform** → **Your App** → **WhatsApp** → **Message Templates**
2. Click **Create Template**
3. Select **Category**: UTILITY
4. Enter the **Name** (exactly as shown above)
5. Select **Language**: English (US)
6. Paste the **Body** content
7. Click **Submit** and wait for approval (UTILITY templates are usually approved quickly)

Once approved, note the template name — it will be used when sending templated messages from the API.

---

## Sending Templates from Code

### Inject the provider

```typescript
@Inject('WHATSAPP_PROVIDER')
private readonly whatsAppProvider: WhatsAppProvider;
```

### Send `package_received`

```typescript
await this.whatsAppProvider.sendTemplateMessage('233246092155', {
  name: 'package_received',
  language: { code: 'en_US' },
  components: [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: 'John' },
        { type: 'text', text: 'China Main' },
        { type: 'text', text: 'AOSTP-123' },
        { type: 'text', text: 'Electronics' },
      ],
    },
  ],
});
```

### Send `invoice_issued`

```typescript
await this.whatsAppProvider.sendTemplateMessage('233246092155', {
  name: 'invoice_issued',
  language: { code: 'en_US' },
  components: [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: 'John' },
        { type: 'text', text: 'INV-2026-001' },
        { type: 'text', text: 'USD' },
        { type: 'text', text: '500.00' },
        { type: 'text', text: '2026-06-01' },
        { type: 'text', text: 'https://aostp.akomapacargo.com/invoice/abc123' },
      ],
    },
  ],
});
```

### Send `shipment_update`

```typescript
await this.whatsAppProvider.sendTemplateMessage('233246092155', {
  name: 'shipment_update',
  language: { code: 'en_US' },
  components: [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: 'John' },
        { type: 'text', text: 'AOSTP-123' },
        { type: 'text', text: 'SHIPPED' },
        { type: 'text', text: 'SEA' },
        { type: 'text', text: '2026-05-14' },
        { type: 'text', text: 'Your package is on its way to Accra.' },
      ],
    },
  ],
});
```

### Send `payment_received`

```typescript
await this.whatsAppProvider.sendTemplateMessage('233246092155', {
  name: 'payment_received',
  language: { code: 'en_US' },
  components: [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: 'John' },
        { type: 'text', text: 'AOSTP-123' },
        { type: 'text', text: 'USD' },
        { type: 'text', text: '500.00' },
        { type: 'text', text: 'PAY-2026-001' },
        { type: 'text', text: 'Mobile Money' },
        { type: 'text', text: '2026-05-14' },
      ],
    },
  ],
});
```

### Send `container_arrival`

```typescript
await this.whatsAppProvider.sendTemplateMessage('233246092155', {
  name: 'container_arrival',
  language: { code: 'en_US' },
  components: [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: 'John' },
        { type: 'text', text: 'Accra Main' },
        { type: 'text', text: 'AOSTP-123' },
        { type: 'text', text: 'MSCU-1234567' },
        { type: 'text', text: 'Shenzhen' },
        { type: 'text', text: 'Accra' },
        { type: 'text', text: '2026-06-15' },
      ],
    },
  ],
});
```

### Send `tracking_info`

```typescript
await this.whatsAppProvider.sendTemplateMessage('233246092155', {
  name: 'tracking_info',
  language: { code: 'en_US' },
  components: [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: 'AOSTP-123' },
        { type: 'text', text: 'RECEIVED' },
        { type: 'text', text: 'SEA' },
        { type: 'text', text: '2026-05-01' },
        { type: 'text', text: 'Electronics and household items' },
      ],
    },
  ],
});
```
