# Package Delivery API

## Overview

The Package Delivery API manages the recording and tracking of package deliveries to customers. It handles the entire delivery process including creating delivery records, updating package statuses, and sending notifications.

## Base URL

```
/package-delivery
```

## Authentication

All endpoints require:

- **Bearer Token** authentication
- **Role**: `OPERATIONS_CLERK` or `SUPER_ADMIN`

---

## Endpoints

### 1. Create Package Delivery Record

Creates a delivery record when a package is delivered to a customer.

**Endpoint:** `POST /package-delivery`

**Authorization:** `OPERATIONS_CLERK` or `SUPER_ADMIN` role required

#### Request Body

```json
{
  "invoiceId": "60f1b2b5c1d9e2f4e6b4f1a2",
  "trackingCode": "TR-2025-001",
  "receiverName": "John Doe",
  "quantity": 5,
  "notes": "Delivered to front gate",
  "photos": ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"]
}
```

#### Request Fields

| Field          | Type     | Required | Description                                                                          |
| -------------- | -------- | -------- | ------------------------------------------------------------------------------------ |
| `invoiceId`    | string   | Yes      | UUID of the invoice where the delivery belongs                                       |
| `trackingCode` | string   | Yes      | Package tracking code (e.g., TR-2025-001)                                            |
| `receiverName` | string   | No       | Name of the person who received the package                                          |
| `quantity`     | number   | No       | Quantity released (defaults to package quantity if not provided)                     |
| `notes`        | string   | No       | Optional delivery notes                                                              |
| `photos`       | string[] | No       | Array of photo URLs (must be uploaded first via `/api/v1/uploads/packages` endpoint) |

**Important**: Photos must be uploaded separately using the uploads endpoint **before** creating the delivery record. See the "Photo Upload Process" section below.

#### Business Logic

1. **Validates Invoice**: Checks if the invoice exists
2. **Finds Package**: Locates the package using the tracking code
3. **Validates Association**: Ensures the package belongs to the specified invoice
4. **Prevents Duplicates**: Checks if a delivery record already exists for this package
5. **Generates Delivery ID**: Creates a unique delivery ID (format: `DEL001-2025001`)
6. **Creates Record**: Creates the delivery record in a database transaction
7. **Updates Package Status**: Updates the package status to `RELEASED`
8. **Logs Action**: Creates an audit log entry
9. **Sends Notification**: Sends a delivery notification to the customer

#### Success Response (201)

```json
{
  "id": "uuid-delivery-123",
  "deliveryId": "DEL001-2025001",
  "customerId": "uuid-customer-456",
  "invoiceId": "60f1b2b5c1d9e2f4e6b4f1a2",
  "packageId": "uuid-package-101",
  "receiverName": "John Doe",
  "quantity": 5,
  "releaseDate": "2025-12-04T10:30:00.000Z",
  "notes": "Delivered to front gate",
  "photos": [
    "https://example.com/photo1.jpg",
    "https://example.com/photo2.jpg"
  ],
  "package": {
    "id": "uuid-package-101",
    "trackingCode": "TR-2025-001",
    "warehouse": {
      "id": "uuid-warehouse-555",
      "name": "Main Warehouse"
    }
  }
}
```

#### Error Responses

**400 Bad Request**

```json
{
  "statusCode": 400,
  "message": "Validation error or delivery not allowed",
  "error": "Bad Request"
}
```

Common 400 error scenarios:

- Package does not belong to the specified invoice
- Delivery record already exists for this package
- Invoice does not have an associated package
- Validation errors in request body

**401 Unauthorized**

```json
{
  "statusCode": 401,
  "message": "Unauthorized access",
  "error": "Unauthorized"
}
```

**403 Forbidden**

```json
{
  "statusCode": 403,
  "message": "Insufficient permissions (requires OPERATIONS_CLERK or SUPER_ADMIN role)",
  "error": "Forbidden"
}
```

**404 Not Found**

```json
{
  "statusCode": 404,
  "message": "Invoice with ID {invoiceId} not found",
  "error": "Not Found"
}
```

Or:

```json
{
  "statusCode": 404,
  "message": "Package with tracking code {trackingCode} not found for the provided invoice",
  "error": "Not Found"
}
```

---

### 2. Get Deliveries by Invoice

Retrieves all package deliveries associated with a specific invoice.

**Endpoint:** `GET /package-delivery/by-invoice/:invoiceId`

**Authorization:** `OPERATIONS_CLERK` or `SUPER_ADMIN` role required

#### URL Parameters

| Parameter   | Type   | Required | Description  |
| ----------- | ------ | -------- | ------------ |
| `invoiceId` | string | Yes      | Invoice UUID |

#### Example Request

```
GET /package-delivery/by-invoice/uuid-invoice-123
Authorization: Bearer {token}
```

#### Success Response (200)

```json
[
  {
    "id": "uuid-delivery-123",
    "deliveryId": "DEL001-2025001",
    "releaseDate": "2025-12-04T10:30:00.000Z",
    "quantity": 5,
    "receiverName": "John Doe",
    "photos": ["https://example.com/photo1.jpg"],
    "package": {
      "id": "uuid-package-101",
      "trackingCode": "TR-2025-001",
      "description": "Electronics",
      "warehouse": {
        "id": "uuid-warehouse-555",
        "name": "Main Warehouse"
      }
    }
  }
]
```

