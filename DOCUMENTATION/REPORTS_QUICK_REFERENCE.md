# Reports Module - Quick Reference

## 🚀 Quick Start

### 1. Server is already configured

The Reports module has been automatically registered in `app.module.ts`.

### 2. Access Swagger Documentation

```
http://localhost:3000/api
Navigate to: Reports section
```

### 3. Get JWT Token

```bash
POST /auth/login
{
  "username": "your-username",
  "password": "your-password"
}
```

### 4. Use Token in Swagger

Click "Authorize" button → Enter: `Bearer YOUR_TOKEN_HERE`

---

## 📋 All Endpoints at a Glance

### Core Reports (7 endpoints)

| Endpoint                   | Method | Description                       | Access                                         |
| -------------------------- | ------ | --------------------------------- | ---------------------------------------------- |
| `/reports/payments`        | GET    | All payments with currency totals | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/packing-lists`   | GET    | Invoice stats per packing list    | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/customer-league` | GET    | Top customers by 4 metrics        | SUPER_ADMIN, FINANCE_MANAGER                   |
| `/reports/shipping-method` | GET    | Stats by AIR/SEA shipping mode    | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/general`         | GET    | Comprehensive customer metrics    | SUPER_ADMIN, FINANCE_MANAGER                   |
| `/reports/pickups`         | GET    | Package delivery records          | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/warehouses`      | GET    | Warehouse aggregations            | SUPER_ADMIN, FINANCE_MANAGER                   |

### Dashboard Graphs (8 endpoints)

| Endpoint                                     | Method | Description                 | Access                                         |
| -------------------------------------------- | ------ | --------------------------- | ---------------------------------------------- |
| `/reports/dashboard/invoices-by-month`       | GET    | Monthly invoice counts      | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/dashboard/payments-by-month`       | GET    | Monthly payments AIR vs SEA | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/dashboard/intakes-by-month`        | GET    | Monthly intake counts       | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/dashboard/pickups-by-month`        | GET    | Monthly pickup counts       | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/dashboard/payment-methods`         | GET    | Payment method breakdown    | SUPER_ADMIN, FINANCE_MANAGER                   |
| `/reports/dashboard/shipping-modes`          | GET    | AIR vs SEA package counts   | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/dashboard/top-customers-by-amount` | GET    | Top 10 by invoice amount    | SUPER_ADMIN, FINANCE_MANAGER                   |
| `/reports/dashboard/top-customers-shipping`  | GET    | Top 10 by CBM and weight    | SUPER_ADMIN, FINANCE_MANAGER                   |

### Dashboard Recent Activity (5 endpoints)

| Endpoint                                      | Method | Description                    | Access                                         |
| --------------------------------------------- | ------ | ------------------------------ | ---------------------------------------------- |
| `/reports/dashboard/recent-intakes`           | GET    | Last 20 intakes (paginated)    | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/dashboard/recent-invoices-payments` | GET    | Last 20 invoices with payments | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/dashboard/recent-aged-packages`     | GET    | Unreleased packages by age     | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/dashboard/recent-packing-lists`     | GET    | Last 20 packing lists          | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/dashboard/recent-pickups`           | GET    | Last 20 deliveries             | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |

**Total: 20 endpoints**

---

## 🔑 Common Query Parameters

```
?fromDate=2025-01-01T00:00:00Z
&toDate=2025-12-31T23:59:59Z
&warehouseId=123e4567-e89b-12d3-a456-426614174000
&customerId=123e4567-e89b-12d3-a456-426614174000
&shippingMode=SEA
```

---

## 💡 Quick Examples

### Get Payments for Last Month

```bash
curl -X GET "http://localhost:3000/reports/payments?fromDate=2025-11-01T00:00:00Z&toDate=2025-11-30T23:59:59Z" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Top Customers

```bash
curl -X GET "http://localhost:3000/reports/customer-league" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Warehouse Stats

```bash
curl -X GET "http://localhost:3000/reports/warehouses?warehouseId=YOUR_WAREHOUSE_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 What Each Report Shows

### 1. Payments Report

- List of all payments
- Customer details
- Currency conversion
- Totals: USD, GHS, Other currencies

### 2. Packing List Report

- Invoice counts by status (paid/unpaid/partial)
- Percentages
- Shipping metrics (CBM, weight, cost)
- Per packing list breakdown

### 3. Customer League

Four rankings:

- Top by invoice amounts
- Top by payment amounts
- Top by CBM volume
- Top by weight

### 4. Shipping Method Report

For SEA and AIR:

- Total revenue
- Invoice count
- Outstanding invoices
- Customer count
- Top 10 customers per mode

### 5. General Report

Per customer:

- Invoice/payment totals
- Pickup rate (delivered/total)
- Shipping modes used
- First/last transaction dates

### 6. Pickup Report

- Delivery records
- Customer info
- Invoice details
- Package status
- Receiver information

### 7. Warehouse Report

Per warehouse:

- Package count
- Customer count
- Volume metrics (CBM, weight)
- Outstanding invoices
- Associated packing lists

---

## 📊 Dashboard Endpoint Examples

### Get Monthly Invoice Chart Data

```bash
curl -X GET "http://localhost:3000/reports/dashboard/invoices-by-month?year=2025" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:** Array of `{ month: "JAN", count: 245 }` for charts

### Get Payment Method Breakdown

```bash
curl -X GET "http://localhost:3000/reports/dashboard/payment-methods?year=2025" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:** Array of `{ paymentMethod: "MOMO", totalAmount: 450000, count: 245 }`

### Get Recent Intakes (Paginated)

```bash
# First page
curl -X GET "http://localhost:3000/reports/dashboard/recent-intakes?limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Next page (use nextCursor from response)
curl -X GET "http://localhost:3000/reports/dashboard/recent-intakes?limit=20&cursor=pkg-020" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Top Customers by Amount

```bash
curl -X GET "http://localhost:3000/reports/dashboard/top-customers-by-amount?year=2025" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:** Top 10 customers with invoice totals, payments, and balances

---

## ⚡ Performance Tips

1. **Always use date filters** for large datasets
2. **Filter by warehouse** when analyzing specific locations
3. **Use customer filter** for individual customer reports
4. Results are **cached** in memory for repeated queries
5. **Peak hours:** Expect slower response during heavy usage
6. **Dashboard endpoints**: Consider caching monthly aggregations (TTL: 1 hour)
7. **Recent activity**: Use pagination with reasonable limits (max 100)

---

## 🛠️ Troubleshooting

### "401 Unauthorized"

→ Token expired or invalid. Login again.

### "403 Forbidden"

→ Your role doesn't have access. Check role requirements.

### Empty results

→ Check filter values and date format (ISO 8601).

### Dashboard shows no monthly data

→ Verify `year` parameter. Defaults to current year if not provided.

### Pagination not working

→ Ensure you're using the `nextCursor` value from the previous response.

### Slow response

→ Use date range filters to narrow results.

---

## 📚 Full Documentation

See: `DOCUMENTATION/REPORTS_DOCUMENTATION.md`

---

## 🔄 Data Updates

Reports show **real-time data** from the database.
No caching delay - always current.

---

## 📞 Support

Questions? Check:

1. Swagger UI docs at `/api`
2. Full docs in `DOCUMENTATION/REPORTS_DOCUMENTATION.md`
3. Implementation notes in `DOCUMENTATION/REPORTS_IMPLEMENTATION_PROGRESS.md`
