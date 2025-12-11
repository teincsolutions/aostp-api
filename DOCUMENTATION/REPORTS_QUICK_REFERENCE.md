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

| Endpoint                   | Method | Description                       | Access                                         |
| -------------------------- | ------ | --------------------------------- | ---------------------------------------------- |
| `/reports/payments`        | GET    | All payments with currency totals | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/packing-lists`   | GET    | Invoice stats per packing list    | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/customer-league` | GET    | Top customers by 4 metrics        | SUPER_ADMIN, FINANCE_MANAGER                   |
| `/reports/shipping-method` | GET    | Stats by AIR/SEA shipping mode    | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/general`         | GET    | Comprehensive customer metrics    | SUPER_ADMIN, FINANCE_MANAGER                   |
| `/reports/pickups`         | GET    | Package delivery records          | SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK |
| `/reports/warehouses`      | GET    | Warehouse aggregations            | SUPER_ADMIN, FINANCE_MANAGER                   |

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

## ⚡ Performance Tips

1. **Always use date filters** for large datasets
2. **Filter by warehouse** when analyzing specific locations
3. **Use customer filter** for individual customer reports
4. Results are **cached** in memory for repeated queries
5. **Peak hours:** Expect slower response during heavy usage

---

## 🛠️ Troubleshooting

### "401 Unauthorized"

→ Token expired or invalid. Login again.

### "403 Forbidden"

→ Your role doesn't have access. Check role requirements.

### Empty results

→ Check filter values and date format (ISO 8601).

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