#### Error Responses

**404 Not Found**

```json
{
  "statusCode": 404,
  "message": "Invoice not found",
  "error": "Not Found"
}
```

---

### 3. Get Deliveries by Customer

Retrieves all package deliveries for a specific customer across all invoices.

**Endpoint:** `GET /package-delivery/by-customer/:customerId`

**Authorization:** `OPERATIONS_CLERK` or `SUPER_ADMIN` role required

#### URL Parameters

| Parameter    | Type   | Required | Description   |
| ------------ | ------ | -------- | ------------- |
| `customerId` | string | Yes      | Customer UUID |

#### Example Request

```
GET /package-delivery/by-customer/uuid-customer-456
Authorization: Bearer {token}
```

#### Success Response (200)

```json
[
  {
    "id": "uuid-delivery-123",
    "deliveryId": "DEL001-2025001",
    "releaseDate": "2025-12-04T10:30:00.000Z",
    "quantity": 5,
    "receiverName": "John Doe",
    "invoice": {
      "id": "uuid-invoice-123",
      "invoiceNumber": "INV-2025-001",
      "packingList": {
        "container": {
          "containerNumber": "CONT-2025-001",
          "destinationCity": "New York"
        }
      }
    }
  }
]
```

#### Error Responses

**404 Not Found**

```json
{
  "statusCode": 404,
  "message": "Customer not found",
  "error": "Not Found"
}
```

---

### 4. Get Delivery Details by ID

Retrieves detailed information for a specific delivery record.

**Endpoint:** `GET /package-delivery/by-id/:deliveryId`

**Authorization:** `OPERATIONS_CLERK` or `SUPER_ADMIN` role required

#### URL Parameters

| Parameter    | Type   | Required | Description                                     |
| ------------ | ------ | -------- | ----------------------------------------------- |
| `deliveryId` | string | Yes      | Delivery ID (not UUID) - e.g., `DEL001-2025001` |

#### Example Request

```
GET /package-delivery/by-id/DEL001-2025001
Authorization: Bearer {token}
```

#### Success Response (200)

```json
{
  "id": "uuid-delivery-123",
  "deliveryId": "DEL001-2025001",
  "releaseDate": "2025-12-04T10:30:00.000Z",
  "quantity": 5,
  "receiverName": "John Doe",
  "photos": [
    "https://example.com/photo1.jpg",
    "https://example.com/photo2.jpg"
  ],
  "customer": {
    "id": "uuid-customer-456",
    "firstName": "Jane",
    "lastName": "Smith"
  },
  "invoice": {
    "id": "uuid-invoice-123",
    "invoiceNumber": "INV-2025-001",
    "packingList": {
      "container": {
        "containerNumber": "CONT-2025-001",
        "destinationCity": "New York"
      }
    }
  },
  "package": {
    "id": "uuid-package-101",
    "trackingCode": "TR-2025-001",
    "description": "Electronics",
    "warehouse": {
      "id": "uuid-warehouse-555",
      "name": "Main Warehouse"
    }
  }
}
```

#### Error Responses

**404 Not Found**

```json
{
  "statusCode": 404,
  "message": "Delivery not found",
  "error": "Not Found"
}
```

---

## Photo Upload Process

Delivery photos must be uploaded **separately** before creating the delivery record. Follow this two-step process:

### Step 1: Upload Photos

Use the general uploads endpoint to upload delivery photos:

**Endpoint:** `POST /api/v1/uploads/packages`

**Request:**

- Content-Type: `multipart/form-data`
- Method: Upload up to 3 files at once

**Form Data:**

```
files: [File1, File2, File3]  // Multiple files (max 3)
folder: "pictures"             // Required: 'pictures' or 'videos'
packageId: "uuid-package-101"  // Required: Package UUID
fileName: "delivery-photo.jpg" // Optional: Original filename
```

**Example using cURL:**

```bash
curl -X POST https://api.aostp.com/api/v1/uploads/packages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@photo1.jpg" \
  -F "files=@photo2.jpg" \
  -F "folder=pictures" \
  -F "packageId=uuid-package-101"
```

**Success Response (201):**

```json
[
  {
    "url": "https://s3.amazonaws.com/aostp-packages/pictures/uuid-package-101/photo1-timestamp.jpg",
    "key": "pictures/uuid-package-101/photo1-timestamp.jpg",
    "bucket": "aostp-packages"
  },
  {
    "url": "https://s3.amazonaws.com/aostp-packages/pictures/uuid-package-101/photo2-timestamp.jpg",
    "key": "pictures/uuid-package-101/photo2-timestamp.jpg",
    "bucket": "aostp-packages"
  }
]
```

### Step 2: Create Delivery with Photo URLs

Use the returned URLs in the delivery creation request:

```json
{
  "invoiceId": "60f1b2b5c1d9e2f4e6b4f1a2",
  "trackingCode": "TR-2025-001",
  "receiverName": "John Doe",
  "quantity": 5,
  "notes": "Delivered to front gate",
  "photos": [
    "https://s3.amazonaws.com/aostp-packages/pictures/uuid-package-101/photo1-timestamp.jpg",
    "https://s3.amazonaws.com/aostp-packages/pictures/uuid-package-101/photo2-timestamp.jpg"
  ]
}
```

**⚠️ Common Error:**

If you include `bucketType`, `file`, or any upload-related fields in the delivery creation request, you will receive:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["property bucketType should not exist"],
  "timestamp": "2025-12-05T20:25:24.663Z"
}
```

**Solution:** Only send the fields listed in the "Request Fields" table. Photos must be pre-uploaded URLs, not file uploads.

---

## Data Models

### PackageDelivery

| Field          | Type           | Description                                       |
| -------------- | -------------- | ------------------------------------------------- |
| `id`           | string (UUID)  | Unique identifier                                 |
| `deliveryId`   | string         | Human-readable delivery ID (e.g., DEL001-2025001) |
| `customerId`   | string (UUID)  | Customer who received the package                 |
| `invoiceId`    | string (UUID)  | Associated invoice                                |
| `packageId`    | string (UUID)  | Package that was delivered                        |
| `receiverName` | string \| null | Name of receiver (optional)                       |
| `quantity`     | number         | Quantity delivered                                |
| `releaseDate`  | Date           | Timestamp when delivery was recorded              |
| `notes`        | string \| null | Delivery notes                                    |
| `photos`       | string[]       | Array of photo URLs                               |
| `warehouseId`  | string (UUID)  | Warehouse from which package was released         |
| `createdById`  | string (UUID)  | User who created the delivery record              |

---

## Workflow

### Delivery Creation Flow

```
1. Operations Clerk initiates delivery
   ↓
2. System validates invoice existence
   ↓
3. System finds package by tracking code
   ↓
4. System validates package-invoice association
   ↓
5. System checks for existing delivery record
   ↓
6. System generates unique delivery ID
   ↓
7. Database transaction begins
   ├─ Create delivery record
   ├─ Update package status to RELEASED
   └─ Create audit log entry
   ↓
8. Transaction commits
   ↓
9. Send notification to customer
   ↓
10. Return delivery record
```

---

## Status Updates

### Package Status Changes

When a delivery is created:

- **Package**: Status updated to `RELEASED` immediately upon delivery record creation

---

## Notifications

Upon successful delivery creation, the system sends a notification to the customer via the `NotificationsService` confirming the package has been delivered. The notification includes:

- Package tracking code
- Delivery ID
- Delivery date and time
- Receiver name (if provided)
- Delivered quantity

**Notification Messages:**

- **Email Subject**: "Package Delivered - AOSTP Logistics"
- **Email Content**: Confirms successful delivery with full details including receiver name and delivery date
- **SMS/WhatsApp**: Short confirmation message with receiver name (if available): "Hi [Customer], your package ([Tracking Code]) has been delivered. Received by: [Receiver Name]. Delivery ID: [ID]"

---

## Audit Logging

Every delivery creation is logged with:

- **Action**: `CREATE`
- **Entity**: `PackageDelivery`
- **User**: Operations clerk who created the delivery
- **Data**: Delivery details including customer code, tracking code, quantity

---

## Common Use Cases

### 1. Record a Delivery

When a customer picks up their package:

1. Scan the package tracking code
2. Confirm the invoice
3. (Optional) Record receiver name
4. (Optional) Take delivery photos
5. Create the delivery record
6. System updates package status and notifies customer

### 2. View Customer Delivery History

To see all deliveries for a customer:

1. Use the customer ID
2. Retrieve all delivery records
3. View across all invoices and containers

### 3. Audit Invoice Deliveries

To check which packages from an invoice have been delivered:

1. Use the invoice ID
2. Retrieve all delivery records
3. Cross-reference with invoice packages

---

## Error Handling

The API uses standard HTTP status codes:

- **200 OK**: Successful GET request
- **201 Created**: Delivery record created successfully
- **400 Bad Request**: Validation error or business rule violation
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found (invoice, customer, package item)
- **500 Internal Server Error**: Server-side error

All error responses follow the NestJS standard format with `statusCode`, `message`, and `error` fields.

---

## Security

- All endpoints require JWT authentication
- Only users with `OPERATIONS_CLERK` or `SUPER_ADMIN` roles can access these endpoints
- All actions are logged in the audit trail
- User identity is captured from JWT token for audit purposes

---

## Notes

- Delivery IDs are auto-generated and follow the format: `DEL{warehouseCode}-{sequentialNumber}`
- A package can only have one delivery record (enforced at database level with unique constraint)
- **Photos must be uploaded separately** using `/api/v1/uploads/packages` endpoint before creating delivery
- Photos are stored in S3 and only the URLs are saved in the delivery record
- The `quantity` field represents the package quantity being delivered
- Package status is automatically updated to `RELEASED` when delivery is created
- Delivery is package-level, not item-level (one delivery per package)
- Maximum 3 photos can be uploaded per batch using the uploads endpoint
